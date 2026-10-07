/**
 * Hocuspocus server for live Chapter and Entry documents.
 *
 * - Yjs state persists to `chapters.ydoc` / `entries.ydoc`.
 * - onAuthenticate checks the Supabase token (optional: anonymous Viewers send none) against the
 *   story's membership, Visibility, status, and (for Chapters) lock state.
 * - `POST /stories/<id>/refresh` (Bearer SYNC_SECRET) re-checks every open connection to that story
 *   after the web app changes access: lowers or raises read-only live, or disconnects.
 */
import { createHash, timingSafeEqual } from "node:crypto"
import type { IncomingMessage } from "node:http"
import { Database } from "@hocuspocus/extension-database"
import { Server, type Hocuspocus } from "@hocuspocus/server"
import { ACCESS_REVOKED, parseDocumentName, type AccessMessage } from "@coscribe/editor"
import { verifyUser } from "./auth"
import { env } from "./env"
import { documentAccess, fetchDocument, storeDocument, type DocumentRef } from "./documents"

type Context = { userId: string | null; storyId: string; document: DocumentRef }

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

  async onRequest({ request, response, instance }) {
    const match = /^\/stories\/([0-9a-f-]{36})\/refresh$/i.exec(request.url ?? "")
    if (request.method !== "POST" || !match) return

    if (!authorized(request)) {
      response.writeHead(401).end()
    } else {
      await refreshStory(instance, match[1]!)
      response.writeHead(204).end()
    }
    // Hocuspocus treats an empty rejection as "handled": it skips the default response.
    throw null
  },
})

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
