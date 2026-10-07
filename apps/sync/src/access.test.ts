import { describe, expect, it } from "vitest"
import { decideAccess, type AccessFacts } from "./access"

const open: AccessFacts = { visibility: "private", status: "active", locked: false, role: null, invited: false }

describe("decideAccess", () => {
  it("lets every role edit an unlocked Chapter of an active Story", () => {
    for (const role of ["writer", "cohost", "host"] as const) {
      expect(decideAccess({ ...open, role })).toBe("write")
    }
  })

  it("makes members read-only on a locked Chapter or a Finished Story", () => {
    expect(decideAccess({ ...open, role: "host", locked: true })).toBe("read")
    expect(decideAccess({ ...open, role: "writer", status: "finished" })).toBe("read")
  })

  it("lets outsiders watch Public stories and pending invitees watch Private ones", () => {
    expect(decideAccess({ ...open, visibility: "public" })).toBe("read")
    expect(decideAccess({ ...open, invited: true })).toBe("read")
  })

  it("rejects outsiders of Private stories and missing Chapters", () => {
    expect(decideAccess(open)).toBeNull()
    expect(decideAccess(null)).toBeNull()
  })
})
