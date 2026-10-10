# Coscribe

Domain vocabulary lives in `CONTEXT.md`. Use its terms (Host, Co-host, Writer, Viewer, Chapter, Story Bible, Entry, Snapshot, Restore, Finished, ...) in code, UI copy, and SQL.

## Next.js

This Next.js has breaking changes from what you were trained on. Check `apps/web/node_modules/next/dist/docs/` before using an API you're unsure of.

## Database

- The local Supabase holds real accounts and test Stories, and nothing backs it up.
- Apply new migrations with `supabase migration up`, then `pnpm db:types`.
- Never run `pnpm db:reset`, `supabase db reset`, or anything else that drops or truncates data without asking first, even when a plan says to.

## Production

- Live at Vercel (apps/web), Fly.io (`coscribe-sync`), and a hosted Supabase project linked to this repo. See the README's Production section.
- Never run anything that touches production without asking first: `supabase db push`, any `supabase` command with `--linked`, `pnpm deploy:sync`, `fly deploy`, `fly secrets`, or `fly machine`/`scale`. Read-only checks (`fly status`, `fly logs`) are fine.
- Never edit a migration that's already in `supabase/migrations/`; production has applied it. Add a new one.

## Checks

`pnpm typecheck`, `pnpm test`, `pnpm lint`.
