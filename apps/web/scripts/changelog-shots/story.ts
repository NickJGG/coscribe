import { readFileSync } from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Browser } from "playwright";
import type { Database } from "../../src/lib/supabase/database.types";
import type { DemoUser } from "./demo";
import { BASE_URL, fail } from "./env";
import type { Session } from "./session";

export type DemoStory = { storyId: string; chapterIds: string[]; entryIds: string[] };

const FIXTURE = path.join(import.meta.dirname, "fixture/story.md");

/** The demo Story, imported through the real UI as the Host the first time, with the Writer joined by invite link. */
export async function demoStory(
  browser: Browser,
  admin: SupabaseClient<Database>,
  users: Record<"host" | "writer", DemoUser>,
  sessions: Record<"host" | "writer", Session>
): Promise<DemoStory> {
  const title = fixtureTitle();
  const storyId = (await findStory(admin, title, users.host.id)) ?? (await importStory(browser, sessions.host));

  const { data: member } = await admin
    .from("story_members")
    .select("role")
    .eq("story_id", storyId)
    .eq("user_id", users.writer.id)
    .maybeSingle();
  if (!member) {
    const invite = await sessions.host.client.rpc("create_invite_link", { p_story: storyId, p_role: "writer" });
    if (invite.error) fail(`Couldn't make an invite link: ${invite.error.message}`);
    const joined = await sessions.writer.client.rpc("accept_invite_link", { p_token: invite.data });
    if (joined.error) fail(`The demo Writer couldn't join: ${joined.error.message}`);
  }

  const [chapters, entries] = await Promise.all([
    admin.from("chapters").select("id").eq("story_id", storyId).is("deleted_at", null).order("position"),
    admin.from("entries").select("id").eq("story_id", storyId).is("deleted_at", null).order("position"),
  ]);
  if (chapters.error || entries.error) fail(`Couldn't read the demo Story: ${(chapters.error ?? entries.error)!.message}`);
  return {
    storyId,
    chapterIds: chapters.data.map((c) => c.id),
    entryIds: entries.data.map((e) => e.id),
  };
}

function fixtureTitle(): string {
  const match = /^title: (.+)$/m.exec(readFileSync(FIXTURE, "utf8"));
  if (!match) fail("The fixture has no title.");
  return JSON.parse(match[1]!) as string;
}

async function findStory(admin: SupabaseClient<Database>, title: string, hostId: string) {
  const { data, error } = await admin
    .from("stories")
    .select("id, story_members!inner(user_id, role)")
    .eq("title", title)
    .is("deleted_at", null)
    .eq("story_members.user_id", hostId)
    .eq("story_members.role", "host")
    .limit(1);
  if (error) fail(`Couldn't look up the demo Story: ${error.message}`);
  return data[0]?.id ?? null;
}

async function importStory(browser: Browser, host: Session): Promise<string> {
  const context = await browser.newContext();
  await context.addCookies(host.cookies);
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/stories/new?from=file`);
  await page.setInputFiles("#import-file", FIXTURE);
  await page.getByRole("radio", { name: /Public/ }).check();
  await page.getByRole("button", { name: "Import story" }).click();
  await page.waitForURL(/\/stories\/[0-9a-f-]{36}(\/|$)/, { timeout: 30_000 }).catch(async () => {
    const alert = await page.getByRole("alert").allInnerTexts();
    fail(`The demo Story's import didn't finish at ${page.url()}: ${alert.join(" ") || "no error shown"}`);
  });
  const storyId = /\/stories\/([0-9a-f-]{36})/.exec(page.url())![1]!;
  await context.close();
  console.log(`Imported the demo Story: ${BASE_URL}/stories/${storyId}`);
  return storyId;
}
