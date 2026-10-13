import type { JSONContent } from "@tiptap/core";
import { chapterSchema, entrySchema, outlineSchema } from "@coscribe/editor";
import type { Schema } from "@tiptap/pm/model";
import { describe, expect, it } from "vitest";
import { fromMarkdown, toMarkdown } from "./markdown";
import { summarize } from "./summary";
import type { StoryFile } from "./types";

const author = { type: "author", attrs: { userId: "u1", at: 1 } };

const text = (value: string, ...marks: string[]): JSONContent => ({
  type: "text",
  text: value,
  marks: [author, ...marks.map((type) => ({ type }))],
});

const p = (...content: JSONContent[]): JSONContent => ({ type: "paragraph", content });

const doc = (...content: JSONContent[]): JSONContent => ({ type: "doc", content });

const el = (element: string, value: string): JSONContent => ({
  type: "scriptElement",
  attrs: { element },
  content: [text(value)],
});

const bullets = (...items: JSONContent[][]): JSONContent => ({
  type: "bulletList",
  content: items.map((content) => ({ type: "listItem", content })),
});

const story: StoryFile = {
  title: "The Mill",
  blurb: 'A "quiet" town.\nThen the fire.',
  status: "finished",
  exported: "2026-10-13",
  chapters: [
    {
      title: "Smoke & *Ash*",
      outline: {
        fields: [
          { label: "Summary", content: doc(p(text("Anna finds the "), text("key", "bold"), text("."))) },
          { label: "Who knew", content: doc(bullets([p(text("Bob"))], [p(text("The miller")), bullets([p(text("maybe"))])])) },
        ],
        characters: ["Anna", "Bob, the Elder"],
      },
      content: doc(
        p(text("It was "), text("very", "italic"), text(" "), text("late", "bold", "italic"), text(".")),
        p(text("# not a heading, 1. not a list, - nor this")),
        p(text("Characters: not the Outline line")),
        p(text("  indented and trailing  ")),
        { type: "blockquote", content: [p(text("A quoted line.")), p(text("And another."))] },
        { type: "sceneBreak" },
        p(text("Brackets [x] <tags> & ~tildes~ `ticks` _under_ back\\slash.")),
        {
          type: "script",
          content: [
            el("sceneHeading", "INT. MILL - NIGHT"),
            el("action", "Smoke."),
            el("character", "ANNA"),
            el("parenthetical", "(coughing)"),
            el("dialogue", "Bob? ``` Bob!"),
            el("transition", "CUT TO:"),
          ],
        },
        p(text("Gone", "strike"), text(" for good.")),
      ),
    },
    { title: "Embers", content: doc(p(text("The end."))) },
  ],
  entries: [
    {
      type: "character",
      name: "Anna",
      description: "The miller's _daughter_.",
      aliases: ["Annie", "A, the first"],
      body: doc(
        p(text("Brave.")),
        bullets([p(text("Likes rain"))]),
        bullets([p(text("A second list"))]),
        { type: "orderedList", attrs: { start: 3 }, content: [{ type: "listItem", content: [p(text("Third"))] }] },
        { type: "blockquote", content: [p(text("Quoted")), bullets([p(text("listed"))])] },
      ),
    },
    { type: "character", name: "Bob", description: "", aliases: [], body: doc(p(text("Aliases: none, really."))) },
    { type: "place", name: "The Mill", description: "Burned down.", aliases: [], body: doc(p(text("Old."))) },
    { type: "lore", name: "The Pact #1", description: "", aliases: ["Pact"], body: doc({ type: "paragraph" }) },
  ],
  credits: [{ name: "nick", role: "Host", share: 0.62 }],
};

/** `json` without authorship or Notes, in the schema's normal form. */
function plain(json: JSONContent, schema: Schema): JSONContent {
  const strip = (node: JSONContent): JSONContent => ({
    ...node,
    ...(node.marks && { marks: node.marks.filter((m) => m.type !== "author" && m.type !== "note") }),
    ...(node.content && { content: node.content.map(strip) }),
  });
  return schema.nodeFromJSON(strip(json)).toJSON();
}

function expected(file: StoryFile): StoryFile {
  const rest: StoryFile = { ...file };
  delete rest.credits;
  return {
    ...rest,
    chapters: file.chapters.map((c) => ({
      ...c,
      content: plain(c.content, chapterSchema),
      ...(c.outline && {
        outline: {
          ...c.outline,
          fields: c.outline.fields.map((f) => ({ ...f, content: plain(f.content, outlineSchema) })),
        },
      }),
    })),
    entries: file.entries.map((e) => ({ ...e, body: plain(e.body, entrySchema) })),
  };
}

