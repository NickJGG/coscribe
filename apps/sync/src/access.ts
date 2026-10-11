import { SCHEMA_VERSION } from "@coscribe/editor"

export type Access = "write" | "read" | null

export interface AccessFacts {
  visibility: "public" | "private"
  status: "active" | "finished"
  locked: boolean
  role: "host" | "cohost" | "writer" | "viewer" | null
  /** Holds an unaccepted Invite to the story. */
  invited: boolean
}

/**
 * Writers and up edit unless the Chapter is locked or the Story is Finished. Everyone else may watch when
 * can_view_story() would let them (Public, a pending Invite, or an invited Viewer), read-only.
 */
export function decideAccess(facts: AccessFacts | null): Access {
  if (!facts) return null
  if (facts.role === "viewer") return "read"
  if (facts.role) return facts.locked || facts.status === "finished" ? "read" : "write"
  return facts.visibility === "public" || facts.invited ? "read" : null
}

/** A client on another schema version, or one too old to send it, must not edit. */
export function isOutdated(schema: string | null): boolean {
  return Number(schema) !== SCHEMA_VERSION
}
