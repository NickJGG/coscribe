import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Next wraps every child of a folder in that folder's loading.tsx, so a skeleton beside a page with child routes
 * would flash on the way to each child. Leaf pages get their own skeleton; parents move their page into a route group.
 */
const APP = fileURLToPath(new URL("../app", import.meta.url));

/** The plain fallbacks shown while crossing between shells. */
const PARENT_FALLBACKS = new Set(["", "stories/[storyId]"]);

type Folder = { path: string; hasPage: boolean; hasLoading: boolean; childRoutes: number };

function walk(dir: string, out: Folder[]): boolean {
  const subdirs = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory());
  const childRoutes = subdirs.filter((e) => walk(join(dir, e.name), out)).length;
  const hasPage = existsSync(join(dir, "page.tsx"));
  out.push({
    path: relative(APP, dir).replaceAll("\\", "/"),
    hasPage,
    hasLoading: existsSync(join(dir, "loading.tsx")),
    childRoutes,
  });
  return hasPage || childRoutes > 0;
}

const folders: Folder[] = [];
walk(APP, folders);

describe("loading boundaries", () => {
  it("finds the app's pages", () => {
    expect(folders.filter((f) => f.hasPage).length).toBeGreaterThan(10);
  });

  it("gives every leaf page a sibling loading.tsx", () => {
    const missing = folders
      .filter((f) => f.hasPage && !f.childRoutes && !f.hasLoading)
      .map((f) => `app/${f.path}: a leaf page.tsx needs its own loading.tsx`);
    expect(missing).toEqual([]);
  });

  it("keeps loading.tsx out of folders with child routes, except the plain fallbacks", () => {
    const misplaced = folders
      .filter((f) => f.childRoutes && f.hasLoading && !PARENT_FALLBACKS.has(f.path))
      .map((f) => `app/${f.path}: has child routes, so its loading.tsx would show on the way to each of them`);
    expect(misplaced).toEqual([]);
  });
});
