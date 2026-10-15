import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import MarkdownIt from "markdown-it";
import type { Token } from "markdown-it";
import { cache } from "react";

/**
 * Release notes, one markdown file per publish day in `src/content/changelog/<YYYY-MM-DD>.md`:
 *
 *   # Title
 *   ## New            (then Improved, Fixed; each optional, in that order)
 *   - **Lead.** Description.
 *     ![Alt text.](image.webp)
 *
 * Images live in `public/changelog/<date>/`, with an optional `<name>.dark.<ext>` shown in dark mode.
 */

export const GROUP_KINDS = ["New", "Improved", "Fixed"] as const;
export type GroupKind = (typeof GROUP_KINDS)[number];

export type UpdateImage = { src: string; darkSrc?: string; alt: string };
export type UpdateLine = { lead: string; html: string; images: UpdateImage[] };
export type UpdateGroup = { kind: GroupKind; lines: UpdateLine[] };
export type Update = { date: string; title: string; groups: UpdateGroup[] };

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const IMAGE_EXTENSIONS = [".webp", ".png", ".gif"];

/** Our own parser: the story-file one allows raw HTML. */
const md = new MarkdownIt({ html: false, linkify: true });

export function isValidDate(date: string): boolean {
  const at = new Date(`${date}T00:00:00Z`);
  return DATE_PATTERN.test(date) && !isNaN(at.getTime()) && at.toISOString().startsWith(date);
}

/** `name.webp` → `name.dark.webp`. */
export function darkName(file: string): string {
  const ext = path.extname(file);
  return `${file.slice(0, -ext.length)}.dark${ext}`;
}

/**
 * Parses one update file, throwing on anything outside the format. `hasPublicFile` takes a path under `public/`
 * and decides whether a dark variant exists.
 */
export function parseUpdate(date: string, source: string, hasPublicFile: (p: string) => boolean = () => false): Update {
  if (!isValidDate(date)) throw new Error(`"${date}" isn't a YYYY-MM-DD date`);
  const tokens = md.parse(source, {});
  let title: string | undefined;
  const groups: UpdateGroup[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token.type === "heading_open") {
      const inline = tokens[i + 1]!;
      if (inline.children?.some((c) => c.type === "image")) throw new Error("Images go under a bullet, not in a heading");
      const text = inline.content.trim();
      if (token.tag === "h1") {
        if (title !== undefined) throw new Error("Only one # title is allowed");
        if (groups.length) throw new Error("The # title comes first");
        title = text;
      } else if (token.tag === "h2") {
        if (title === undefined) throw new Error("The # title comes first");
        const kind = GROUP_KINDS.find((k) => k === text);
        if (!kind) throw new Error(`"## ${text}" isn't one of ${GROUP_KINDS.join(", ")}`);
        const last = groups.at(-1);
        if (last && !last.lines.length) throw new Error(`"## ${last.kind}" is empty`);
        if (last && GROUP_KINDS.indexOf(kind) <= GROUP_KINDS.indexOf(last.kind)) {
          throw new Error(`Groups go in the order ${GROUP_KINDS.join(", ")}, each once`);
        }
        groups.push({ kind, lines: [] });
      } else {
        throw new Error(`Only # and ## headings are allowed, not "${text}"`);
      }
      i += 2;
    } else if (token.type === "bullet_list_open") {
      const group = groups.at(-1);
      if (!group) throw new Error("A list must sit under a ## New, Improved or Fixed heading");
      const close = closingIndex(tokens, i);
      for (const item of listItems(tokens, i + 1, close)) group.lines.push(parseLine(date, item, hasPublicFile));
      i = close;
    } else if (token.type === "paragraph_open" && tokens[i + 1]!.children?.some((c) => c.type === "image")) {
      throw new Error("Images go under a bullet");
    } else {
      throw new Error(`Only headings and bullet lists are allowed, found ${token.type.replace(/_open$/, "")}`);
    }
  }

  if (!title) throw new Error("The update needs a # title");
  if (!groups.length) throw new Error("The update needs at least one ## group");
  const last = groups.at(-1)!;
  if (!last.lines.length) throw new Error(`"## ${last.kind}" is empty`);
  return { date, title, groups };
}

function closingIndex(tokens: Token[], open: number): number {
  const level = tokens[open]!.level;
  let i = open + 1;
  while (!(tokens[i]!.nesting === -1 && tokens[i]!.level === level)) i++;
  return i;
}

function listItems(tokens: Token[], from: number, to: number): Token[][] {
  const items: Token[][] = [];
  for (let i = from; i < to; i++) {
    if (tokens[i]!.type !== "list_item_open") continue;
    const close = closingIndex(tokens, i);
    items.push(tokens.slice(i + 1, close));
    i = close;
  }
  return items;
}

