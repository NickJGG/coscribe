# Coscribe

Domain vocabulary lives in `CONTEXT.md`. Use its terms (Host, Co-host, Writer, Viewer, Chapter, Story Bible, Entry, Snapshot, Restore, Finished, ...) in code, UI copy, and SQL.

## Next.js

This Next.js has breaking changes from what you were trained on. Check `apps/web/node_modules/next/dist/docs/` before using an API you're unsure of.

## Database

- The local Supabase holds real accounts and test Stories, and nothing backs it up.
- Apply new migrations with `supabase migration up`, then `pnpm db:types`.
- Never run `pnpm db:reset`, `supabase db reset`, or anything else that drops or truncates data without asking first, even when a plan says to.

## Production

- Live at https://coscribe.ink: Vercel (apps/web), Fly.io (`coscribe-sync`), and a hosted Supabase project linked to this repo. See the README's Production section.
- Never run anything that touches production without asking first: `supabase db push`, any `supabase` command with `--linked`, `pnpm deploy:sync`, `fly deploy`, `fly secrets`, or `fly machine`/`scale`. Read-only checks (`fly status`, `fly logs`) are fine.
- Never edit a migration that's already in `supabase/migrations/`; production has applied it. Add a new one.
- Migrations reach production before the code that uses them, so the deployed code must keep working against the new schema: add columns, tables, and functions rather than renaming or dropping in the same change.
- With the suggested commit message, list the database and deploy steps the change needs, in order:
  - Local: `pnpm supabase migration up` then `pnpm db:types` for a new migration, saying whether it's already been applied locally.
  - Production, before pushing: `pnpm supabase db push` for a new migration, then `pnpm deploy:sync` for changes to `apps/sync` or `packages/editor`.

## Checks

`pnpm typecheck`, `pnpm test`, `pnpm lint`.
