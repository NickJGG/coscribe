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
- **Words:** `CONTEXT.md` vocabulary (host, co-host, writer, viewer, chapter, story bible, entry, snapshot, restore, finished, ...), written in lowercase like ordinary words. Capitalize only sentence starts, leads, and proper names (Coscribe, Markdown). Describe a button rather than quoting its label ("the line break button in the toolbar"). Say what the reader can now do, not how it was built.
- No line cap. A thin range gets a short update; don't push back on it.

### Voice

Write like a person telling a friend what changed. Several of these together are what make text read as machine-written (Wikipedia's "Signs of AI writing"), so check the draft against them before saving.

- **Specifics over claims.** Name the key, the button, where it lives. No "seamless", "powerful", "easily", "now you can", "we're excited", or exclamation marks.
- **Plain verbs.** "is", "has", "opens", not "serves as", "features", "boasts", "offers".
- **No setups.** No "not just X, it's Y", no "whether you're A or B", no closing line that sums up or says why it matters.
- **Lists as long as the facts.** Don't pad to three or trim to three. Oxford comma in any list of three or more.
- **Repeat a word** rather than reach for a synonym.
- **No em dashes in prose.** Use a period, a comma, or a semicolon.
- **Bold only the lead.** Nothing else in a line is bold.
- **Full sentences**, varied in length. Read the line aloud; if it sounds like a press release, cut it down.
- **Don't let the lines match.** The `**Lead.** Description.` format already gives every line one shape, so vary what follows it: not every line opens with "you", ends on a list, or runs two sentences. If the lines read alike, the rules above are being over-applied.
- **House style, not tells:** the bold lead, and curly quotes in the app (smart punctuation makes them). Leave both.

### Revise

After the draft, before writing the file:

1. **Critique.** List what still reads as machine-written, by the Voice rules, and fix those lines. A single weak tell (one list of three, one short sentence) is fine; act when several pile up in a line.
2. **Check every claim.** Each fact traces to a diff or the UI copy you read: the key, the label, where it lives, who can do it. Cut what you can't trace rather than guess, and don't call a fix a regression ("again") unless the history shows it worked before.

## 4. Write

- If today's file exists, add to it: merge into its groups rather than writing a second update.
- `# Title`: short, naming the headline changes (e.g. "Curly quotes and line breaks").
- `## New`, `## Improved`, `## Fixed` in that order; leave out empty ones.
- Every bullet is `- **Lead.** Description.` The lead is a few words; the description is one or two plain sentences.

## 5. Screenshots

- Picture the writing features: the editor, desk and reader doing the new thing. Skip account and settings pages, and the changelog itself. Not every line needs one.
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
  - A `setup` that types into the demo Story needs a `cleanup` that removes it. Clicking and Control+End leave the caret at the start of a chapter, so place it through the DOM selection (see `recipes/2026-10-14.ts`), and check the chapter still matches `fixture/story.md` afterwards.
  - Crop every shot to just the change and what's needed to place it, never the whole page. `frame` takes one selector, or a list to crop to the padded box around all of them (e.g. a menu's trigger and its panel).
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
