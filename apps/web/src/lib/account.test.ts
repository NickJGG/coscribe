import { describe, expect, it } from "vitest";
import { accountFiles, hostedStories, withMentionNames, type AccountData } from "./account";
import type { MemberRole } from "./story-roles";

const ME = "me";
const member = (id: string, role: MemberRole, joined_at = "2026-01-01") => ({
  role,
  joined_at,
  profile: { id, username: id },
});
const row = (role: MemberRole, id: string, members: ReturnType<typeof member>[]) => ({
  role,
  story: { id, title: id, members },
});

describe("hostedStories", () => {
  it("needs a hand-over when another Writer is in the Story", () => {
    const { handOver, solo } = hostedStories([row("host", "a", [member(ME, "host"), member("w", "writer")])], ME);
    expect(handOver).toEqual([{ id: "a", title: "a", writers: [{ id: "w", username: "w", role: "writer" }] }]);
    expect(solo).toEqual([]);
  });

  it("deletes a Story with only Viewers besides the Host", () => {
    const { handOver, solo } = hostedStories([row("host", "a", [member(ME, "host"), member("v", "viewer")])], ME);
    expect(handOver).toEqual([]);
    expect(solo).toEqual([{ id: "a", title: "a" }]);
  });

  it("skips Stories the User doesn't Host", () => {
    const { handOver, solo } = hostedStories(
      [row("cohost", "a", [member("h", "host"), member(ME, "cohost")]), row("writer", "b", [member(ME, "writer")])],
      ME
    );
    expect(handOver).toEqual([]);
    expect(solo).toEqual([]);
  });

  it("offers Co-hosts first, then Writers in join order", () => {
    const { handOver } = hostedStories(
      [
        row("host", "a", [
          member(ME, "host"),
          member("late", "writer", "2026-03-01"),
          member("early", "writer", "2026-02-01"),
          member("co", "cohost", "2026-04-01"),
        ]),
      ],
      ME
    );
    expect(handOver[0].writers.map((w) => w.id)).toEqual(["co", "early", "late"]);
  });
});

const account: AccountData = {
  profile: { username: "ada" },
  story_chat: [{ body: "hi" }],
  notes: [],
  note_replies: [],
};

describe("accountFiles", () => {
  it("names each Story's file by its title, numbering clashes", () => {
    const files = accountFiles(account, [
      { title: "The Long Road", markdown: "a" },
      { title: "The long road!", markdown: "b" },
      { title: "The Long Road", markdown: "c" },
      { title: "???", markdown: "d" },
    ]);
    expect(Object.keys(files)).toEqual([
      "account.json",
      "stories/the-long-road.md",
      "stories/the-long-road-2.md",
      "stories/the-long-road-3.md",
      "stories/story.md",
    ]);
    expect(files["stories/the-long-road-2.md"]).toBe("b");
  });

  it("lists Stories that couldn't be exported in account.json instead of a file", () => {
    const files = accountFiles(account, [
      { title: "Gone Quiet", markdown: null },
      { title: "Here", markdown: "x" },
    ]);
    expect(Object.keys(files)).toEqual(["account.json", "stories/here.md"]);
    expect(JSON.parse(files["account.json"]!)).toEqual({ ...account, unavailable: ["Gone Quiet"] });
  });
});

describe("withMentionNames", () => {
  it("shows stored Writer Mentions as @username", () => {
    const id = "dd1f39c3-a0e2-4edc-b8c0-005c756818ae";
    const gone = "00000000-0000-4000-8000-000000000000";
    const named = withMentionNames(
      {
        ...account,
        story_chat: [{ body: `@[${id}] oh cool`, created_at: "x" } as never],
        notes: [{ body: `@[${gone}]` }],
      },
      new Map([[id, "nick"]])
    );
    expect(named.story_chat).toEqual([{ body: "@nick oh cool", created_at: "x" }]);
    expect(named.notes).toEqual([{ body: "@someone" }]);
    expect(named.profile).toEqual({ username: "ada" });
  });
});
