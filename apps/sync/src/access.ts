import { SCHEMA_VERSION, type DocumentKind } from "@coscribe/editor"

export type Access = "write" | "read" | null

export interface AccessFacts {
  kind: DocumentKind
  visibility: "public" | "private"
  status: "active" | "finished"
  locked: boolean
  role: "host" | "cohost" | "writer" | "viewer" | null
  /** Holds an unaccepted Invite to the story. */
  invited: boolean
}

/**
 * Writers and up edit unless the Chapter is locked or the Story is Finished. Everyone else may watch when
 * can_view_story() would let them (Public, a pending Invite, or an invited Viewer), read-only. Outlines are for
 * Writers and up only, so everyone else is turned away.
 */
export function decideAccess(facts: AccessFacts | null): Access {
  if (!facts) return null
  if (facts.kind === "outline" && (!facts.role || facts.role === "viewer")) return null
  if (facts.role === "viewer") return "read"
  if (facts.role) return facts.locked || facts.status === "finished" ? "read" : "write"
  return facts.visibility === "public" || facts.invited ? "read" : null
}

/** A client on another schema version, or one too old to send it, must not edit. */
export function isOutdated(schema: string | null): boolean {
  return Number(schema) !== SCHEMA_VERSION
}

const REFERENCE = "ref:"

/**
 * A Pinned Entry's body sends its token as `ref:<jwt>` (or just `ref:` when signed out): a reference
 * connection, which counts toward no Presence.
 */
export function parseToken(token: string): { jwt: string | null; reference: boolean } {
  const reference = token.startsWith(REFERENCE)
  const jwt = reference ? token.slice(REFERENCE.length) : token
  return { jwt: jwt || null, reference }
}
