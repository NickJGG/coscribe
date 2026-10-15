/**
 * Changelog screenshots: `pnpm changelog:shots <date>` runs `recipes/<date>.ts` against the local dev servers, as
 * local-only demo accounts on a demo Story, and writes `public/changelog/<date>/<name>.webp` and `<name>.dark.webp`.
 * Start `pnpm dev` and `pnpm dev:sync` first; this never starts them.
 */
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import sharp from "sharp";
import { adminClient, demoUsers, type Role } from "./demo";
import { BASE_URL, WEB_DIR, checkServers, fail, loadEnv } from "./env";
import { signIn, type Session } from "./session";
import type { Shot, ShotContext } from "./shot";
import { demoStory } from "./story";

const MAX_BYTES = 1024 * 1024;
const THEMES = ["light", "dark"] as const;

const date = process.argv[2] ?? "";
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail("Usage: pnpm changelog:shots <YYYY-MM-DD>");
const recipe = path.join(import.meta.dirname, "recipes", `${date}.ts`);
if (!existsSync(recipe)) fail(`No recipe at ${path.relative(process.cwd(), recipe)}.`);
const { default: shots } = (await import(pathToFileURL(recipe).href)) as { default: Shot[] };

const env = loadEnv();
await checkServers(env);

const admin = adminClient(env);
const users = await demoUsers(admin);
const sessions: Record<Role, Session> = {
  host: await signIn(env, admin, users.host.email),
  writer: await signIn(env, admin, users.writer.email),
};

const browser = await chromium.launch();
try {
  const ctx: ShotContext = { ...(await demoStory(browser, admin, users, sessions)), users };
  const outDir = path.join(WEB_DIR, "public/changelog", date);
  await mkdir(outDir, { recursive: true });

  for (const shot of shots) {
    for (const theme of THEMES) {
      const file = path.join(outDir, `${shot.name}${theme === "dark" ? ".dark" : ""}.webp`);
      const png = await take(browser, shot, theme, ctx);
      const webp = await sharp(png).webp({ quality: 85 }).toBuffer();
      await writeFile(file, webp);
      const kb = Math.round(webp.length / 1024);
      const over = webp.length > MAX_BYTES ? "  over 1 MB: crop it with a frame or a smaller viewport" : "";
      console.log(`${path.relative(process.cwd(), file)}  ${kb} KB${over}`);
    }
  }
} finally {
  await browser.close();
}

async function take(browser: Browser, shot: Shot, theme: (typeof THEMES)[number], ctx: ShotContext) {
  const url = new URL(typeof shot.path === "string" ? shot.path : shot.path(ctx), BASE_URL).href;
  const open = async (as: Shot["as"]): Promise<[BrowserContext, Page]> => {
    const context = await browser.newContext({ viewport: shot.viewport, colorScheme: theme, deviceScaleFactor: 2 });
    if (as !== "signedOut") await context.addCookies(sessions[as].cookies);
    const page = await context.newPage();
    await page.goto(url);
    // Next's dev tools badge.
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    return [context, page];
  };

  const contexts: BrowserContext[] = [];
  try {
    if (shot.with) {
      const [context, page] = await open(shot.with.as);
      contexts.push(context);
      await shot.with.setup?.(page, ctx);
    }
    const [context, page] = await open(shot.as);
    contexts.push(context);
    await shot.setup?.(page, ctx);
    await page.evaluate(() => document.fonts.ready);

    const options = { animations: "disabled", caret: "hide" } as const;
    return shot.frame ? await page.locator(shot.frame).screenshot(options) : await page.screenshot(options);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
}
