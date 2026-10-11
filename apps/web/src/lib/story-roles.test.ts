import { describe, expect, it } from "vitest";
import {
  atLeast,
  canChangeRole,
  canDeleteEntries,
  canDeleteNote,
  canLeave,
  canManageChapters,
  canManageInvites,
  canRemove,
  canSwapViewer,
  isWriter,
  type MemberRole,
} from "./story-roles";

const ROLES: MemberRole[] = ["viewer", "writer", "cohost", "host"];

describe("atLeast", () => {
  it("orders viewer < writer < cohost < host", () => {
    expect(atLeast("viewer", "writer")).toBe(false);
    expect(atLeast("host", "cohost")).toBe(true);
    expect(atLeast("cohost", "cohost")).toBe(true);
    expect(atLeast("writer", "cohost")).toBe(false);
  });

  it("treats non-members as below every role", () => {
    expect(atLeast(null, "writer")).toBe(false);
    expect(atLeast(undefined, "writer")).toBe(false);
  });
});

describe("isWriter", () => {
  it("is every member but a Viewer", () => {
    expect(ROLES.filter((r) => isWriter(r))).toEqual(["writer", "cohost", "host"]);
    expect(isWriter(null)).toBe(false);
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

  it("lets the Host remove Viewers, Writers and Co-hosts", () => {
    expect(allowed("host")).toEqual(["viewer", "writer", "cohost"]);
  });

  it("lets Co-hosts remove Viewers and Writers but not other Co-hosts", () => {
    expect(allowed("cohost")).toEqual(["viewer", "writer"]);
  });

  it("lets Viewers, Writers and non-members remove nobody", () => {
    expect(allowed("viewer")).toEqual([]);
    expect(allowed("writer")).toEqual([]);
    expect(allowed(null)).toEqual([]);
  });
});

describe("canChangeRole", () => {
  it("is Host-only and targets only Writers and Co-hosts", () => {
    expect(ROLES.filter((t) => canChangeRole("host", t))).toEqual(["writer", "cohost"]);
    expect(ROLES.filter((t) => canChangeRole("cohost", t))).toEqual([]);
  });
});

describe("canSwapViewer", () => {
  it("lets Co-hosts and the Host swap Writers and Viewers on Private stories", () => {
    expect(ROLES.filter((t) => canSwapViewer("host", t, true))).toEqual(["viewer", "writer"]);
    expect(ROLES.filter((t) => canSwapViewer("cohost", t, true))).toEqual(["viewer", "writer"]);
    expect(ROLES.filter((t) => canSwapViewer("writer", t, true))).toEqual([]);
  });

  it("is never allowed on Public stories", () => {
    expect(ROLES.filter((t) => canSwapViewer("host", t, false))).toEqual([]);
  });
});

describe("canLeave", () => {
  it("keeps the Host from leaving", () => {
    expect(ROLES.filter((r) => canLeave(r))).toEqual(["viewer", "writer", "cohost"]);
    expect(canLeave(null)).toBe(false);
  });
});

describe("canDeleteNote", () => {
  it("lets the writer delete their own, and Co-hosts and the Host delete anyone's", () => {
    expect(ROLES.filter((r) => canDeleteNote(r, true))).toEqual(["writer", "cohost", "host"]);
    expect(ROLES.filter((r) => canDeleteNote(r, false))).toEqual(["cohost", "host"]);
  });

  it("never lets a Viewer or non-member delete", () => {
    expect(canDeleteNote("viewer", true)).toBe(false);
    expect(canDeleteNote(null, true)).toBe(false);
  });
});
