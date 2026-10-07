import { describe, expect, it } from "vitest";
import { relationTo, usernamePrefixPattern, type FriendshipRow } from "./friends";

describe("relationTo", () => {
  const rows: FriendshipRow[] = [
    { requester_id: "me", addressee_id: "jordan", status: "accepted" },
    { requester_id: "sam", addressee_id: "me", status: "pending" },
    { requester_id: "me", addressee_id: "lee", status: "pending" },
  ];

  it.each([
    ["jordan", "friends"],
    ["sam", "incoming"],
    ["lee", "outgoing"],
    ["kai", "none"],
  ] as const)("%s is %s", (other, relation) => {
    expect(relationTo("me", other, rows)).toBe(relation);
  });
});

describe("usernamePrefixPattern", () => {
  it("escapes underscores and appends a wildcard", () => {
    expect(usernamePrefixPattern(" Mia_W ")).toBe("mia\\_w%");
  });

  it("drops characters usernames can't contain", () => {
    expect(usernamePrefixPattern("m%i*a")).toBe("mia%");
    expect(usernamePrefixPattern("%%")).toBeNull();
  });
});
