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
  friend_requester: null,
  friend_addressee: null,
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

  it("names the new Host", () => {
    expect(notificationVerb({ kind: "host_changed", detail: { host_username: "juno" } })).toBe("made juno Host of");
    expect(notificationVerb({ kind: "host_changed", detail: {} })).toBe("changed the Host of");
  });

  it("covers reopening and friend requests", () => {
    expect(notificationVerb({ kind: "story_reopened", detail: {} })).toBe("reopened");
    expect(notificationVerb({ kind: "friend_request", detail: {} })).toBe("sent you a friend request");
    expect(notificationVerb({ kind: "friend_accepted", detail: {} })).toBe("accepted your friend request");
  });

  it("names what went to and came back from the Trash", () => {
    expect(notificationVerb({ kind: "moved_to_trash", detail: { title: "The Tide" } })).toBe(
      "moved “The Tide” to the Trash in"
    );
    expect(notificationVerb({ kind: "restored", detail: { title: "Juno" } })).toBe("restored “Juno” in");
    expect(notificationVerb({ kind: "story_restored", detail: {} })).toBe("restored");
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
    expect(notificationHref({ ...base, kind: "story_reopened" })).toBe("/stories/s1");
    expect(notificationHref({ ...base, kind: "host_changed" })).toBe("/stories/s1");
  });

  it("links an accepted friend request to their profile, and a pending one nowhere", () => {
    const friend = { ...base, story_id: null, story_title: null, friend_requester: "u2", friend_addressee: "u1" };
    expect(notificationHref({ ...friend, kind: "friend_accepted" })).toBe("/u/theo");
    expect(notificationHref({ ...friend, kind: "friend_accepted", actor: null })).toBeNull();
    expect(notificationHref({ ...friend, kind: "friend_request" })).toBeNull();
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

  it("opens the Trash, or what came back out of it", () => {
    expect(notificationHref({ ...base, kind: "moved_to_trash" })).toBe("/stories/s1/settings/trash");
    const restored = { ...base, kind: "restored" as const };
    expect(notificationHref({ ...restored, detail: { item_kind: "chapter", item_id: "c9" } })).toBe(
      "/stories/s1/chapters/c9"
    );
    expect(notificationHref({ ...restored, detail: { item_kind: "entry", item_id: "e4" } })).toBe(
      "/stories/s1/bible/e4"
    );
    expect(notificationHref(restored)).toBe("/stories/s1");
    expect(notificationHref({ ...base, kind: "story_restored" })).toBe("/stories/s1");
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