describe("toMarkdown / fromMarkdown", () => {
  it("round trips a Story with its Outlines and Story Bible", () => {
    const markdown = toMarkdown(story, { bible: true, outlines: true });
    const { file, warnings } = fromMarkdown(markdown, "anything.md");
    expect(warnings).toEqual([]);
    expect(file).toEqual(expected(story));
  });

  it("leaves out the Story Bible and Outlines unless asked", () => {
    const markdown = toMarkdown(story, { bible: false, outlines: false });
    expect(markdown).not.toContain("coscribe:story-bible");
    expect(markdown).not.toContain("coscribe:outline");
    const { file } = fromMarkdown(markdown, "x.md");
    expect(file.entries).toEqual([]);
    expect(file.chapters[0]!.outline).toBeUndefined();
  });

  it("writes frontmatter, Chapter headings, Scene Breaks and Credits", () => {
    const markdown = toMarkdown(story, { bible: false, outlines: false });
    expect(markdown.startsWith('---\ntitle: "The Mill"\nblurb: "A \\"quiet\\" town.\\nThen the fire."\nstatus: "finished"\nexported: "2026-10-13"\ncoscribe: 1\n---\n')).toBe(true);
    expect(markdown).toContain("\n# Smoke \\& \\*Ash\\*\n");
    expect(markdown).toContain("\n* * *\n");
    expect(markdown).toContain("```fountain\nINT. MILL - NIGHT\n");
    expect(markdown).toContain("<!-- coscribe:credits -->\n\n# Credits\n\n- nick, Host, 62%\n");
    expect(toMarkdown({ ...story, status: "draft" }, { bible: false, outlines: false })).toContain("# Credits so far");
  });

  it("writes adjoining bold and italic so they read back", () => {
    const content = doc(p(text("a", "bold"), text("b", "italic"), text("c", "bold"), text(" "), text("d", "italic")));
    const file: StoryFile = { ...story, chapters: [{ title: "One", content }], entries: [] };
    expect(fromMarkdown(toMarkdown(file, { bible: false, outlines: false }), "x.md").file.chapters[0]!.content).toEqual(
      plain(content, chapterSchema)
    );
  });
});

describe("fromMarkdown with files from elsewhere", () => {
  it("makes the highest heading level present the Chapters, text before it opening the first", () => {
    const { file } = fromMarkdown("Before.\n\n## One\n\nFirst.\n\n### Part\n\nMore.\n\n## Two\n\nSecond.\n", "Novel.md");
    expect(file.title).toBe("Novel");
    expect(file.status).toBe("draft");
    expect(file.chapters.map((c) => c.title)).toEqual(["One", "Two"]);
    expect(file.chapters[0]!.content).toEqual(
      plain(
        doc(
          p({ type: "text", text: "Before." }),
          p({ type: "text", text: "First." }),
          p({ type: "text", text: "Part", marks: [{ type: "bold" }] }),
          p({ type: "text", text: "More." })
        ),
        chapterSchema
      )
    );
  });

  it("makes a file with no headings one Chapter named after the file", () => {
    const { file } = fromMarkdown("Just text.\n\nMore text.\n", "my draft.txt");
    expect(file.chapters).toHaveLength(1);
    expect(file.chapters[0]!.title).toBe("my draft");
    expect(file.title).toBe("my draft");
  });

  it("reads plain YAML frontmatter", () => {
    const { file } = fromMarkdown("---\ntitle: Plain Title\nblurb: 'Quoted'\n---\n# One\n\nHi.\n", "x.md");
    expect(file.title).toBe("Plain Title");
    expect(file.blurb).toBe("Quoted");
  });

  it("turns Chapter lists and code into paragraphs, and drops HTML with a warning", () => {
    const { file, warnings } = fromMarkdown("# One\n\n- a\n- b\n\n<div>x</div>\n\n```\ncode line\n```\n", "x.md");
    expect(file.chapters[0]!.content.content!.map((n) => n.content?.[0]?.text)).toEqual(["a", "b", "code line"]);
    expect(warnings).toEqual(["HTML in the file was left out.", "Lists in Chapters became paragraphs."]);
  });

  it("gives an empty file one empty Chapter", () => {
    const { file } = fromMarkdown("", "empty.md");
    expect(file.chapters).toEqual([{ title: "empty", content: { type: "doc", content: [{ type: "paragraph", attrs: { textAlign: null } }] } }]);
  });
});

describe("summarize", () => {
  it("counts what an import would make", () => {
    expect(summarize(story)).toEqual({
      chapters: 2,
      words: 53,
      entries: [
        { type: "character", count: 2 },
        { type: "place", count: 1 },
        { type: "lore", count: 1 },
      ],
      outlines: 1,
      scripts: 1,
      firstChapters: ["Smoke & *Ash*", "Embers"],
    });
    expect(summarize({ ...story, chapters: [{ title: "x", content: doc(p(text("one two")), p(text("three"))) }] }).words).toBe(3);
  });
});
