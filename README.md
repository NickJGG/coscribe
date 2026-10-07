# Coscribe

Invited friends write one story together, live, all typing into the same chapter at once. Anyone can watch a public story being written, no account needed.

Vocabulary (Host, Writer, Viewer, Chapter, Story Bible, Snapshot, ...) is defined in [`CONTEXT.md`](CONTEXT.md).

## Stack

- `apps/web`: Next.js 16 (App Router) + React 19 + TypeScript, plain CSS modules. Hosted on Vercel.
- `apps/sync`: Hocuspocus (Yjs) server for live Chapter and Entry documents. Hosted on Fly.io. *(stub)*
- `packages/editor`: the shared Tiptap/ProseMirror schema used by both. *(stub)*
- Supabase: Postgres, Auth (Google and Discord OAuth), Realtime. Docker-backed local stack for dev.

## Local setup

Prerequisites: Node 20+, pnpm, Docker Desktop running.

```bash
pnpm install
cp supabase/.env.example supabase/.env    # OAuth client IDs and secrets, see below
pnpm db:start                             # boots local Supabase, applies migrations
cp apps/web/.env.local.example apps/web/.env.local
```

Fill `apps/web/.env.local` with the API URL and Publishable key printed by `db:start` (or `pnpm db:status`).

```bash
pnpm dev                                  # http://localhost:3000
```

Use `localhost`, not `127.0.0.1`: the auth `site_url` is `http://localhost:3000`, and the PKCE cookie has to come back to the same host that started sign-in.

Supabase Studio is at http://127.0.0.1:55323.

The local stack uses ports 55320–55329 instead of Supabase's 543xx defaults, because Windows (Hyper-V/WinNAT) can reserve the 54xxx range. Check with `netsh interface ipv4 show excludedportrange protocol=tcp`.

### OAuth providers (local)

Both providers redirect to the local auth server at `http://127.0.0.1:55321/auth/v1/callback`. Put the credentials in `supabase/.env`, then restart the stack (`pnpm db:stop && pnpm db:start`).

- **Google:** [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → Create credentials → OAuth client ID → Web application. Add the callback URL above under *Authorized redirect URIs*. Copy the client ID and secret into `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `_SECRET`.
- **Discord:** [Discord Developer Portal](https://discord.com/developers/applications) → New Application → OAuth2. Add the callback URL above as a redirect. Copy the client ID and secret into `SUPABASE_AUTH_EXTERNAL_DISCORD_CLIENT_ID` / `_SECRET`.

### Scripts

| | |
|---|---|
| `dev` | Next.js dev server |
| `build` | Production build of the web app |
| `lint` | ESLint (web) |
| `test` | Vitest over `apps/*/src` and `packages/*/src` |
| `typecheck` | `tsc` in every workspace package |
| `db:start` / `db:stop` | Local Supabase stack |
| `db:reset` | Drop the local DB and re-apply migrations |
| `db:status` | Print URLs and keys for the running stack |
| `db:types` | Regenerate `apps/web/src/lib/supabase/database.types.ts` from the local DB |

### Layout

```
apps/web/src/app/           Routes: home, login, auth/callback, onboarding, settings, u/[username]
apps/web/src/lib/supabase/  Browser, server, and proxy client factories (@supabase/ssr)
apps/web/src/lib/actions/   Server Actions
apps/sync/                  Hocuspocus server
packages/editor/            Shared editor schema
supabase/migrations/        SQL migrations, applied by db:start / db:reset
supabase/config.toml        Local stack config
```

## Sign-in flow

1. `/login` starts Google or Discord OAuth with a redirect to `/auth/callback?next=...`.
2. The callback trades the code for a session. A user without a `profiles` row goes to `/onboarding`.
3. Onboarding picks a unique username (`[a-z0-9_]{3,20}`, enforced by the DB) and an Author Color from a fixed palette.
4. Profiles are public at `/u/<username>`.
