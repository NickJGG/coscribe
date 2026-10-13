import { describe, expect, it } from "vitest"
import { SCHEMA_VERSION } from "@coscribe/editor"
import { decideAccess, isOutdated, parseToken, type AccessFacts } from "./access"

const open: AccessFacts = { kind: "chapter", visibility: "private", status: "active", locked: false, role: null, invited: false }

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

  it("keeps invited Viewers read-only", () => {
    expect(decideAccess({ ...open, role: "viewer" })).toBe("read")
  })

  it("rejects outsiders of Private stories and missing Chapters", () => {
    expect(decideAccess(open)).toBeNull()
    expect(decideAccess(null)).toBeNull()
  })
})

describe("decideAccess for an Outline", () => {
  const outline: AccessFacts = { ...open, kind: "outline" }

  it("lets every Writer edit", () => {
    for (const role of ["writer", "cohost", "host"] as const) {
      expect(decideAccess({ ...outline, role })).toBe("write")
    }
  })

  it("makes Writers read-only on a locked Chapter or a Finished Story", () => {
    expect(decideAccess({ ...outline, role: "cohost", locked: true })).toBe("read")
    expect(decideAccess({ ...outline, role: "writer", status: "finished" })).toBe("read")
  })

  it("rejects Viewers, outsiders of Public stories and pending invitees", () => {
    expect(decideAccess({ ...outline, role: "viewer" })).toBeNull()
    expect(decideAccess({ ...outline, visibility: "public" })).toBeNull()
    expect(decideAccess({ ...outline, invited: true })).toBeNull()
  })
})

describe("isOutdated", () => {
  it("accepts only this schema version", () => {
    expect(isOutdated(String(SCHEMA_VERSION))).toBe(false)
    expect(isOutdated(String(SCHEMA_VERSION - 1))).toBe(true)
    expect(isOutdated(String(SCHEMA_VERSION + 1))).toBe(true)
  })

  it("treats a client that sends no version as outdated", () => {
    expect(isOutdated(null)).toBe(true)
    expect(isOutdated("")).toBe(true)
    expect(isOutdated("abc")).toBe(true)
  })
})

describe("parseToken", () => {
  it("passes a plain token through", () => {
    expect(parseToken("jwt")).toEqual({ jwt: "jwt", reference: false })
    expect(parseToken("")).toEqual({ jwt: null, reference: false })
  })

  it("strips the reference prefix", () => {
    expect(parseToken("ref:jwt")).toEqual({ jwt: "jwt", reference: true })
    expect(parseToken("ref:")).toEqual({ jwt: null, reference: true })
  })
})
