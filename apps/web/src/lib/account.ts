import { slug } from "./story-file/slug";
import type { Json } from "./supabase/database.types";
import { isWriter, type MemberRole } from "./story-roles";
import { toEditableText } from "./writer-mentions";

type MembershipRow = {
  role: MemberRole;
  story: {
    id: string;
    title: string;
    members: { role: MemberRole; joined_at: string; profile: { id: string; username: string } }[];
  };
};

export type HandOver = {
  id: string;
  title: string;
  /** Who could take over: Co-hosts first, then Writers, each in join order. */
  writers: { id: string; username: string; role: MemberRole }[];
};

/**
 * Splits the live Stories a User Hosts the way delete_account (0043) does: those with other Writers need a new
 * Host first, the rest are deleted with the account. Viewers don't count.
 */
export function hostedStories(rows: MembershipRow[], userId: string) {
  const handOver: HandOver[] = [];
  const solo: { id: string; title: string }[] = [];
  for (const { role, story } of rows) {
    if (role !== "host") continue;
    const writers = story.members
      .filter((m) => m.profile.id !== userId && isWriter(m.role))
      .sort(
        (a, b) => Number(b.role === "cohost") - Number(a.role === "cohost") || a.joined_at.localeCompare(b.joined_at)
      )
      .map((m) => ({ id: m.profile.id, username: m.profile.username, role: m.role }));
    if (writers.length) handOver.push({ id: story.id, title: story.title, writers });
    else solo.push({ id: story.id, title: story.title });
  }
  return { handOver, solo };
}

type Message = { body: string };

/** The parts of account_export's result this file reads; everything else passes through untouched. */
export type AccountData = {
  story_chat: Message[];
  notes: Message[];
  note_replies: Message[];
  [key: string]: Json | Message[];
};

/** The zip's files by path. A Story with no Markdown couldn't be exported and is listed as `unavailable`. */
export function accountFiles(
  account: AccountData,
  stories: { title: string; markdown: string | null }[]
): Record<string, string> {
  const files: Record<string, string> = {};
  const unavailable: string[] = [];
  const taken = new Set<string>();
  for (const { title, markdown } of stories) {
    if (markdown === null) {
      unavailable.push(title);
      continue;
    }
    const base = slug(title);
    let name = base;
    for (let n = 2; taken.has(name); n++) name = `${base}-${n}`;
    taken.add(name);
    files[`stories/${name}.md`] = markdown;
  }
  return { "account.json": `${JSON.stringify({ ...account, unavailable }, null, 2)}\n`, ...files };
}

/** Writer Mentions are stored as profile ids; the file shows them as `@username`, as Coscribe does. */
export function withMentionNames(account: AccountData, names: Map<string, string>): AccountData {
  const named = <T extends Message>(list: T[]) =>
    list.map((m) => ({ ...m, body: toEditableText(m.body, (id) => names.get(id) ?? "someone") }));
  return {
    ...account,
    story_chat: named(account.story_chat),
    notes: named(account.notes),
    note_replies: named(account.note_replies),
  };
}

export function accountMessages(account: AccountData): Message[] {
  return [...account.story_chat, ...account.notes, ...account.note_replies];
}
