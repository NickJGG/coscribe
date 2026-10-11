import { describe, expect, it } from "vitest";
import {
  isStoryNotify,
  notificationActor,
  notificationHref,
  notificationVerb,
  type Notification,
} from "./notifications";

const base: Notification = {
  id: "n1",
  kind: "writer_joined",
  story_id: "s1",
  story_title: "Gull Point",
  invite_id: null,
  note_id: null,
  detail: {},
  created_at: "2026-10-07T10:00:00Z",
  read_at: null,
  actor: { id: "u1", username: "theo", author_color: "#2a6f97" },
};

describe("notificationVerb", () => {
  it("names the new Chapter", () => {
    expect(notificationVerb({ kind: "chapter_added", detail: { chapter_title: "The Tide" } })).toBe(
      "added “The Tide” to"
    );
    expect(notificationVerb({ kind: "chapter_added", detail: {} })).toBe("added a Chapter to");
  });

  it("names the Note's Chapter", () => {
    expect(notificationVerb({ kind: "note_reply", detail: { chapter_title: "The Tide" } })).toBe(
      "replied to a Note on “The Tide” in"
    );
    expect(notificationVerb({ kind: "note_resolved", detail: {} })).toBe("resolved your Note in");
  });

  it("says where you were mentioned", () => {
    expect(notificationVerb({ kind: "note_mention", detail: { chapter_title: "The Tide" } })).toBe(
      "mentioned you in a Note on “The Tide” in"
    );
    expect(notificationVerb({ kind: "note_mention", detail: {} })).toBe("mentioned you in a Note in");
    expect(notificationVerb({ kind: "chat_mention", detail: {} })).toBe("mentioned you in Story Chat in");
  });

  it("says whether an Invite is to write or to read", () => {
    expect(notificationVerb({ kind: "invite_received", detail: {} })).toBe("invited you to write in");
    expect(notificationVerb({ kind: "invite_received", detail: { role: "viewer" } })).toBe("invited you to read");
  });

  it("says which role", () => {
    expect(notificationVerb({ kind: "role_changed", detail: { role: "cohost" } })).toBe("made you a Co-host in");
    expect(notificationVerb({ kind: "role_changed", detail: { role: "host" } })).toBe("handed you Host of");
    expect(notificationVerb({ kind: "role_changed", detail: { role: "nonsense" } })).toBe("changed your role in");
  });
});

describe("notificationActor", () => {
  it("falls back to Someone when the account is gone", () => {
    expect(notificationActor(base)).toBe("theo");
    expect(notificationActor({ actor: null })).toBe("Someone");
  });
});

describe("notificationHref", () => {
  it("links to the Story, the new Chapter, or the Reader", () => {
    expect(notificationHref(base)).toBe("/stories/s1");
    expect(notificationHref({ ...base, kind: "chapter_added", detail: { chapter_id: "c9" } })).toBe(
      "/stories/s1/chapters/c9"
    );
    expect(notificationHref({ ...base, kind: "story_finished" })).toBe("/stories/s1/read");
  });

  it("opens the Chapter with the Note active", () => {
    const reply = { ...base, kind: "note_reply" as const, note_id: "n7", detail: { chapter_id: "c9" } };
    expect(notificationHref(reply)).toBe("/stories/s1/chapters/c9?note=n7");
    expect(notificationHref({ ...reply, kind: "note_resolved" })).toBe("/stories/s1/chapters/c9?note=n7");
    expect(notificationHref({ ...reply, kind: "note_mention" })).toBe("/stories/s1/chapters/c9?note=n7");
    expect(notificationHref({ ...reply, note_id: null })).toBe("/stories/s1/chapters/c9");
  });

  it("opens Story Chat at the message", () => {
    const mention = { ...base, kind: "chat_mention" as const, detail: { message_id: "m3" } };
    expect(notificationHref(mention)).toBe("/stories/s1?chat=m3");
    expect(notificationHref({ ...mention, detail: {} })).toBe("/stories/s1");
  });

  it("has no link once the Story is gone or you were removed", () => {
    expect(notificationHref({ ...base, story_id: null })).toBeNull();
    expect(notificationHref({ ...base, kind: "story_deleted" })).toBeNull();
    expect(notificationHref({ ...base, kind: "removed" })).toBeNull();
  });
});

describe("isStoryNotify", () => {
  it("accepts only the two choices", () => {
    expect(isStoryNotify("all")).toBe(true);
    expect(isStoryNotify("mine")).toBe(true);
    expect(isStoryNotify("none")).toBe(false);
    expect(isStoryNotify(undefined)).toBe(false);
  });
});
