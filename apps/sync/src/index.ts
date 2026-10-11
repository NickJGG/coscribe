/**
 * Hocuspocus server for live Chapter and Entry documents.
 *
 * - Yjs state persists to `chapters.ydoc` / `entries.ydoc`. Chapters also store their word count and
 *   per-author characters; on startup, Chapters stored before those columns existed are backfilled.
 * - onAuthenticate checks the Supabase token (optional: anonymous Viewers send none) against the
 *   story's membership, Visibility, status, and (for Chapters) lock state. A client whose `?schema=`
 *   isn't SCHEMA_VERSION is outdated: read-only for as long as it stays connected, and told so.
 * - Chapter Snapshots are taken from the store and unload hooks (see snapshots.ts), and open Chapters
 *   tell their connections whether taking one would save anything.
 * - Presence: connect and disconnect mirror who is where into the database (see presence.ts), which is
 *   cleared before the server starts listening.
 * - HTTP endpoints for the web app (Bearer SYNC_SECRET), which checks permissions first:
 *   - `POST /stories/<id>/refresh` re-checks every open connection to that story after the web app
 *     changes access: lowers or raises read-only live, or disconnects.
 *   - `GET /stories/<id>/content` returns every Chapter and Entry body as ProseMirror JSON, for the
 *     Reader View and Credits.
 *   - `GET /snapshots/<id>` returns a Snapshot's content as ProseMirror JSON.
 *   - `POST /snapshots/<id>/restore` Restores a Snapshot into the live Chapter.
 *   - `POST /chapters/<id>/snapshot` takes a Snapshot of the live Chapter, with body `{ name: string | null }`:
 *     201 when taken, 409 when nothing changed since the last one, 404 when the Chapter is gone.
 *   - `POST /chapters/<id>/feature` saves a User's Featured Passage from the Chapter, with body
 *     `{ userId, from, to }` (TextPoints): 204 when saved, 422 with the reason it can't be featured, 404
 *     when the Chapter is gone.
 */
import { createHash, timingSafeEqual } from "node:crypto"
import type { IncomingMessage, ServerResponse } from "node:http"
import { Database } from "@hocuspocus/extension-database"
import { Server, type Hocuspocus } from "@hocuspocus/server"
import { ACCESS_REVOKED, parseDocumentName, type AccessMessage, type OutdatedMessage } from "@coscribe/editor"
import { isOutdated } from "./access"
import { verifyUser } from "./auth"
import { env } from "./env"
import {
  backfillChapterStats,
  documentAccess,
  fetchDocument,
  storeDocument,
  storyContent,
  type DocumentRef,
} from "./documents"
import { featurePassage, isTextPoint } from "./passages"
import { arrive, clearPresence, depart, setMember } from "./presence"
import {
  chapterLoaded,
  chapterStored,
  chapterUnloading,
  restoreSnapshot,
  snapshotMessage,
  snapshotPreview,
  takeSnapshotNow,
} from "./snapshots"

