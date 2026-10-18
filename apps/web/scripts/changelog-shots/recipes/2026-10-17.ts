import type { Page } from "playwright";
import { adminClient } from "../demo";
import { BASE_URL, loadEnv } from "../env";
import type { Database } from "../../../src/lib/supabase/database.types";
import type { Shot, ShotContext } from "../shot";

const chapter: Shot["path"] = (ctx) => `/stories/${ctx.storyId}/chapters/${ctx.chapterIds[0]}`;
const LAST_TEXT = "Lamp lit at dusk";
const LAST = `.ProseMirror p:has-text('${LAST_TEXT}')`;
const LIST = ".ProseMirror > ol";

let admin: ReturnType<typeof adminClient> | undefined;
const db = () => (admin ??= adminClient(loadEnv()));
const added: string[] = [];

/** Whole-document and Story Notes have no passage, so they can go straight into the table. */
async function addNotes(notes: Omit<Database["public"]["Tables"]["notes"]["Insert"], "id">[]) {
  const rows = notes.map((note) => ({ ...note, id: crypto.randomUUID() }));
  const { error } = await db().from("notes").insert(rows);
  if (error) throw new Error(`Couldn't add the demo Notes: ${error.message}`);
  added.push(...rows.map((n) => n.id));
}

async function removeNotes() {
  if (added.length) await db().from("notes").delete().in("id", added.splice(0));
}

/** As in `2026-10-14.ts`: the caret can only reach the chapter's end through the DOM selection. */
async function selectAfterLast(page: Page) {
  const editor = page.locator(".ProseMirror").first();
  await page.locator(LAST).waitFor();
  await page.waitForTimeout(1000);
  await editor.focus();
  await editor.evaluate((el, text) => {
    const last = [...el.children].find((c) => c.textContent!.startsWith(text))!;
    const range = document.createRange();
    range.setStart(last, last.childNodes.length);
    range.setEnd(el.lastElementChild!, el.lastElementChild!.childNodes.length);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
  }, LAST_TEXT);
  await page.waitForTimeout(300);
}

let visibility: { visibility: "public" | "private"; hidden_from_front: boolean } | null = null;

const shots: Shot[] = [
  {
    name: "chapter-lists",
    as: "host",
    path: chapter,
    viewport: { width: 1000, height: 700 },
    frame: [LAST, LIST],
    setup: async (page) => {
      await selectAfterLast(page);
      await page.keyboard.press("Enter");
      // The fixture's last paragraph is italic, and Enter carries that over.
      if (await page.locator("button[aria-label='Italic'][aria-pressed='true']").isVisible()) await page.keyboard.press("Control+I");
      await page.getByRole("button", { name: "Numbered list" }).first().click();
      await page.keyboard.type("Oil for nine nights, if we're careful.", { delay: 10 });
      await page.keyboard.press("Enter");
      await page.keyboard.type("The bell, unwrapped.", { delay: 10 });
      await page.keyboard.press("Enter");
      await page.keyboard.press("Tab");
      await page.keyboard.type("Blanket gone into the fog.", { delay: 10 });
      await page.keyboard.press("Enter");
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.type("Hale, not seen.", { delay: 10 });
      await page.locator(LIST).waitFor();
      await page.waitForTimeout(500);
    },
    cleanup: async (page) => {
      if (!(await page.locator(LIST).count())) return;
      await selectAfterLast(page);
      await page.keyboard.press("Delete");
      await page.waitForTimeout(1000);
    },
  },
  {
    name: "whole-chapter-note",
    as: "host",
    path: chapter,
    viewport: { width: 1600, height: 700 },
    frame: ["span.smallcaps:has-text('Chapter 1')", "h1", "[data-note-margin] > div"],
    setup: async (page, ctx) => {
      await addNotes([
        {
          story_id: ctx.storyId,
          chapter_id: ctx.chapterIds[0]!,
          author_id: ctx.users.writer.id,
          body: "Should Marta see the lamp turning from the boat, before she lands?",
        },
      ]);
      await page.reload();
      await page.locator("[data-note-margin] > div").first().waitFor();
      await page.waitForTimeout(800);
    },
    cleanup: removeNotes,
  },
  {
    name: "story-notes",
    as: "host",
    path: (ctx) => `/stories/${ctx.storyId}`,
    viewport: { width: 1000, height: 800 },
    frame: ["#overview-notes", "section[aria-labelledby='overview-notes'] ol"],
    setup: async (page, ctx) => {
      await addNotes([
        {
          story_id: ctx.storyId,
          author_id: ctx.users.host.id,
          body: "Do we ever say what year this is? I'd keep it vague.",
        },
        {
          story_id: ctx.storyId,
          author_id: ctx.users.writer.id,
          body: "I'll take the chapter after The Long Night if nobody's claimed it.",
        },
      ]);
      await page.reload();
      const section = page.locator("section[aria-labelledby='overview-notes']");
      await section.waitFor();
      // The desk footer and Next's dev issue badge both sit in the frame's bottom padding.
      await page.addStyleTag({ content: "footer, nextjs-portal { visibility: hidden !important; }" });
      await page.waitForTimeout(500);
    },
    cleanup: removeNotes,
  },
  {
    name: "story-card",
    as: "signedOut",
    path: "/",
    viewport: { width: 1300, height: 700 },
    frame: "img",
    setup: async (page, ctx: ShotContext) => {
      const { data } = await db().from("stories").select("visibility, hidden_from_front").eq("id", ctx.storyId).single();
      visibility = data;
      await db().from("stories").update({ visibility: "public", hidden_from_front: true }).eq("id", ctx.storyId);
      await page.goto(`${BASE_URL}/stories/${ctx.storyId}`);
      const image = await page.locator("meta[property='og:image']").first().getAttribute("content");
      if (!image) throw new Error("The story page has no og:image.");
      // metadataBase points it at production.
      await page.goto(BASE_URL + new URL(image).pathname + new URL(image).search);
      await page.locator("img").waitFor();
      await page.waitForTimeout(500);
    },
    cleanup: async (_page, ctx) => {
      if (visibility) await db().from("stories").update(visibility).eq("id", ctx.storyId);
      visibility = null;
    },
  },
];
export default shots;
