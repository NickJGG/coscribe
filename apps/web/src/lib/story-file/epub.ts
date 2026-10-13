/**
 * An EPUB 3 of a StoryFile: a title page, one XHTML file per Chapter (its Outline first, if it has one), then the
 * Story Bible and Credits. The `mimetype` entry must come first and uncompressed, so readers can sniff it.
 */
import { strToU8, zipSync, type Zippable } from "fflate";
import { ENTRY_GROUP_LABEL, entryGroups } from "../entries";
import { escapeXml, toXhtml } from "./html";
import type { ChapterFile, EntryFile, OutlineFile, StoryFile } from "./types";

export type EpubOptions = { identifier: string; modified?: Date };

type Section = { file: string; title: string; body: string };

const listFormat = new Intl.ListFormat("en", { type: "conjunction" });
const monthYear = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const fullDate = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" });

export function toEpub(file: StoryFile, { identifier, modified = new Date() }: EpubOptions): Uint8Array {
  const sections: Section[] = [
    { file: "title.xhtml", title: file.title, body: titlePage(file) },
    ...file.chapters.map((chapter, i) => ({
      file: `chapter-${i + 1}.xhtml`,
      title: chapter.title,
      body: chapterBody(chapter),
    })),
  ];
  if (file.entries.length) sections.push({ file: "story-bible.xhtml", title: "Story Bible", body: bibleBody(file.entries) });
  if (file.credits?.length) {
    const title = file.status === "finished" ? "Credits" : "Credits so far";
    sections.push({ file: "credits.xhtml", title, body: creditsBody(title, file.credits) });
  }

  const zip: Zippable = {
    mimetype: [strToU8("application/epub+zip"), { level: 0 }],
    "META-INF/container.xml": strToU8(CONTAINER),
    "OEBPS/content.opf": strToU8(packageDocument(file, sections, identifier, modified)),
    "OEBPS/nav.xhtml": strToU8(navDocument(file.title, sections)),
    "OEBPS/style.css": strToU8(STYLESHEET),
  };
  for (const section of sections) {
    zip[`OEBPS/${section.file}`] = strToU8(xhtmlDocument(section.title, section.body));
  }
  return zipSync(zip, { level: 9 });
}

const CONTAINER = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
`;

function packageDocument(file: StoryFile, sections: Section[], identifier: string, modified: Date): string {
  const creators = (file.byline ?? []).map((name) => `    <dc:creator>${escapeXml(name)}</dc:creator>`);
  const items = sections.map((s, i) => `    <item id="s${i}" href="${s.file}" media-type="application/xhtml+xml"/>`);
  const spine = sections.map((_, i) => `    <itemref idref="s${i}"/>`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id" xml:lang="en">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="id">${escapeXml(identifier)}</dc:identifier>
    <dc:title>${escapeXml(file.title)}</dc:title>
    <dc:language>en</dc:language>
${[...creators, file.blurb && `    <dc:description>${escapeXml(file.blurb)}</dc:description>`].filter(Boolean).join("\n")}
    <meta property="dcterms:modified">${modified.toISOString().replace(/\.\d+Z$/, "Z")}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="css" href="style.css" media-type="text/css"/>
${items.join("\n")}
  </manifest>
  <spine>
${spine.join("\n")}
  </spine>
</package>
`;
}

function navDocument(title: string, sections: Section[]): string {
  const links = sections.map((s) => `<li><a href="${s.file}">${escapeXml(s.title)}</a></li>`).join("\n");
  return xhtmlDocument(title, `<nav epub:type="toc" id="toc">\n<h1>Contents</h1>\n<ol>\n${links}\n</ol>\n</nav>`);
}

