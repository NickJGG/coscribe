import type { Shot } from "../shot";

const VOICE_ROW = "div:has(> span[aria-label='Pitch'])";
const PLAYER = "[data-narration-player]";

const shots: Shot[] = [
  {
    name: "listen",
    as: "host",
    path: (ctx) => `/stories/${ctx.storyId}/chapters/${ctx.chapterIds[0]}`,
    viewport: { width: 1000, height: 700 },
    frame: [".ProseMirror p:has-text('The relief boat left Marta')", PLAYER],
    setup: async (page) => {
      await page.locator(".ProseMirror").first().waitFor();
      await page.waitForTimeout(1000);
      await page.getByRole("button", { name: "Listen" }).first().click();
      await page.locator(PLAYER).waitFor();
      await page.waitForTimeout(5000);
      await page.getByRole("button", { name: "Pause" }).click();
      // The desk footer sits inside the frame's bottom padding.
      await page.locator(PLAYER).evaluate((player) => {
        if (player.nextElementSibling instanceof HTMLElement) player.nextElementSibling.style.visibility = "hidden";
      });
      await page.waitForTimeout(300);
    },
    cleanup: async (page) => {
      await page.getByRole("button", { name: "Stop" }).click().catch(() => {});
    },
  },
  {
    name: "character-voice",
    as: "host",
    path: (ctx) => `/stories/${ctx.storyId}/bible/${ctx.entryIds[0]}`,
    viewport: { width: 1000, height: 700 },
    frame: ["header:has(h1)", VOICE_ROW],
    setup: async (page) => {
      await page.locator(VOICE_ROW).waitFor();
      await page.waitForTimeout(300);
    },
  },
];
export default shots;
