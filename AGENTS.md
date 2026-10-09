# Coscribe

Domain vocabulary lives in `CONTEXT.md`. Use its terms (Host, Co-host, Writer, Viewer, Chapter, Story Bible, Entry, Snapshot, Restore, Finished, ...) in code, UI copy, and SQL.

## Next.js

This Next.js has breaking changes from what you were trained on. Check `apps/web/node_modules/next/dist/docs/` before using an API you're unsure of.

## Database

- The local Supabase holds real accounts and test Stories, and nothing backs it up.
- Apply new migrations with `supabase migration up`, then `pnpm db:types`.
- Never run `pnpm db:reset`, `supabase db reset`, or anything else that drops or truncates data without asking first, even when a plan says to.

## Checks

`pnpm typecheck`, `pnpm test`, `pnpm lint`.
