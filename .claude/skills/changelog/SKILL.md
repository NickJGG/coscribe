---
name: changelog
description: >-
  Write today's Coscribe changelog update from the commits since the last one:
  reader-facing release notes in apps/web/src/content/changelog/<today>.md,
  with light and dark screenshots from the local screenshot script.
argument-hint: "[since <ref>]"
disable-model-invocation: true
---

# Changelog

Writes `apps/web/src/content/changelog/<today>.md` (today as local `YYYY-MM-DD`). The format is documented at the top of `apps/web/src/lib/changelog.ts`, and `changelog.test.ts` enforces it.

Arguments: `$ARGUMENTS`

## 1. Range

- Default: the last commit that touched the content folder is the bookmark.
  ```sh
  git log -1 --format=%H -- apps/web/src/content/changelog/
  ```
  The range is `<that>..HEAD`.
- `since <ref>` overrides the bookmark: the range is `<ref>..HEAD`.
- Uncommitted work isn't in the range. If the tree is dirty, say so and leave it out.

## 2. Read

- `git log --format='%h %s' <range>` and read every subject.
- `git show --stat` any commit whose subject doesn't make the visible change clear, then `git show` the parts that do. Check the UI copy in the diff, so the notes use the same words as the app.

## 3. Editorial rules

The reader is a Writer using Coscribe, not a developer.

- **Drop invisible work:** RLS and policies, migrations and RPCs, sync internals, tooling and scripts, docs and AGENTS.md, refactors, tests. If a commit has a visible side, describe only that.
- **Fold fixes into their feature.** A fix to something introduced in the same range is part of that feature's line. Fixed is only for bugs in published or pre-range work.
- **One line per feature.** Merge multi-commit features into one line. Order New biggest first.
- **Words:** `CONTEXT.md` vocabulary (Host, Co-host, Writer, Viewer, Chapter, Story Bible, Entry, Snapshot, Restore, Finished, ...) and the labels the UI shows. Say what the reader can now do, not how it was built.
- No line cap. A thin range gets a short update; don't push back on it.

## 4. Write

- If today's file exists, add to it: merge into its groups rather than writing a second update.
- `# Title`: short, naming the headline changes (e.g. "Curly quotes and line breaks").
- `## New`, `## Improved`, `## Fixed` in that order; leave out empty ones.
- Every bullet is `- **Lead.** Description.` The lead is a few words; the description is one or two plain sentences.

## 5. Screenshots

- Choose the lines a picture would actually explain: new UI, a changed layout, a visible behaviour. Not every line needs one.
- Write `apps/web/scripts/changelog-shots/recipes/<today>.ts`, default-exporting `Shot[]` (`scripts/changelog-shots/shot.ts`):
  ```ts
  import type { Shot } from "../shot";

  const shots: Shot[] = [
    {
      name: "smart-punctuation",
      as: "host",
      path: (ctx) => `/stories/${ctx.storyId}/chapters/${ctx.chapterIds[0]}`,
      viewport: { width: 900, height: 600 },
      frame: ".ProseMirror",
      setup: async (page) => { /* type, open a menu, ... */ },
    },
  ];
  export default shots;
  ```
  - `ctx` has `storyId`, `chapterIds`, `entryIds` and `users` for the demo Story (`fixture/story.md`). Check real routes under `apps/web/src/app/` before writing paths.
  - `with: { as: "writer", setup }` keeps a second User on the same page, for collaborative shots.
  - Frame tightly with `frame` or a small viewport, so each image stays under 1 MB.
- Ask the user to start `pnpm dev` and `pnpm dev:sync`, and wait for them. Never start them yourself.
- Run `pnpm changelog:shots <today>`. It writes `apps/web/public/changelog/<today>/<name>.webp` and `<name>.dark.webp`.
- `Read` every image, light and dark. Fix the framing, waits or setup in the recipe and re-run until each one shows just the change.
- Reference each image under its line, indented to the bullet, with alt text describing what it shows. Reference only the light file; the dark one is found by name.
  ```md
  - **Smart punctuation.** Quotes turn curly as you type.
    ![A sentence typed with straight quotes, shown curly.](smart-punctuation.webp)
  ```
- Delete any image in `public/changelog/<today>/` that the markdown no longer references; the test rejects unreferenced files.

## 6. Check

Run `pnpm test` and `pnpm lint`, and fix what they report.

## 7. Stop

- Don't commit. Show the update and suggest `changelog: <Month D>` (e.g. `changelog: October 14`).
- Remind the user to commit the changelog on its own: the markdown, its images and the recipe. Any commit that touches `content/changelog/` becomes the next bookmark, so a feature mixed into it would be skipped next time.
