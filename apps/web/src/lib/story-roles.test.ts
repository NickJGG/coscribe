import { describe, expect, it } from "vitest";
import {
  atLeast,
  canChangeRole,
  canDeleteEntries,
  canLeave,
  canManageChapters,
  canManageInvites,
  canRemove,
  type MemberRole,
} from "./story-roles";

const ROLES: MemberRole[] = ["writer", "cohost", "host"];

describe("atLeast", () => {
  it("orders writer < cohost < host", () => {
    expect(atLeast("host", "cohost")).toBe(true);
    expect(atLeast("cohost", "cohost")).toBe(true);
    expect(atLeast("writer", "cohost")).toBe(false);
  });

  it("treats non-members as below every role", () => {
    expect(atLeast(null, "writer")).toBe(false);
    expect(atLeast(undefined, "writer")).toBe(false);
  });
});

describe("canManageInvites", () => {
  it("allows Co-hosts and the Host only", () => {
    expect(ROLES.filter((r) => canManageInvites(r))).toEqual(["cohost", "host"]);
    expect(canManageInvites(null)).toBe(false);
  });
});

describe("canManageChapters", () => {
  it("allows Co-hosts and the Host only", () => {
    expect(ROLES.filter((r) => canManageChapters(r))).toEqual(["cohost", "host"]);
    expect(canManageChapters(null)).toBe(false);
  });
});

describe("canDeleteEntries", () => {
  it("allows Co-hosts and the Host only", () => {
    expect(ROLES.filter((r) => canDeleteEntries(r))).toEqual(["cohost", "host"]);
    expect(canDeleteEntries(null)).toBe(false);
  });
});

describe("canRemove", () => {
  const allowed = (actor: MemberRole | null) => ROLES.filter((target) => canRemove(actor, target));

  it("lets the Host remove Writers and Co-hosts", () => {
    expect(allowed("host")).toEqual(["writer", "cohost"]);
  });

  it("lets Co-hosts remove Writers but not other Co-hosts", () => {
    expect(allowed("cohost")).toEqual(["writer"]);
  });

  it("lets Writers and non-members remove nobody", () => {
    expect(allowed("writer")).toEqual([]);
    expect(allowed(null)).toEqual([]);
  });
});

describe("canChangeRole", () => {
  it("is Host-only and never targets the Host", () => {
    expect(ROLES.filter((t) => canChangeRole("host", t))).toEqual(["writer", "cohost"]);
    expect(ROLES.filter((t) => canChangeRole("cohost", t))).toEqual([]);
  });
});

describe("canLeave", () => {
  it("keeps the Host from leaving", () => {
    expect(ROLES.filter((r) => canLeave(r))).toEqual(["writer", "cohost"]);
    expect(canLeave(null)).toBe(false);
  });
});
