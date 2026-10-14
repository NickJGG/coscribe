import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { toEpub } from "./epub";
import type { StoryFile } from "./types";

const file: StoryFile = {
  title: "Salt & Ash",
  blurb: "",
  status: "draft",
  exported: "2026-10-13",
  byline: ["anna", "ben"],
  chapters: [
    {
      title: "One",
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }, { type: "hardBreak" }, { type: "text", text: "there" }] }] },
      outline: { fields: [{ label: "Summary", content: { type: "doc", content: [{ type: "paragraph" }] } }], characters: ["Anna"] },
    },
  ],
  entries: [{ type: "character", name: "Anna", description: "", aliases: [], body: { type: "doc" } }],
  credits: [{ name: "anna", role: "Host", share: 1 }],
};

describe("toEpub", () => {
  const epub = toEpub(file, { identifier: "urn:uuid:1", modified: new Date("2026-10-13T12:00:00.123Z") });

  it("starts with an uncompressed mimetype entry and no extra field", () => {
    const view = new DataView(epub.buffer, epub.byteOffset);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint16(8, true)).toBe(0);
    expect(view.getUint16(28, true)).toBe(0);
    const nameLength = view.getUint16(26, true);
    expect(strFromU8(epub.subarray(30, 30 + nameLength))).toBe("mimetype");
    expect(strFromU8(epub.subarray(30 + nameLength, 30 + nameLength + 20))).toBe("application/epub+zip");
  });

  it("lists every section in the package and the contents", () => {
    const files = unzipSync(epub);
    expect(Object.keys(files)).toEqual([
      "mimetype",
      "META-INF/container.xml",
      "OEBPS/content.opf",
      "OEBPS/nav.xhtml",
      "OEBPS/style.css",
      "OEBPS/title.xhtml",
      "OEBPS/chapter-1.xhtml",
      "OEBPS/story-bible.xhtml",
      "OEBPS/credits.xhtml",
    ]);
    const opf = strFromU8(files["OEBPS/content.opf"]!);
    expect(opf).toContain("<dc:title>Salt &amp; Ash</dc:title>");
    expect(opf).toContain("<dc:creator>ben</dc:creator>");
    expect(opf).toContain('<meta property="dcterms:modified">2026-10-13T12:00:00Z</meta>');
    expect(strFromU8(files["OEBPS/nav.xhtml"]!)).toContain('<a href="credits.xhtml">Credits so far</a>');
    expect(strFromU8(files["OEBPS/title.xhtml"]!)).toContain("Draft, exported October 13, 2026");
    expect(strFromU8(files["OEBPS/chapter-1.xhtml"]!)).toContain("Characters: Anna");
    expect(strFromU8(files["OEBPS/chapter-1.xhtml"]!)).toContain("<p>Hello<br />there</p>");
  });
});
