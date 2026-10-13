import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { ROLE_LABEL, type MemberRole } from "./story-roles";

export type NotificationKind = Database["public"]["Enums"]["notification_kind"];

/** Per-Story choice: every notification, or only those about you (no new Chapters or Writers). */
export type StoryNotify = "all" | "mine";

export function isStoryNotify(value: unknown): value is StoryNotify {
  return value === "all" || value === "mine";
}

type Person = { id: string; username: string; author_color: string };

export type Notification = {
  id: string;
  kind: NotificationKind;
  story_id: string | null;
  story_title: string | null;
  invite_id: string | null;
  note_id: string | null;
  friend_requester: string | null;
  friend_addressee: string | null;
  detail: Json;
  created_at: string;
  read_at: string | null;
  actor: Person | null;
};

export const NOTIFICATION_COLUMNS =
  "id, kind, story_id, story_title, invite_id, note_id, friend_requester, friend_addressee, detail, created_at, read_at, actor:profiles!notifications_actor_id_fkey (id, username, author_color)";

/** How many the Notifications dropdown shows, and how many each "See all" page shows. */
export const LATEST_SHOWN = 8;
export const PAGE_SIZE = 30;

export type LatestNotifications = { latest: Notification[]; unread: number };

/** The dropdown's newest few and the unread count. Works with the server or the browser client. */
export async function loadLatestNotifications(supabase: SupabaseClient<Database>): Promise<LatestNotifications> {
  const [latest, unread] = await Promise.all([
    supabase
      .from("notifications")
      .select(NOTIFICATION_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(LATEST_SHOWN),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);
  return { latest: latest.data ?? [], unread: unread.count ?? 0 };
}

function detailText(detail: Json, key: string): string | null {
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) return null;
  const value = detail[key];
  return typeof value === "string" ? value : null;
}

/** An `invite_received` for a Viewer Invite. */
export function isViewerInvite(n: Pick<Notification, "detail">): boolean {
  return detailText(n.detail, "role") === "viewer";
}

/** Who did it: the actor's username, or "Someone" once their account is gone. */
export function notificationActor(n: Pick<Notification, "actor">): string {
  return n.actor?.username ?? "Someone";
}

/**
 * The words between the actor and the Story title: "theo <added “The Tide” to> Gull Point". Friend
 * notifications have no Story, so their verb is the whole sentence.
 */
export function notificationVerb(n: Pick<Notification, "kind" | "detail">): string {
  switch (n.kind) {
    case "invite_received":
      return isViewerInvite(n) ? "invited you to read" : "invited you to write in";
    case "writer_joined":
      return "joined";
    case "chapter_added": {
      const title = detailText(n.detail, "chapter_title");
      return title ? `added “${title}” to` : "added a Chapter to";
    }
    case "story_finished":
      return "finished";
    case "story_reopened":
      return "reopened";
    case "host_changed": {
      const host = detailText(n.detail, "host_username");
      return host ? `made ${host} Host of` : "changed the Host of";
    }
    case "friend_request":
      return "sent you a friend request";
    case "friend_accepted":
      return "accepted your friend request";
    case "story_deleted":
      return "deleted";
    case "story_restored":
      return "restored";
    case "moved_to_trash": {
      const title = detailText(n.detail, "title");
      return title ? `moved “${title}” to the Trash in` : "moved something to the Trash in";
    }
    case "restored": {
      const title = detailText(n.detail, "title");
      return title ? `restored “${title}” in` : "restored something in";
    }
    case "removed":
      return "removed you from";
    case "note_reply": {
      const title = detailText(n.detail, "chapter_title");
      return title ? `replied to a Note on “${title}” in` : "replied to a Note in";
    }
    case "note_mention": {
      const title = detailText(n.detail, "chapter_title");
      return title ? `mentioned you in a Note on “${title}” in` : "mentioned you in a Note in";
    }
    case "chat_mention":
      return "mentioned you in Story Chat in";
    case "note_resolved": {
      const title = detailText(n.detail, "chapter_title");
      return title ? `resolved your Note on “${title}” in` : "resolved your Note in";
    }
    case "role_changed": {
      const role = detailText(n.detail, "role") as MemberRole | null;
      if (role === "host") return "handed you Host of";
      return role && role in ROLE_LABEL ? `made you a ${ROLE_LABEL[role]} in` : "changed your role in";
    }
  }
}

/**
 * Where clicking it goes, or null when there's nowhere left to go (Story deleted, you were removed, or the
 * actor's account is gone). A friend request has none: like an Invite, it carries buttons.
 */
export function notificationHref(
  n: Pick<Notification, "kind" | "story_id" | "note_id" | "detail" | "actor">
): string | null {
  if (n.kind === "friend_request") return null;
  if (n.kind === "friend_accepted") return n.actor ? `/u/${n.actor.username}` : null;
  if (!n.story_id || n.kind === "story_deleted" || n.kind === "removed") return null;
  const story = `/stories/${n.story_id}`;
  if (n.kind === "note_reply" || n.kind === "note_mention" || n.kind === "note_resolved") {
    const chapter = detailText(n.detail, "chapter_id");
    if (!chapter) return story;
    return n.note_id ? `${story}/chapters/${chapter}?note=${n.note_id}` : `${story}/chapters/${chapter}`;
  }
  if (n.kind === "chapter_added") {
    const chapter = detailText(n.detail, "chapter_id");
    return chapter ? `${story}/chapters/${chapter}` : story;
  }
  if (n.kind === "chat_mention") {
    const message = detailText(n.detail, "message_id");
    return message ? `${story}?chat=${message}` : story;
  }
  if (n.kind === "story_finished") return `${story}/read`;
  return story;
}
