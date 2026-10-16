/**
 * Hocuspocus server for live Chapter, Entry and Outline documents.
 *
 * - Yjs state persists to `chapters.ydoc` / `entries.ydoc` / `chapter_outlines.ydoc`. Chapters also store their word count and
 *   per-author characters; on startup, Chapters stored before those columns existed are backfilled.
 * - onAuthenticate checks the Supabase token (optional: anonymous Viewers send none) against the
 *   story's membership, Visibility, status, and (for Chapters and their Outlines) lock state. A client whose `?schema=`
 *   isn't SCHEMA_VERSION is outdated: read-only for as long as it stays connected, and told so.
 * - Chapter and Entry Snapshots are taken from the load, store and unload hooks (see snapshots.ts), and open
 *   Chapters and Entries tell their connections whether taking one would save anything.
 * - Presence: connect and disconnect mirror who is where into the database (see presence.ts), which is
 *   cleared before the server starts listening. Reference connections (Pinned Entry bodies, whose token
 *   starts `ref:`) and Outlines don't count.
 * - Writing Days: every edit a User sends to any document counts toward that day (see writing.ts). Server
 *   writes (Restore, Import) run with no userId, so they credit nobody.
 * - On SIGTERM, flushes Writing Days, then stores and unloads every open document before exiting.
 * - HTTP endpoints for the web app (Bearer SYNC_SECRET), which checks permissions first:
 *   - `POST /stories/<id>/refresh` re-checks every open connection to that story after the web app
 *     changes access: lowers or raises read-only live, or disconnects.
 *   - `GET /stories/<id>/content` returns every Chapter and Entry body as ProseMirror JSON, for the
 *     Reader View, Credits and Export. With `?outlines=1` it adds every Outline with content, for a Draft Export.
 *   - `GET /snapshots/<id>` (`/entry-snapshots/<id>` for an Entry's) returns a Snapshot's content as ProseMirror JSON.
 *   - `POST /snapshots/<id>/restore` (`/entry-snapshots/<id>/restore`) Restores a Snapshot into the live Chapter (Entry).
 *   - `POST /chapters/<id>/snapshot` (`/entries/<id>/snapshot`) takes a Snapshot of the live Chapter (Entry), with
 *     body `{ name: string | null }`: 201 when taken, 409 when nothing changed since the last one, 404 when it's gone.
 *   - `POST /stories/<id>/import` fills a just-created Story from an imported file (see import.ts), with body
 *     `{ userId, chapters, entries }`: 204 when imported, 400 when the body doesn't fit the schemas, 409 when the
 *     Story isn't fresh.
 *   - `POST /chapters/<id>/feature` saves a User's Featured Passage from the Chapter, with body
 *     `{ userId, from, to }` (TextPoints): 204 when saved, 422 with the reason it can't be featured, 404
 *     when the Chapter is gone.
 */
import { createHash, timingSafeEqual } from "node:crypto"
import type { IncomingMessage, ServerResponse } from "node:http"
import { Database } from "@hocuspocus/extension-database"
import { Server, type Hocuspocus } from "@hocuspocus/server"
import {
  ACCESS_REVOKED,
  DOCUMENT_TRASHED,
  parseDocumentName,
  type AccessMessage,
  type DocumentKind,
  type OutdatedMessage,
} from "@coscribe/editor"
import { isOutdated, parseToken } from "./access"
import { verifyUser } from "./auth"
import { env } from "./env"
import {
  backfillChapterStats,
  documentAccess,
  fetchDocument,
  storeDocument,
  storyContent,
  storyOutlines,
  type DocumentRef,
} from "./documents"
import { importStory } from "./import"
import { parseImportBody } from "./import-body"
import { featurePassage, isTextPoint } from "./passages"
import { arrive, clearPresence, depart, setMember } from "./presence"
import {
  documentLoaded,
  documentStored,
  documentUnloading,
  isSnapshotKind,
  restoreSnapshot,
  snapshotMessage,
  snapshotPreview,
  takeSnapshotNow,
} from "./snapshots"
import { noteEdit, startWritingFlush } from "./writing"

