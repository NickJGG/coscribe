import type { Page } from "playwright";
import type { Shot } from "../shot";

const chapter: Shot["path"] = (ctx) => `/stories/${ctx.storyId}/chapters/${ctx.chapterIds[0]}`;
const LAST_TEXT = "Lamp lit at dusk";
const LAST = `.ProseMirror p:has-text('${LAST_TEXT}')`;
const ADDED = ".ProseMirror p:last-of-type";

/**
 * Selects from the end of the chapter's last fixture paragraph to the end of the editor. Clicking and
 * Control+End both leave the caret at the start of the chapter, so the selection is set on the DOM instead.
 */
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

/** Types a new paragraph at the end of the first chapter. `lines` after the first go in with Shift+Enter. */
async function addParagraph(page: Page, ...lines: string[]) {
  await selectAfterLast(page);
  await page.keyboard.press("Enter");
  if ((await page.locator(ADDED).textContent()) !== "") throw new Error("The new paragraph isn't the last one.");
  // The fixture's last paragraph is italic, and Enter carries that over.
  if (await page.locator("button[aria-label='Italic'][aria-pressed='true']").isVisible()) await page.keyboard.press("Control+I");
  for (const [i, line] of lines.entries()) {
    if (i > 0) await page.keyboard.press("Shift+Enter");
    await page.keyboard.type(line, { delay: 10 });
  }
  await page.waitForTimeout(300);
}

async function removeParagraph(page: Page) {
  if ((await page.locator(ADDED).textContent())?.includes(LAST_TEXT)) return;
  await selectAfterLast(page);
  await page.keyboard.press("Delete");
  await page.waitForTimeout(1000);
}

const shots: Shot[] = [
  {
    name: "smart-punctuation",
    as: "host",
    path: chapter,
    viewport: { width: 1000, height: 700 },
    frame: [LAST, ADDED],
    setup: (page) => addParagraph(page, `She called up the stair -- "Hale?" Nothing. "Keeper Hale..."`),
    cleanup: removeParagraph,
  },
  {
    name: "line-breaks",
    as: "host",
    path: chapter,
    viewport: { width: 1000, height: 700 },
    frame: [LAST, ADDED],
    setup: (page) => addParagraph(page, "Dawn. Fog to the north.", "Bell rung at six.", "No ships."),
    cleanup: removeParagraph,
  },
  {
    name: "back-to-top",
    as: "host",
    path: chapter,
    viewport: { width: 1000, height: 600 },
    frame: [LAST, "a:has-text('The Fog Bell')", "button[aria-label='Back to top']"],
    setup: async (page) => {
      await page.locator(".ProseMirror").first().waitFor();
      await page.mouse.move(600, 350);
      await page.mouse.wheel(0, 1400);
      await page.getByRole("button", { name: "Back to top" }).waitFor();
      await page.waitForTimeout(400);
    },
  },
];
export default shots;
