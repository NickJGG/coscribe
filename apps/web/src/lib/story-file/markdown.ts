/**
 * The Story file format, also what Import reads:
 *
 *     ---
 *     title: "…"            (values are JSON)
 *     coscribe: 1
 *     ---
 *     # Chapter title
 *     <!-- coscribe:outline -->
 *     Characters: Entry, names        (`\,` and `\\` escape)
 *     ## Field label
 *     <!-- /coscribe:outline -->
 *     Text, `* * *` Scene Breaks, ```fountain Scripts
 *     <!-- coscribe:story-bible -->
 *     # Story Bible
 *     ## Entry Type group
 *     ### Entry name
 *     _Short description_
 *     Aliases: one, two
 *     <!-- coscribe:credits -->       (ignored on Import)
 *
 * Alignment, Notes and authorship aren't written. A file from elsewhere: its highest heading level present makes
 * the Chapters, with text before the first one opening the first Chapter, or with no headings it's one Chapter
 * named after the file.
 */
import type { JSONContent } from "@tiptap/core";
import { chapterSchema, entrySchema, outlineSchema } from "@coscribe/editor";
import type { Schema } from "@tiptap/pm/model";
import MarkdownIt from "markdown-it";
import type { Token } from "markdown-it";
import { ENTRY_GROUP_LABEL, ENTRY_TYPE_LABEL, ENTRY_TYPES, entryGroups, type EntryType } from "../entries";
import { fountainToScript, scriptToFountain } from "./fountain";
import { plainText, readInline, writeInline } from "./inline";
import type { ChapterFile, EntryFile, OutlineFile, StoryFile } from "./types";

export const FORMAT_VERSION = 1;

export type MarkdownOptions = { bible: boolean; outlines: boolean };

export function toMarkdown(file: StoryFile, { bible, outlines }: MarkdownOptions): string {
  const parts = [frontmatter(file)];
  for (const chapter of file.chapters) {
    parts.push(`# ${escapeHeading(chapter.title)}`);
    if (outlines && chapter.outline) parts.push(writeOutline(chapter.outline));
    parts.push(...writeBlocks(chapter.content.content));
  }
  if (bible && file.entries.length) parts.push(writeBible(file.entries));
  if (file.credits?.length) {
    parts.push(
      "<!-- coscribe:credits -->",
      file.status === "finished" ? "# Credits" : "# Credits so far",
      file.credits
        .map((c) => `- ${[c.name, c.role].filter(Boolean).map(escapeMarkdown).join(", ")}, ${Math.round(c.share * 100)}%`)
        .join("\n")
    );
  }
  return parts.join("\n\n") + "\n";
}

function frontmatter(file: StoryFile): string {
  const fields = { title: file.title, blurb: file.blurb, status: file.status, exported: file.exported };
  const lines = Object.entries(fields).map(([key, value]) => `${key}: ${JSON.stringify(value)}`);
  return ["---", ...lines, `coscribe: ${FORMAT_VERSION}`, "---"].join("\n");
}

