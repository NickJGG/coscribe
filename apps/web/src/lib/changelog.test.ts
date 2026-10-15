import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { darkName, IMAGE_EXTENSIONS, isValidDate, parseUpdate } from "./changelog";

const CONTENT = fileURLToPath(new URL("../content/changelog", import.meta.url));
const PUBLIC = fileURLToPath(new URL("../../public", import.meta.url));
const MAX_IMAGE_BYTES = 1024 * 1024;

const DATE = "2026-10-14";
const parse = (source: string, has?: (p: string) => boolean) => parseUpdate(DATE, source, has);

describe("parseUpdate", () => {
  it("parses a title, groups and lines", () => {
    const update = parse(`# Curly quotes

## New
- **Smart punctuation.** Quotes turn *curly*.
- **Line breaks.** Shift+Enter.

## Fixed
- **Snapshot compare.** Line breaks no longer disappear.
`);
    expect(update).toEqual({
      date: DATE,
      title: "Curly quotes",
      groups: [
        {
          kind: "New",
          lines: [
            { lead: "Smart punctuation", html: "Quotes turn <em>curly</em>.", images: [] },
            { lead: "Line breaks", html: "Shift+Enter.", images: [] },
          ],
        },
        { kind: "Fixed", lines: [{ lead: "Snapshot compare", html: "Line breaks no longer disappear.", images: [] }] },
      ],
    });
  });

  it("resolves images under a bullet, with a dark variant when one exists", () => {
    const update = parse(
      `# T

## New
- **Smart punctuation.** Quotes turn curly.
  ![Curly quotes.](smart.webp)

  ![A menu.](menu.png)
`,
      (p) => p === `changelog/${DATE}/smart.dark.webp`
    );
    expect(update.groups[0]!.lines[0]).toEqual({
      lead: "Smart punctuation",
      html: "Quotes turn curly.",
      images: [
        { src: `/changelog/${DATE}/smart.webp`, darkSrc: `/changelog/${DATE}/smart.dark.webp`, alt: "Curly quotes." },
        { src: `/changelog/${DATE}/menu.png`, alt: "A menu." },
      ],
    });
  });

  it("renders links, including bare URLs, and escapes HTML", () => {
    const { html } = parse(`# T\n\n## New\n- **Export.** See [Settings](/settings) or https://coscribe.ink <b>x</b>.\n`)
      .groups[0]!.lines[0]!;
    expect(html).toBe(
      'See <a href="/settings">Settings</a> or <a href="https://coscribe.ink">https://coscribe.ink</a> &lt;b&gt;x&lt;/b&gt;.'
    );
  });

  it.each([
    ["a bad date", "# T\n\n## New\n- **A.** b\n", "2026-02-30", /YYYY-MM-DD/],
    ["no title", "## New\n- **A.** b\n", DATE, /title comes first/],
    ["two titles", "# T\n# U\n\n## New\n- **A.** b\n", DATE, /one # title/],
    ["no groups", "# T\n", DATE, /at least one ## group/],
    ["an unknown group", "# T\n\n## Removed\n- **A.** b\n", DATE, /isn't one of/],
    ["groups out of order", "# T\n\n## Fixed\n- **A.** b\n\n## New\n- **C.** d\n", DATE, /order/],
    ["a repeated group", "# T\n\n## New\n- **A.** b\n\n## New\n- **C.** d\n", DATE, /order/],
    ["an empty group", "# T\n\n## New\n\n## Fixed\n- **A.** b\n", DATE, /"## New" is empty/],
    ["an empty last group", "# T\n\n## New\n- **A.** b\n\n## Fixed\n", DATE, /"## Fixed" is empty/],
    ["an h3", "# T\n\n## New\n### Sub\n- **A.** b\n", DATE, /Only # and ## headings/],
    ["a stray paragraph", "# T\n\nIntro.\n\n## New\n- **A.** b\n", DATE, /Only headings and bullet lists/],
    ["a list outside a group", "# T\n\n- **A.** b\n", DATE, /under a ## New/],
    ["an ordered list", "# T\n\n## New\n1. **A.** b\n", DATE, /found ordered_list/],
    ["a bullet without a lead", "# T\n\n## New\n- Just text.\n", DATE, /\*\*Lead\.\*\*/],
    ["a lead without a full stop", "# T\n\n## New\n- **A** b\n", DATE, /full stop/],
    ["a nested list", "# T\n\n## New\n- **A.** b\n  - **C.** d\n", DATE, /only text and images/],
    ["a second paragraph of text", "# T\n\n## New\n- **A.** b\n\n  More.\n", DATE, /one paragraph/],
    ["an image outside a bullet", "# T\n\n![Alt.](a.webp)\n\n## New\n- **A.** b\n", DATE, /under a bullet/],
    ["an image without alt text", "# T\n\n## New\n- **A.** b\n  ![](a.webp)\n", DATE, /alt text/],
    ["an image path", "# T\n\n## New\n- **A.** b\n  ![Alt.](../a.webp)\n", DATE, /plain file name/],
    ["an image URL", "# T\n\n## New\n- **A.** b\n  ![Alt.](https://x.test/a.webp)\n", DATE, /plain file name/],
    ["a JPEG", "# T\n\n## New\n- **A.** b\n  ![Alt.](a.jpg)\n", DATE, /must be .webp/],
    ["a dark image referenced directly", "# T\n\n## New\n- **A.** b\n  ![Alt.](a.dark.webp)\n", DATE, /light image/],
  ])("rejects %s", (_, source, date, error) => {
    expect(() => parseUpdate(date, source)).toThrow(error);
  });
});

const files = existsSync(CONTENT) ? readdirSync(CONTENT).filter((f) => f !== ".gitkeep") : [];

describe("changelog files", () => {
  it("are all YYYY-MM-DD.md", () => {
    const bad = files.filter((f) => !f.endsWith(".md") || !isValidDate(f.slice(0, -3)));
    expect(bad).toEqual([]);
  });

  it.each(files.filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3)))("%s parses, with its images", (date) => {
    const dir = join(PUBLIC, "changelog", date);
    const update = parseUpdate(date, readFileSync(join(CONTENT, `${date}.md`), "utf8"), (p) =>
      existsSync(join(PUBLIC, p))
    );
    const referenced = update.groups.flatMap((g) => g.lines.flatMap((l) => l.images.map((i) => i.src.split("/").at(-1)!)));

    for (const name of referenced) {
      const file = join(dir, name);
      expect(existsSync(file), `public/changelog/${date}/${name} is missing`).toBe(true);
      expect(statSync(file).size, `${name} is over 1 MB`).toBeLessThanOrEqual(MAX_IMAGE_BYTES);
      const dark = join(dir, darkName(name));
      if (existsSync(dark)) expect(statSync(dark).size, `${darkName(name)} is over 1 MB`).toBeLessThanOrEqual(MAX_IMAGE_BYTES);
    }

    const expected = new Set(referenced.flatMap((name) => [name, darkName(name)]));
    const present = existsSync(dir) ? readdirSync(dir) : [];
    const stray = present.filter((f) => !expected.has(f));
    expect(stray, "unreferenced files, or dark files without a light partner").toEqual([]);
    expect(present.filter((f) => !IMAGE_EXTENSIONS.includes(extname(f).toLowerCase()))).toEqual([]);
  });

  it("have no image folders without an update", () => {
    const dir = join(PUBLIC, "changelog");
    const orphans = existsSync(dir) ? readdirSync(dir).filter((d) => !files.includes(`${d}.md`)) : [];
    expect(orphans).toEqual([]);
  });
});
