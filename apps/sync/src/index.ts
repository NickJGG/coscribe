/**
 * Hocuspocus server for live Chapter and Entry documents.
 *
 * - Yjs state persists to `chapters.ydoc` / `entries.ydoc`.
 * - onAuthenticate checks the Supabase token (optional: anonymous Viewers send none) against the
 *   story's membership, Visibility, status, and (for Chapters) lock state.
 * - Chapter Snapshots are taken from the store and unload hooks (see snapshots.ts).
 * - HTTP endpoints for the web app (Bearer SYNC_SECRET), which checks permissions first:
 *   - `POST /stories/<id>/refresh` re-checks every open connection to that story after the web app
 *     changes access: lowers or raises read-only live, or disconnects.
 *   - `GET /snapshots/<id>` returns a Snapshot's content as ProseMirror JSON.
 *   - `POST /snapshots/<id>/restore` Restores a Snapshot into the live Chapter.
 */
import { createHash, timingSafeEqual } from "node:crypto"
import type { IncomingMessage, ServerResponse } from "node:http"
import { Database } from "@hocuspocus/extension-database"
import { Server, type Hocuspocus } from "@hocuspocus/server"
import { ACCESS_REVOKED, parseDocumentName, type AccessMessage } from "@coscribe/editor"
import { verifyUser } from "./auth"
import { env } from "./env"
import { documentAccess, fetchDocument, storeDocument, type DocumentRef } from "./documents"
import { chapterStored, chapterUnloading, restoreSnapshot, snapshotPreview } from "./snapshots"

type Context = { userId: string | null; storyId: string; document: DocumentRef }

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
const ROUTE = new RegExp(`^/(stories|snapshots)/(${UUID})(?:/(refresh|restore))?$`, "i")

const server = new Server<Context>({
  name: "coscribe-sync",
  port: env.port,

  extensions: [
    new Database({
      fetch: async ({ documentName }) => {
        const doc = parseDocumentName(documentName)
        return doc ? fetchDocument(doc) : null
      },
      store: async ({ documentName, state }) => {
        const doc = parseDocumentName(documentName)
        if (doc) await storeDocument(doc, state)
      },
    }),
  ],

  async onAuthenticate({ token, documentName, connectionConfig }) {
    const doc = parseDocumentName(documentName)
    if (!doc) throw new Error("unknown document")

    const userId = token ? await verifyUser(token) : null
    const { storyId, access } = await documentAccess(doc, userId)
    if (!storyId || !access) throw new Error("forbidden")

    connectionConfig.readOnly = access === "read"
    return { userId, storyId, document: doc } satisfies Context
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
      await route(instance, request.method, match[1]!, match[2]!, match[3], response)
    }
    // Hocuspocus treats an empty rejection as "handled": it skips the default response.
    throw null
  },
})

async function route(
  instance: Hocuspocus<Context>,
  method: string | undefined,
  resource: string,
  id: string,
  action: string | undefined,
  response: ServerResponse
) {
  if (method === "POST" && resource === "stories" && action === "refresh") {
    await refreshStory(instance, id)
    response.writeHead(204).end()
  } else if (method === "GET" && resource === "snapshots" && !action) {
    const content = await snapshotPreview(id)
    if (!content) return response.writeHead(404).end()
    response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ content }))
  } else if (method === "POST" && resource === "snapshots" && action === "restore") {
    const restored = await restoreSnapshot(instance, id, (chapterId, storyId) => ({
      userId: null,
      storyId,
      document: { kind: "chapter" as const, id: chapterId },
    }))
    response.writeHead(restored ? 204 : 404).end()
  } else {
    response.writeHead(404).end()
  }
}

/** A failed Snapshot must not block storing or unloading the document. */
async function snapshotting(task: Promise<void>) {
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

      const { access } = await documentAccess(context.document, context.userId)
      if (!access) {
        connection.close({ code: 4403, reason: ACCESS_REVOKED })
      } else if (connection.readOnly !== (access === "read")) {
        connection.readOnly = access === "read"
        connection.sendStateless(JSON.stringify({ type: "access", readOnly: connection.readOnly } satisfies AccessMessage))
      }
    }
  }
}

server.listen()