const escapeMarkdown = (text: string) => text.replace(/[\\`*_~[\]<>&]/g, "\\$&");

const escapeHeading = (text: string) => escapeMarkdown(text).replace(/#/g, "\\$&");

const escapeListItem = (text: string) => text.replace(/[\\,]/g, "\\$&");

/** Line breaks as `\` line ends. Breaks closing the paragraph go, since Markdown can't end one with a break. */
function writeParagraph(content: JSONContent[] | undefined): string {
  const lines = writeInline(content, escapeMarkdown).split("\n");
  while (lines.length > 1 && !lines.at(-1)) lines.pop();
  return lines
    .map((line) =>
      line
        .replace(/^[ \t]+|[ \t]+$/g, (space) => [...space].map((c) => `&#${c.charCodeAt(0)};`).join(""))
        .replace(/^[#+=-]/, "\\$&")
        .replace(/^(\d+)([.)])/, "$1\\$2")
        .replace(/^(Aliases|Characters):/, "$1\\:")
    )
    .join("\\\n");
}

function writeBlocks(nodes: JSONContent[] | undefined): string[] {
  const out: string[] = [];
  // A list right after another of its kind needs a different marker, or they'd merge into one.
  let lastMarker = "";
  for (const node of nodes ?? []) {
    let text: string | null;
    let marker = "";
    if (node.type === "bulletList" || node.type === "orderedList") {
      const ordered = node.type === "orderedList";
      marker = ordered ? (lastMarker === "." ? ")" : ".") : lastMarker === "-" ? "+" : "-";
      text = writeList(node, ordered, marker);
    } else {
      text = writeBlock(node);
    }
    if (!text) continue;
    out.push(text);
    lastMarker = marker;
  }
  return out;
}

function writeBlock(node: JSONContent): string | null {
  switch (node.type) {
    case "paragraph":
      return writeParagraph(node.content) || null;
    case "sceneBreak":
      return "* * *";
    case "blockquote": {
      const inner = writeBlocks(node.content).join("\n\n");
      return inner ? inner.split("\n").map((line) => (line ? `> ${line}` : ">")).join("\n") : null;
    }
    case "script": {
      const fountain = scriptToFountain(node);
      if (!fountain) return null;
      const longest = Math.max(2, ...(fountain.match(/`+/g) ?? []).map((run) => run.length));
      const fence = "`".repeat(longest + 1);
      return `${fence}fountain\n${fountain}\n${fence}`;
    }
    default:
      return null;
  }
}

function writeList(list: JSONContent, ordered: boolean, delimiter: string): string {
  const start = typeof list.attrs?.start === "number" ? list.attrs.start : 1;
  return (list.content ?? [])
    .map((item, i) => {
      const marker = ordered ? `${start + i}${delimiter} ` : `${delimiter} `;
      const indent = " ".repeat(marker.length);
      const [first = "", ...rest] = writeBlocks(item.content).join("\n\n").split("\n");
      return [(marker + first).trimEnd(), ...rest.map((line) => (line ? indent + line : ""))].join("\n");
    })
    .join("\n");
}

function writeOutline(outline: OutlineFile): string {
  const parts = ["<!-- coscribe:outline -->"];
  if (outline.characters.length) parts.push(`Characters: ${outline.characters.map(escapeListItem).join(", ")}`);
  for (const field of outline.fields) {
    parts.push(`## ${escapeHeading(field.label)}`, ...writeBlocks(field.content.content));
  }
  parts.push("<!-- /coscribe:outline -->");
  return parts.join("\n\n");
}

function writeBible(entries: EntryFile[]): string {
  const typeOrder = [...new Set(entries.map((e) => e.type))];
  const parts = ["<!-- coscribe:story-bible -->", "# Story Bible"];
  for (const group of entryGroups(entries, typeOrder)) {
    parts.push(`## ${ENTRY_GROUP_LABEL[group.type]}`);
    for (const entry of group.entries) {
      parts.push(`### ${escapeHeading(entry.name)}`);
      if (entry.description) parts.push(`_${escapeMarkdown(entry.description)}_`);
      if (entry.aliases.length) parts.push(`Aliases: ${entry.aliases.map(escapeListItem).join(", ")}`);
      parts.push(...writeBlocks(entry.body.content));
    }
  }
  return parts.join("\n\n");
}

const parser = new MarkdownIt("commonmark").enable("strikethrough");

const MARKER = /^<!--\s*(\/?)coscribe:([a-z-]+)\s*-->$/;

type Mode = "chapters" | "outline" | "bible" | "credits";

type Item =
  | { kind: "heading"; level: number; title: string; inline: JSONContent[] }
  | { kind: "marker"; name: string; closing: boolean }
  /** `raw` is a paragraph's source; `description` its text when it's all one `_` emphasis. */
  | { kind: "block"; nodes: JSONContent[]; raw?: string; description?: string };

type Blocks = JSONContent[];

export function fromMarkdown(markdown: string, fileName: string): { file: StoryFile; warnings: string[] } {
  const warnings = new Set<string>();
  const warn = (warning: string) => warnings.add(warning);
  const { meta, body } = readFrontmatter(markdown.replace(/^﻿/, "").replace(/\r\n?/g, "\n"));
  const items = readItems(parser.parse(body, {}), warn);

  const modes: Mode[] = [];
  let mode: Mode = "chapters";
  for (const item of items) {
    if (item.kind === "marker") {
      if (item.name === "outline") {
        if (item.closing && mode === "outline") mode = "chapters";
        else if (!item.closing && mode === "chapters") mode = "outline";
      } else if (!item.closing && item.name === "story-bible") mode = "bible";
      else if (!item.closing && item.name === "credits") mode = "credits";
    }
    modes.push(mode);
  }
  const chapterLevel = Math.min(
    ...items.flatMap((item, i) => (item.kind === "heading" && modes[i] === "chapters" ? [item.level] : []))
  );

  const preamble: Blocks = [];
  const chapters: { title: string; blocks: Blocks; outline?: { fields: { label: string; blocks: Blocks }[]; characters: string[] } }[] = [];
  const entries: { type: EntryType; name: string; description: string; aliases: string[]; blocks: Blocks; head: boolean }[] = [];
  let outline: (typeof chapters)[number]["outline"] | undefined;
  let group: EntryType | null = null;

  items.forEach((item, i) => {
    const mode = modes[i];
    if (item.kind === "marker") {
      if (mode === "outline" && modes[i - 1] !== "outline") {
        outline = { fields: [], characters: [] };
        const chapter = chapters.at(-1);
        if (chapter) chapter.outline = outline;
      }
      return;
    }
    const nodes = item.kind === "heading" ? [boldParagraph(item.inline)] : item.nodes;

    if (mode === "chapters") {
      if (item.kind === "heading" && item.level === chapterLevel) {
        chapters.push({ title: item.title, blocks: chapters.length ? [] : preamble });
      } else {
        (chapters.at(-1)?.blocks ?? preamble).push(...nodes);
      }
    } else if (mode === "outline" && outline) {
      if (item.kind === "heading") outline.fields.push({ label: item.title, blocks: [] });
      else if (!outline.fields.length && item.raw?.startsWith("Characters:")) {
        outline.characters = readList(item.raw.slice("Characters:".length));
      } else {
        if (!outline.fields.length) outline.fields.push({ label: "Summary", blocks: [] });
        outline.fields.at(-1)!.blocks.push(...nodes);
      }
    } else if (mode === "bible") {
      const entry = entries.at(-1);
      if (item.kind === "heading" && item.level === 1) return;
      if (item.kind === "heading" && item.level === 2) {
        group = entryType(item.title, warn);
      } else if (item.kind === "heading" && item.level === 3) {
        if (!group) warn("Entries without an Entry Type were made Lore.");
        entries.push({ type: group ?? "lore", name: item.title, description: "", aliases: [], blocks: [], head: true });
      } else if (entry) {
        const head = entry.head && item.kind === "block" ? item : null;
        if (head?.description !== undefined && !entry.description && !entry.aliases.length) {
          entry.description = head.description;
        } else if (head?.raw?.startsWith("Aliases:") && !entry.aliases.length) {
          entry.aliases = readList(head.raw.slice("Aliases:".length));
        } else {
          entry.head = false;
          entry.blocks.push(...nodes);
        }
      }
    }
  });

  if (!chapters.length) chapters.push({ title: fileName.replace(/\.[^.]*$/, "").trim() || "Chapter 1", blocks: preamble });

  const file: StoryFile = {
    title: meta.title?.trim() || fileName.replace(/\.[^.]*$/, "").trim(),
    blurb: meta.blurb?.trim() ?? "",
    status: meta.status === "finished" ? "finished" : "draft",
    exported: meta.exported ?? "",
    chapters: chapters.map(
      (chapter): ChapterFile => ({
        title: chapter.title,
        content: toDoc(fitChapter(chapter.blocks), chapterSchema),
        ...(chapter.outline && {
          outline: {
            fields: chapter.outline.fields.map((field) => ({
              label: field.label,
              content: toDoc(fitOutline(field.blocks), outlineSchema),
            })),
            characters: chapter.outline.characters,
          },
        }),
      })
    ),
    entries: entries.map(
      (entry): EntryFile => ({
        type: entry.type,
        name: entry.name,
        description: entry.description,
        aliases: entry.aliases,
        body: toDoc(fitEntry(entry.blocks), entrySchema),
      })
    ),
  };
  return { file, warnings: [...warnings] };
}

/** `key: value` lines between `---` fences at the very start. Values are JSON, or plain text in files from elsewhere. */
function readFrontmatter(text: string): { meta: Record<string, string>; body: string } {
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(text);
  if (!match) return { meta: {}, body: text };
  const meta: Record<string, string> = {};
  for (const line of match[1]!.split("\n")) {
    const field = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (!field) continue;
    const raw = field[2]!.trim();
    let value: unknown = raw.replace(/^(["'])(.*)\1$/, "$2");
    try {
      if (raw.startsWith('"')) value = JSON.parse(raw);
    } catch {
      // Not JSON after all: keep it with its quotes stripped.
    }
    meta[field[1]!] = String(value);
  }
  return { meta, body: text.slice(match[0].length) };
}

/** Comma-separated names, `\,` and `\\` escaped. */
function readList(raw: string): string[] {
  const names: string[] = [];
  let name = "";
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]!;
    if (c === "\\" && i + 1 < raw.length) name += raw[++i];
    else if (c === ",") {
      names.push(name);
      name = "";
    } else name += c;
  }
  names.push(name);
  return names.map((n) => n.trim()).filter(Boolean);
}

function entryType(label: string, warn: (warning: string) => void): EntryType {
  const lower = label.trim().toLowerCase();
  const type = ENTRY_TYPES.find(
    (t) => ENTRY_GROUP_LABEL[t].toLowerCase() === lower || ENTRY_TYPE_LABEL[t].toLowerCase() === lower
  );
  if (!type) warn(`Story Bible groups other than ${ENTRY_TYPES.map((t) => ENTRY_GROUP_LABEL[t]).join(", ")} were made Lore.`);
  return type ?? "lore";
}

function boldParagraph(inline: JSONContent[]): JSONContent {
  const content = inline.map((node) => ({
    ...node,
    marks: [...(node.marks ?? []).filter((m) => m.type !== "bold"), { type: "bold" }],
  }));
  return content.length ? { type: "paragraph", content } : { type: "paragraph" };
}

function readItems(tokens: Token[], warn: (warning: string) => void): Item[] {
  const items: Item[] = [];
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i]!;
    if (token.type === "heading_open") {
      const children = tokens[i + 1]!.children;
      items.push({ kind: "heading", level: Number(token.tag.slice(1)), title: plainText(children), inline: readInline(children) });
      i += 3;
    } else if (token.type === "html_block" && MARKER.test(token.content.trim())) {
      const [, slash, name] = MARKER.exec(token.content.trim())!;
      items.push({ kind: "marker", name: name!, closing: slash === "/" });
      i++;
    } else if (token.type === "paragraph_open") {
      const inline = tokens[i + 1]!;
      const children = inline.children ?? [];
      const first = children[0];
      const last = children.at(-1);
      const description =
        first?.type === "em_open" && first.markup === "_" && last?.type === "em_close" &&
        children.filter((c) => c.type === "em_open").length === 1
          ? plainText(children)
          : undefined;
      items.push({ kind: "block", nodes: [paragraph(children)], raw: inline.content, description });
      i += 3;
    } else {
      const { nodes, next } = readBlock(tokens, i, warn);
      items.push({ kind: "block", nodes });
      i = next;
    }
  }
  return items;
}

function paragraph(children: Token[] | null): JSONContent {
  const content = readInline(children, { breaks: true });
  return content.length ? { type: "paragraph", content } : { type: "paragraph" };
}

/** The index of the token closing the one at `open`. */
function closing(tokens: Token[], open: number): number {
  const { level } = tokens[open]!;
  let i = open + 1;
  while (i < tokens.length && !(tokens[i]!.level === level && tokens[i]!.nesting === -1)) i++;
  return i;
}

function readBlocks(tokens: Token[], from: number, to: number, warn: (warning: string) => void): Blocks {
  const out: Blocks = [];
  let i = from;
  while (i < to) {
    const { nodes, next } = readBlock(tokens, i, warn);
    out.push(...nodes);
    i = next;
  }
  return out;
}

/** The nodes for the block at `i`, schema-agnostic: `fit…` shapes them for a Chapter, Entry or Outline. */
function readBlock(tokens: Token[], i: number, warn: (warning: string) => void): { nodes: Blocks; next: number } {
  const token = tokens[i]!;
  switch (token.type) {
    case "paragraph_open":
      return { nodes: [paragraph(tokens[i + 1]!.children)], next: i + 3 };
    case "heading_open":
      return { nodes: [boldParagraph(readInline(tokens[i + 1]!.children))], next: i + 3 };
    case "blockquote_open": {
      const end = closing(tokens, i);
      return { nodes: [{ type: "blockquote", content: readBlocks(tokens, i + 1, end, warn) }], next: end + 1 };
    }
    case "bullet_list_open":
    case "ordered_list_open": {
      const end = closing(tokens, i);
      const items: Blocks = [];
      for (let j = i + 1; j < end; ) {
        const itemEnd = closing(tokens, j);
        items.push({ type: "listItem", content: readBlocks(tokens, j + 1, itemEnd, warn) });
        j = itemEnd + 1;
      }
      const list: JSONContent =
        token.type === "ordered_list_open"
          ? { type: "orderedList", attrs: { start: Number(token.attrGet("start") ?? 1) }, content: items }
          : { type: "bulletList", content: items };
      return { nodes: [list], next: end + 1 };
    }
    case "hr":
      return { nodes: [{ type: "sceneBreak" }], next: i + 1 };
    case "fence":
      if (token.info.trim().toLowerCase() === "fountain") {
        const script = fountainToScript(token.content);
        return { nodes: script ? [script] : [], next: i + 1 };
      }
      return { nodes: codeLines(token.content), next: i + 1 };
    case "code_block":
      return { nodes: codeLines(token.content), next: i + 1 };
    case "html_block":
      warn("HTML in the file was left out.");
      return { nodes: [], next: i + 1 };
    default:
      return { nodes: [], next: i + 1 };
  }
}

function codeLines(code: string): Blocks {
  return code
    .split("\n")
    .filter((line) => line.trim())
    .map((text) => ({ type: "paragraph", content: [{ type: "text", text }] }));
}

/** Any node as plain paragraphs: Script lines become paragraphs and Scene Breaks go. */
function paragraphsOf(node: JSONContent): Blocks {
  if (node.type === "paragraph") return [node];
  if (node.type === "scriptElement") return [{ type: "paragraph", ...(node.content && { content: node.content }) }];
  if (node.type === "sceneBreak") return [];
  return (node.content ?? []).flatMap(paragraphsOf);
}

function fitChapter(nodes: Blocks): Blocks {
  const out: Blocks = [];
  for (const node of nodes) {
    const last = out.at(-1);
    if (node.type === "script" && last?.type === "script") {
      last.content = [...(last.content ?? []), ...(node.content ?? [])];
    } else if (node.type === "blockquote") {
      const content = paragraphsAndLists(node.content ?? []);
      if (content.length) out.push({ type: "blockquote", content });
    } else if (node.type === "bulletList" || node.type === "orderedList") {
      out.push(fitList(node, paragraphsAndLists));
    } else {
      out.push(node);
    }
  }
  return out;
}

/** What a Chapter's block quotes and list items hold: lists stay, and everything else becomes paragraphs. */
function paragraphsAndLists(nodes: Blocks): Blocks {
  return nodes.flatMap((node) =>
    node.type === "bulletList" || node.type === "orderedList" ? [fitList(node, paragraphsAndLists)] : paragraphsOf(node)
  );
}

function fitList(list: JSONContent, fit: (nodes: Blocks) => Blocks): JSONContent {
  return {
    ...list,
    content: (list.content ?? []).map((item) => {
      const content = fit(item.content ?? []);
      return { type: "listItem", content: content[0]?.type === "paragraph" ? content : [{ type: "paragraph" }, ...content] };
    }),
  };
}

function fitEntry(nodes: Blocks): Blocks {
  return nodes.flatMap((node): Blocks => {
    switch (node.type) {
      case "script":
        return paragraphsOf(node);
      case "bulletList":
      case "orderedList":
        return [fitList(node, fitEntry)];
      case "blockquote": {
        const content = fitEntry(node.content ?? []).flatMap((child) =>
          child.type === "sceneBreak" ? [] : child.type === "blockquote" ? (child.content ?? []) : [child]
        );
        return content.length ? [{ type: "blockquote", content }] : [];
      }
      default:
        return [node];
    }
  });
}

function fitOutline(nodes: Blocks): Blocks {
  return nodes.flatMap((node): Blocks => {
    switch (node.type) {
      case "bulletList":
      case "orderedList":
        return [fitList(node, fitOutline)];
      case "blockquote":
        return fitOutline(node.content ?? []);
      case "paragraph":
        return [withoutBreaks(node)];
      default:
        return paragraphsOf(node);
    }
  });
}

/** Outline boxes have no line breaks: each becomes a space. */
function withoutBreaks(paragraph: JSONContent): JSONContent {
  if (!paragraph.content?.some((n) => n.type === "hardBreak")) return paragraph;
  const content: JSONContent[] = [];
  for (const node of paragraph.content) {
    const next = node.type === "hardBreak" ? { type: "text", text: " " } : node;
    const last = content.at(-1);
    if (last && JSON.stringify(last.marks ?? []) === JSON.stringify(next.marks ?? [])) last.text += next.text!;
    else content.push({ ...next });
  }
  return { ...paragraph, content };
}

/** A checked doc, in the schema's normal JSON form. */
function toDoc(blocks: Blocks, schema: Schema): JSONContent {
  const doc = schema.nodeFromJSON({ type: "doc", content: blocks.length ? blocks : [{ type: "paragraph" }] });
  doc.check();
  return doc.toJSON();
}
