import { describe, expect, it } from "vitest";
import { hostedStories } from "./account";
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