function xhtmlDocument(title: string, body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en" lang="en">
<head>
<meta charset="UTF-8"/>
<title>${escapeXml(title)}</title>
<link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
${body}
</body>
</html>
`;
}

function titlePage(file: StoryFile): string {
  const lines = [`<h1 class="book-title">${escapeXml(file.title)}</h1>`];
  if (file.blurb) lines.push(`<p class="blurb">${escapeXml(file.blurb)}</p>`);
  if (file.byline?.length) lines.push(`<p class="byline">by ${escapeXml(listFormat.format(file.byline))}</p>`);
  const date =
    file.status === "finished"
      ? file.finished && `Finished ${monthYear.format(new Date(file.finished))}`
      : file.exported && `Draft, exported ${fullDate.format(new Date(file.exported))}`;
  if (date) lines.push(`<p class="muted">${escapeXml(date)}</p>`);
  return `<section class="title-page" epub:type="titlepage">\n${lines.join("\n")}\n</section>`;
}

function chapterBody(chapter: ChapterFile): string {
  const parts = [`<h1>${escapeXml(chapter.title)}</h1>`];
  if (chapter.outline) parts.push(outlineSection(chapter.outline));
  parts.push(`<div class="text">\n${toXhtml(chapter.content)}\n</div>`);
  return parts.join("\n");
}

function outlineSection(outline: OutlineFile): string {
  const parts = ['<section class="outline">', "<h2>Outline</h2>"];
  if (outline.characters.length) {
    parts.push(`<p class="muted">Characters: ${escapeXml(outline.characters.join(", "))}</p>`);
  }
  for (const field of outline.fields) {
    parts.push(`<h3>${escapeXml(field.label)}</h3>`, toXhtml(field.content));
  }
  parts.push("</section>");
  return parts.join("\n");
}

function bibleBody(entries: EntryFile[]): string {
  const parts = ["<h1>Story Bible</h1>"];
  const typeOrder = [...new Set(entries.map((e) => e.type))];
  for (const group of entryGroups(entries, typeOrder)) {
    parts.push(`<h2>${escapeXml(ENTRY_GROUP_LABEL[group.type])}</h2>`);
    for (const entry of group.entries) {
      parts.push(`<section class="entry">`, `<h3>${escapeXml(entry.name)}</h3>`);
      if (entry.description) parts.push(`<p class="description">${escapeXml(entry.description)}</p>`);
      if (entry.aliases.length) parts.push(`<p class="muted">Aliases: ${escapeXml(entry.aliases.join(", "))}</p>`);
      parts.push(`<div class="text">\n${toXhtml(entry.body)}\n</div>`, "</section>");
    }
  }
  return parts.join("\n");
}

function creditsBody(title: string, credits: NonNullable<StoryFile["credits"]>): string {
  const items = credits.map(
    (c) => `<li>${escapeXml(c.name)} <span class="muted">· ${escapeXml(c.role)}</span> · ${Math.round(c.share * 100)}%</li>`
  );
  return `<h1>${escapeXml(title)}</h1>\n<ol class="credits">\n${items.join("\n")}\n</ol>`;
}

/** The Reader View's look (reader.module.css, Script.module.css), without its web fonts. */
const STYLESHEET = `body {
  font-family: serif;
  line-height: 1.6;
}

h1, h2, h3 {
  line-height: 1.25;
}

h1 {
  margin: 2em 0 1.5em;
  text-align: center;
}

.muted {
  color: #6b6b6b;
}

.title-page {
  margin-top: 20%;
  text-align: center;
}

.book-title {
  margin: 0 0 1em;
  font-size: 2.2em;
}

.blurb,
.byline,
.description {
  font-style: italic;
}

.byline {
  font-size: 1.2em;
}

.text p {
  margin: 0;
}

.text p + p {
  text-indent: 1.5em;
}

.text li p + p,
.text p[style] {
  text-indent: 0;
}

hr[data-scene-break] {
  margin: 1.5em 0;
  border: 0;
  text-align: center;
}

hr[data-scene-break]::after {
  content: "* * *";
  letter-spacing: 0.5em;
}

blockquote,
div[data-script] {
  margin: 0.75em 0;
  padding-left: 1.5em;
}

div[data-script] {
  font-family: "Courier New", monospace;
  line-height: 1.5;
}

div[data-script] > p {
  text-indent: 0;
}

div[data-script] > p + p {
  margin-top: 1.5em;
}

div[data-script] > p[data-element="dialogue"],
div[data-script] > p[data-element="parenthetical"] {
  margin-top: 0;
}

p[data-element="sceneHeading"],
p[data-element="character"],
p[data-element="transition"] {
  text-transform: uppercase;
}

p[data-element="character"] {
  padding-left: 37%;
}

p[data-element="dialogue"] {
  padding: 0 25% 0 17%;
}

p[data-element="parenthetical"] {
  padding: 0 30% 0 27%;
}

p[data-element="transition"] {
  text-align: right;
}

.outline {
  margin-bottom: 2em;
  padding-bottom: 1em;
  border-bottom: 1px solid #ccc;
}

.entry {
  margin-bottom: 1.5em;
}

.credits {
  padding-left: 1.5em;
}
`;
