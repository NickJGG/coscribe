/**
 * Download your data: one .zip of `account.json` (account_export, 0044) and a Markdown Export of every live Story
 * the User writes in, with its Story Bible and Outlines.
 */
import { strToU8, zipSync } from "fflate";
import { accountFiles, accountMessages, withMentionNames, type AccountData } from "./account";
import { getExport } from "./export";
import { toMarkdown } from "./story-file/markdown";
import { createClient } from "./supabase/server";
import { isWriter } from "./story-roles";
import { writerMentionIds } from "./writer-mentions";

const OPTIONS = { bible: true, outlines: true };
const CONCURRENCY = 3;

export async function buildAccountZip(userId: string): Promise<Uint8Array> {
  const supabase = await createClient();
  const [{ data, error }, { data: memberships }] = await Promise.all([
    supabase.rpc("account_export"),
    supabase
      .from("story_members")
      .select("role, story:stories!inner (id, title)")
      .eq("user_id", userId)
      .is("story.deleted_at", null)
      .order("joined_at"),
  ]);
  if (error || !data) throw new Error(`account_export failed: ${error?.message}`);
  const account = data as AccountData;

  const stories = (memberships ?? [])
    .filter((m) => isWriter(m.role))
    .map((m) => m.story);
  const ids = [...new Set(accountMessages(account).flatMap((m) => writerMentionIds(m.body)))];

  const [markdown, { data: people }] = await Promise.all([
    mapLimited(stories, CONCURRENCY, async (story) => {
      const file = await getExport(story.id, OPTIONS).catch(() => "unavailable" as const);
      return { title: story.title, markdown: typeof file === "string" ? null : toMarkdown(file, OPTIONS) };
    }),
    ids.length ? supabase.from("profiles").select("id, username").in("id", ids) : { data: [] },
  ]);
  const names = new Map((people ?? []).map((p) => [p.id, p.username]));

  const files = accountFiles(withMentionNames(account, names), markdown);
  return zipSync(Object.fromEntries(Object.entries(files).map(([name, text]) => [name, strToU8(text)])), { level: 9 });
}

/** Each sync call can take its full 5s timeout, so a few at a time rather than all at once or one by one. */
async function mapLimited<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