type Context = {
  userId: string | null
  storyId: string
  document: DocumentRef
  member: boolean
  socketId: string
  outdated: boolean
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
const ROUTE = new RegExp(`^/(stories|snapshots|chapters)/(${UUID})(?:/(refresh|restore|content|snapshot|feature))?$`, "i")

const server = new Server<Context>({
  name: "coscribe-sync",
  port: env.port,

  extensions: [
    new Database({
      fetch: async ({ documentName }) => {
        const doc = parseDocumentName(documentName)
        return doc ? fetchDocument(doc) : null
      },
      store: async ({ documentName, state, document }) => {
        const doc = parseDocumentName(documentName)
        if (doc) await storeDocument(doc, state, document)
      },
    }),
  ],

  async onAuthenticate({ token, documentName, connectionConfig, socketId, requestParameters }) {
    const doc = parseDocumentName(documentName)
    if (!doc) throw new Error("unknown document")

    const userId = token ? await verifyUser(token) : null
    const { storyId, access, member } = await documentAccess(doc, userId)
    if (!storyId || !access) throw new Error("forbidden")

    const outdated = isOutdated(requestParameters.get("schema"))
    connectionConfig.readOnly = access === "read" || outdated
    return { userId, storyId, document: doc, member, socketId, outdated } satisfies Context
  },

  async afterLoadDocument({ documentName, document }) {
    const doc = parseDocumentName(documentName)
    if (doc?.kind === "chapter") await snapshotting(chapterLoaded(doc.id, document))
  },

  async connected({ context, connection }) {
    arrive(context, context)
    if (context.outdated) connection.sendStateless(JSON.stringify({ type: "outdated" } satisfies OutdatedMessage))
    // Unknown until the Chapter finishes loading; chapterLoaded broadcasts it then.
    const message = context.document.kind === "chapter" ? snapshotMessage(context.document.id) : undefined
    if (message) connection.sendStateless(message)
  },

  async onDisconnect({ context }) {
    depart(context)
  },

  async afterStoreDocument({ documentName, document }) {
    const doc = parseDocumentName(documentName)
    if (doc?.kind === "chapter") await snapshotting(chapterStored(doc.id, document))
  },

  async beforeUnloadDocument({ documentName, document }) {
    const doc = parseDocumentName(documentName)
    if (doc?.kind === "chapter") await snapshotting(chapterUnloading(doc.id, document))
  },

  async onRequest({ request, response, instance }) {
    const match = ROUTE.exec(request.url ?? "")
    if (!match) return

    if (!authorized(request)) {
      response.writeHead(401).end()
    } else {
      await route(instance, request, match[1]!, match[2]!, match[3], response)
    }
    // Hocuspocus treats an empty rejection as "handled": it skips the default response.
    throw null
  },
})

async function route(
  instance: Hocuspocus<Context>,
  request: IncomingMessage,
  resource: string,
  id: string,
  action: string | undefined,
  response: ServerResponse
) {
  const { method } = request
  if (method === "POST" && resource === "stories" && action === "refresh") {
    await refreshStory(instance, id)
    response.writeHead(204).end()
  } else if (method === "GET" && resource === "stories" && action === "content") {
    const content = await storyContent(id, (name) => instance.documents.get(name))
    response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(content))
  } else if (method === "GET" && resource === "snapshots" && !action) {
    const content = await snapshotPreview(id)
    if (!content) return response.writeHead(404).end()
    response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ content }))
  } else if (method === "POST" && resource === "snapshots" && action === "restore") {
    const restored = await restoreSnapshot(instance, id, serverContext)
    response.writeHead(restored ? 204 : 404).end()
  } else if (method === "POST" && resource === "chapters" && action === "snapshot") {
    const body = await readJson(request)
    const name = typeof body?.name === "string" ? body.name.trim() || null : null
    const result = await takeSnapshotNow(instance, id, name, (storyId) => serverContext(id, storyId))
    response.writeHead({ taken: 201, unchanged: 409, gone: 404 }[result]).end()
  } else if (method === "POST" && resource === "chapters" && action === "feature") {
    const body = await readJson(request)
    if (typeof body?.userId !== "string" || !isTextPoint(body.from) || !isTextPoint(body.to)) {
      return response.writeHead(400).end()
    }
    const result = await featurePassage(id, body.userId, body.from, body.to, (name) => instance.documents.get(name))
    if (result.saved) response.writeHead(204).end()
    else if ("gone" in result) response.writeHead(404).end()
    else response.writeHead(422, { "content-type": "application/json" }).end(JSON.stringify({ error: result.error }))
  } else {
    response.writeHead(404).end()
  }
}

function serverContext(chapterId: string, storyId: string): Context {
  return {
    userId: null,
    storyId,
    document: { kind: "chapter", id: chapterId },
    member: false,
    socketId: "server",
    outdated: false,
  }
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown> | null> {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(chunk as Buffer)
  try {
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"))
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** A failed Snapshot must not block storing or unloading the document. */
async function snapshotting(task: Promise<unknown>) {
  try {
    await task
  } catch (error) {
    console.error("snapshot failed", error)
  }
}

function authorized(request: IncomingMessage): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest()
  return timingSafeEqual(digest(request.headers.authorization ?? ""), digest(`Bearer ${env.syncSecret}`))
}

async function refreshStory(instance: Hocuspocus<Context>, storyId: string) {
  for (const document of instance.documents.values()) {
    for (const connection of document.getConnections()) {
      const { context } = connection
      if (context.storyId !== storyId) continue

      const { access, member } = await documentAccess(context.document, context.userId)
      setMember(context, member)
      if (!access) {
        connection.close({ code: 4403, reason: ACCESS_REVOKED })
      } else if (connection.readOnly !== (access === "read" || context.outdated)) {
        connection.readOnly = access === "read" || context.outdated
        connection.sendStateless(JSON.stringify({ type: "access", readOnly: connection.readOnly } satisfies AccessMessage))
      }
    }
  }
}

clearPresence().then(
  () => server.listen(),
  (error) => {
    console.error("couldn't clear presence", error)
    process.exit(1)
  }
)

backfillChapterStats().then(
  (count) => count && console.log(`backfilled stats for ${count} chapters`),
  (error) => console.error("chapter stats backfill failed", error)
)
