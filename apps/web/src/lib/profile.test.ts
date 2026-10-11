import { describe, expect, it } from "vitest";
import { formerWriterIds, profileStories, writesWith, type ProfileStoryRow } from "./profile";

const mia = { id: "mia", username: "mia", author_color: "#d93f4c" };
const jordan = { id: "jordan", username: "jordan", author_color: "#3e63dd" };
const sam = { id: "sam", username: "sam", author_color: "#3f9b4f" };

type Person = typeof mia;

function row(
  id: string,
  {
    people = [mia],
    viewers = [],
    status = "active",
    finishedAt = null,
    createdAt = "2026-01-01T00:00:00Z",
    chapters = [],
  }: {
    people?: Person[];
    viewers?: Person[];
    status?: "active" | "finished";
    finishedAt?: string | null;
    createdAt?: string;
    chapters?: { words: number; chars?: Record<string, number>; editedAt?: string }[];
  } = {}
): ProfileStoryRow {
  return {
    role: viewers.includes(mia) ? "viewer" : people[0] === mia ? "host" : "writer",
    story: {
      id,
      title: id,
      blurb: null,
      status,
      visibility: "public",
      created_at: createdAt,
      finished_at: finishedAt,
      chapters: chapters.map((c) => ({ word_count: c.words, author_chars: c.chars ?? {}, edited_at: c.editedAt ?? null })),
      members: [
        ...people.map((p, i) => ({
          role: i === 0 ? ("host" as const) : ("writer" as const),
          joined_at: `2026-01-0${i + 1}T00:00:00Z`,
          author_color: null,
          profile: p,
        })),
        ...viewers.map((p) => ({ role: "viewer" as const, joined_at: "2026-02-01T00:00:00Z", author_color: null, profile: p })),
      ],
      activity: null,
    },
  };
}

const ids = (stories: { id: string }[]) => stories.map((s) => s.id);

describe("profileStories", () => {
  const rows = [
    row("empty-old", { createdAt: "2026-01-01T00:00:00Z" }),
    row("empty-new", { createdAt: "2026-03-01T00:00:00Z" }),
    row("edited-old", { chapters: [{ words: 10, editedAt: "2026-02-01T00:00:00Z" }] }),
    row("edited-new", {
      chapters: [
        { words: 10, editedAt: "2026-02-01T00:00:00Z" },
        { words: 5, editedAt: "2026-04-01T00:00:00Z" },
      ],
    }),
    row("done-old", { status: "finished", finishedAt: "2026-02-01T00:00:00Z", chapters: [{ words: 1 }] }),
    row("done-new", { status: "finished", finishedAt: "2026-05-01T00:00:00Z", chapters: [{ words: 1 }] }),
    row("shared-draft", { people: [mia, jordan], chapters: [{ words: 3, editedAt: "2026-06-01T00:00:00Z" }] }),
    row("shared-done", { people: [mia, jordan], status: "finished", finishedAt: "2026-01-15T00:00:00Z" }),
  ];

  it("splits Finished from Being written, each in profile order, for a stranger", () => {
    const { together, finished, writing } = profileStories(rows, "mia", "sam", new Map());
    expect(together).toEqual([]);
    expect(ids(finished)).toEqual(["done-new", "done-old", "shared-done"]);
    expect(ids(writing)).toEqual(["shared-draft", "edited-new", "edited-old", "empty-new", "empty-old"]);
  });

  it("puts Stories shared with the viewer in Writing together, Finished first", () => {
    const { together, finished, writing } = profileStories(rows, "mia", "jordan", new Map());
    expect(ids(together)).toEqual(["shared-done", "shared-draft"]);
    expect(ids(finished)).toEqual(["done-new", "done-old"]);
    expect(ids(writing)).toEqual(["edited-new", "edited-old", "empty-new", "empty-old"]);
  });

  it("has no Writing together on your own profile or signed out", () => {
    expect(profileStories(rows, "mia", "mia", new Map()).together).toEqual([]);
    expect(profileStories(rows, "mia", null, new Map()).together).toEqual([]);
  });

  it("totals words and finds the latest edit", () => {
    const [story] = profileStories([rows[3]!], "mia", null, new Map()).writing;
    expect(story).toMatchObject({ words: 15, chapterCount: 2, editedAt: "2026-04-01T00:00:00Z", writers: 0 });
  });

  it("leaves out Stories the profile User only reads, and never counts Viewers as together", () => {
    const reading = row("reading", { people: [jordan], viewers: [mia] });
    const watched = row("watched", { people: [mia], viewers: [jordan] });
    const { together, finished, writing } = profileStories([reading, watched], "mia", "jordan", new Map());
    expect(together).toEqual([]);
    expect(finished).toEqual([]);
    expect(ids(writing)).toEqual(["watched"]);
  });

  it("names a Viewer's surviving text as a former Writer's", () => {
    const demoted = row("d", { people: [mia], viewers: [jordan], chapters: [{ words: 3, chars: { jordan: 3 } }] });
    expect(formerWriterIds([demoted])).toEqual(["jordan"]);
  });

  it("builds the ribbon in join order, with former Writers named", () => {
    const shared = row("s", { people: [mia, jordan], chapters: [{ words: 9, chars: { jordan: 4, mia: 2, gone: 7 } }] });
    expect(formerWriterIds([shared])).toEqual(["gone"]);
    const [story] = profileStories([shared], "mia", null, new Map([["gone", "ghost"]])).writing;
    expect(story!.ribbon.map((s) => [s.id, s.name, s.chars])).toEqual([
      ["mia", "mia", 2],
      ["jordan", "jordan", 4],
      ["gone", "ghost", 7],
    ]);
  });
});

describe("writesWith", () => {
  it("counts shared Stories per co-writer, most first, then by name", () => {
    const rows = [
      row("a", { people: [mia, sam] }),
      row("b", { people: [mia, jordan, sam] }),
      row("c", { people: [jordan, mia] }),
      row("d", { people: [mia] }),
      row("e", { people: [mia], viewers: [sam] }),
      row("f", { people: [jordan], viewers: [mia] }),
    ];
    expect(writesWith(rows, "mia")).toEqual([
      { id: "jordan", username: "jordan", color: "#3e63dd", shared: 2 },
      { id: "sam", username: "sam", color: "#3f9b4f", shared: 2 },
    ]);
  });
});