function parseLine(date: string, item: Token[], hasPublicFile: (p: string) => boolean): UpdateLine {
  const nested = item.find((t) => t.type !== "paragraph_open" && t.type !== "paragraph_close" && t.type !== "inline");
  if (nested) throw new Error(`A bullet can hold only text and images, found ${nested.type.replace(/_open$/, "")}`);
  // A blank line before an image makes a second paragraph; those may hold images only.
  const [first, ...more] = item.filter((t) => t.type === "inline").map((t) => t.children ?? []);
  const children = first ?? [];
  while (children[0] && isBlank(children[0])) children.shift();
  const extra = more.flat().filter((c) => !isBlank(c));
  if (extra.some((c) => c.type !== "image")) throw new Error(`A bullet is one paragraph, plus images: "${item[1]?.content}"`);

  if (children[0]?.type !== "strong_open") throw new Error(`Each bullet starts with a **Lead.**: "${item[1]?.content}"`);
  const strongClose = children.findIndex((c) => c.type === "strong_close");
  const lead = children
    .slice(1, strongClose)
    .map((c) => c.content)
    .join("")
    .trim();
  if (!lead.endsWith(".") || lead.length < 2) throw new Error(`A lead ends with a full stop: "**${lead}**"`);

  const images: UpdateImage[] = [];
  const rest: Token[] = [];
  for (const child of [...children.slice(strongClose + 1), ...extra]) {
    if (child.type === "image") images.push(parseImage(date, child, hasPublicFile));
    else rest.push(child);
  }
  while (rest[0] && isBlank(rest[0])) rest.shift();
  while (rest.at(-1) && isBlank(rest.at(-1)!)) rest.pop();
  if (rest[0]?.type === "text") rest[0].content = rest[0].content.trimStart();
  if (rest.at(-1)?.type === "text") rest.at(-1)!.content = rest.at(-1)!.content.trimEnd();

  return { lead: lead.slice(0, -1), html: md.renderer.renderInline(rest, md.options, {}), images };
}

function parseImage(date: string, token: Token, hasPublicFile: (p: string) => boolean): UpdateImage {
  const file = String(token.attrGet("src") ?? "");
  const alt = token.content.trim();
  if (!alt) throw new Error(`"${file}" needs alt text`);
  if (!/^[\w.-]+$/.test(file) || file.startsWith(".")) {
    throw new Error(`"${file}" must be a plain file name in public/changelog/${date}/`);
  }
  if (!IMAGE_EXTENSIONS.includes(path.extname(file).toLowerCase())) {
    throw new Error(`"${file}" must be ${IMAGE_EXTENSIONS.join(", ")}`);
  }
  if (file.includes(".dark.")) throw new Error(`Reference the light image, not "${file}"; its dark variant is found by name`);
  const src = `/changelog/${date}/${file}`;
  const dark = `changelog/${date}/${darkName(file)}`;
  return hasPublicFile(dark) ? { src, darkSrc: `/${dark}`, alt } : { src, alt };
}

function isBlank(token: Token): boolean {
  return token.type === "softbreak" || token.type === "hardbreak" || (token.type === "text" && !token.content.trim());
}

const root = () => process.cwd();
const contentDir = () => path.join(root(), "src/content/changelog");

function updateDates(): string[] {
  if (!existsSync(contentDir())) return [];
  return readdirSync(contentDir())
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.slice(0, -3))
    .filter(isValidDate)
    .sort()
    .reverse();
}

/** Every update, newest first. */
export const getUpdates = cache(async (): Promise<Update[]> => {
  return updateDates().map(readUpdate);
});

export const getUpdate = cache(async (date: string): Promise<Update | null> => {
  return updateDates().includes(date) ? readUpdate(date) : null;
});

/** The newest update's date, or null before the first one. */
export const latestUpdateDate = cache(async (): Promise<string | null> => updateDates()[0] ?? null);

/** The newest update's date when it's newer than `seen` (a profile's `changelog_seen`), else null. */
export async function unseenUpdateDate(seen: string): Promise<string | null> {
  const latest = await latestUpdateDate();
  return latest && latest > seen ? latest : null;
}

function readUpdate(date: string): Update {
  const source = readFileSync(path.join(contentDir(), `${date}.md`), "utf8");
  return parseUpdate(date, source, (p) => existsSync(path.join(root(), "public", p)));
}

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"' };

/** A line as plain text, lead included: "Smart punctuation. Quotes turn curly." */
export function lineText(line: UpdateLine): string {
  const text = line.html
    .replace(/<[^>]*>/g, "")
    .replace(/&(amp|lt|gt|quot);/g, (e) => ENTITIES[e]!)
    .replace(/\s+/g, " ");
  return `${line.lead}. ${text}`.trim();
}

const longDate = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

/** "October 14, 2026". */
export function formatUpdateDate(date: string): string {
  return longDate.format(new Date(`${date}T00:00:00Z`));
}