type Context = {
  userId: string | null
  storyId: string
  document: DocumentRef
  member: boolean
  socketId: string
  outdated: boolean
  reference: boolean
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
const ROUTE = new RegExp(`^/(stories|snapshots|entry-snapshots|chapters|entries)/(${UUID})(?:/(refresh|restore|content|import|snapshot|feature))?(?:[?].*)?$`, "i")

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

    const { jwt, reference } = parseToken(token)
    const userId = jwt ? await verifyUser(jwt) : null
    const { storyId, access, member } = await documentAccess(doc, userId)
    if (!storyId || !access) throw new Error("forbidden")

    const outdated = isOutdated(requestParameters.get("schema"))
    connectionConfig.readOnly = access === "read" || outdated
    return {
      userId,
      storyId,
      document: doc,
      member,
      socketId,
      outdated,
      reference: reference || doc.kind === "outline",
    } satisfies Context
  },

  async afterLoadDocument({ documentName, document, context }) {
    const doc = parseDocumentName(documentName)
    if (doc && isSnapshotKind(doc.kind)) {
      await snapshotting(documentLoaded({ kind: doc.kind, id: doc.id }, document, context.socketId !== "server"))
    }
  },

  async connected({ context, connection }) {
    arrive(context, context)
    if (context.outdated) connection.sendStateless(JSON.stringify({ type: "outdated" } satisfies OutdatedMessage))
    // Unknown until the document finishes loading; documentLoaded broadcasts it then.
    const { kind, id } = context.document
    const message = isSnapshotKind(kind) ? snapshotMessage({ kind, id }) : undefined
    if (message) connection.sendStateless(message)
  },

  async onDisconnect({ context }) {
    depart(context)
  },

  async onChange({ context }) {
    if (context.userId) noteEdit(context.userId)
  },

  async afterStoreDocument({ documentName, document }) {
    const doc = parseDocumentName(documentName)
    if (doc && isSnapshotKind(doc.kind)) await snapshotting(documentStored({ kind: doc.kind, id: doc.id }, document))
  },

  async beforeUnloadDocument({ documentName, document }) {
    const doc = parseDocumentName(documentName)
    if (doc && isSnapshotKind(doc.kind)) await snapshotting(documentUnloading({ kind: doc.kind, id: doc.id }, document))
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
    const loaded = (name: string) => instance.documents.get(name)
    const content = await storyContent(id, loaded)
    if (new URL(request.url!, "http://sync").searchParams.get("outlines") === "1") {
      content.outline = await storyOutlines(id, loaded)
    }
    response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(content))
  } else if (method === "POST" && resource === "stories" && action === "import") {
    const body = parseImportBody(await readJson(request))
    if (!body) return response.writeHead(400).end()
    const result = await importStory(instance, id, body, (doc, storyId) => serverContext(doc.id, storyId, doc.kind))
    response.writeHead(result === "imported" ? 204 : 409).end()
  } else if (method === "GET" && (resource === "snapshots" || resource === "entry-snapshots") && !action) {
    const content = await snapshotPreview(resource === "snapshots" ? "chapter" : "entry", id)
    if (!content) return response.writeHead(404).end()
    response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ content }))
  } else if (method === "POST" && (resource === "snapshots" || resource === "entry-snapshots") && action === "restore") {
    const restored = await restoreSnapshot(instance, resource === "snapshots" ? "chapter" : "entry", id, serverContext)
    response.writeHead(restored ? 204 : 404).end()
  } else if (method === "POST" && (resource === "chapters" || resource === "entries") && action === "snapshot") {
    const body = await readJson(request)
    const name = typeof body?.name === "string" ? body.name.trim() || null : null
    const kind = resource === "chapters" ? "chapter" : "entry"
    const result = await takeSnapshotNow(instance, { kind, id }, name, (storyId) => serverContext(id, storyId, kind))
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

function serverContext(id: string, storyId: string, kind: DocumentKind = "chapter"): Context {
  return {
    userId: null,
    storyId,
    document: { kind, id },
    member: false,
    socketId: "server",
    outdated: false,
    reference: false,
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

      const { access, member, trashed } = await documentAccess(context.document, context.userId)
      setMember(context, member)
      if (!access) {
        connection.close({ code: 4403, reason: trashed ? DOCUMENT_TRASHED : ACCESS_REVOKED })
      } else if (connection.readOnly !== (access === "read" || context.outdated)) {
        connection.readOnly = access === "read" || context.outdated
        connection.sendStateless(JSON.stringify({ type: "access", readOnly: connection.readOnly } satisfies AccessMessage))
      }
    }
  }
}

clearPresence().then(
  async () => {
    await server.listen()
    const stopWriting = startWritingFlush()
    process.once("SIGTERM", async () => {
      await stopWriting()
      await server.destroy()
      process.exit(0)
    })
  },
  (error) => {
    console.error("couldn't clear presence", error)
    process.exit(1)
  }
)

backfillChapterStats().then(
  (count) => count && console.log(`backfilled stats for ${count} chapters`),
  (error) => console.error("chapter stats backfill failed", error)
)
