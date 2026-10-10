# Coscribe

Invited friends write one story together, live, all typing into the same chapter at once. Anyone can watch a public story being written, no account needed.

Vocabulary (Host, Writer, Viewer, Chapter, Story Bible, Snapshot, ...) is defined in [`CONTEXT.md`](CONTEXT.md).

## Stack

- `apps/web`: Next.js 16 (App Router) + React 19 + TypeScript, plain CSS modules. Hosted on Vercel.
- `apps/sync`: Hocuspocus (Yjs) server for live Chapter and Entry documents. Hosted on Fly.io.
- `packages/editor`: the shared Tiptap/ProseMirror schema used by both.
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
cp apps/sync/.env.example apps/sync/.env  # local defaults work as-is
pnpm dev:sync                             # ws://localhost:1234
pnpm dev                                  # http://localhost:3000
```

`SYNC_SECRET` must match in `apps/web/.env.local` and `apps/sync/.env`.

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
| `dev:sync` | Hocuspocus sync server, restarting on change |
| `build` | Production build of the web app |
| `lint` | ESLint (web) |
| `test` | Vitest over `apps/*/src` and `packages/*/src` |
| `typecheck` | `tsc` in every workspace package |
| `db:start` / `db:stop` | Local Supabase stack |
| `db:reset` | Drop the local DB and re-apply migrations |
| `db:status` | Print URLs and keys for the running stack |
| `db:types` | Regenerate `apps/web/src/lib/supabase/database.types.ts` from the local DB |
| `deploy:sync` | Build and deploy `apps/sync` to Fly.io |

### Layout

```
apps/web/src/app/           Routes: home, login, auth/callback, onboarding, settings, u/[username],
                            friends, stories, stories/[storyId](/settings), invite/[token],
                            stories/[storyId]/chapters/[chapterId], stories/[storyId]/bible/[entryId],
                            stories/[storyId]/read(/[chapterId], /bible, /credits), privacy
apps/web/src/lib/supabase/  Browser, server, and proxy client factories (@supabase/ssr)
apps/web/src/lib/actions/   Server Actions
apps/web/src/components/    Shared UI, including LiveDocument (the Tiptap editor) and StoryChat
apps/sync/                  Hocuspocus server (persistence, auth, Snapshots, HTTP endpoints)
packages/editor/            Shared editor schema
supabase/migrations/        SQL migrations, applied by db:start / db:reset
supabase/config.toml        Local stack config
```

## Production

Live at https://coscribe.ink: the hosted Supabase project, `apps/sync` on Fly.io (`coscribe-sync.fly.dev`), and `apps/web` on Vercel. `supabase/config.toml` only configures the local stack: hosted Auth settings live in the dashboard.

### Supabase

1. Create the project, then `pnpm supabase link --project-ref <ref>` and `pnpm supabase db push` to apply `supabase/migrations/`. Run `db push` again after adding a migration.
2. **Auth → Providers:** disable Email. Enable Google (with *Skip nonce checks*, matching local) and Discord.
3. **Auth → URL Configuration:** Site URL `https://coscribe.ink`, redirect URL `https://coscribe.ink/**`.
4. `https://<ref>.supabase.co/auth/v1/.well-known/jwks.json` must list a key, since apps/sync verifies tokens against it. If it's empty, switch to asymmetric keys under **Settings → JWT Keys**.

In the Google and Discord OAuth apps, add `https://<ref>.supabase.co/auth/v1/callback` as a redirect next to the local one. Publish the Google consent screen (**Audience → Publish app**), or only listed test users can sign in. Publishing needs the **Branding** page complete: home page and privacy policy (`/privacy`) links, with `coscribe.ink` under *Authorized domains*.

### apps/sync on Fly.io

`apps/sync/fly.toml` runs one always-on machine. Keep it at one: open documents, presence, and Snapshot timing are in memory. Set `primary_region` to match the Supabase region. The Fly account needs a card on file: trial machines stop after 5 minutes.

Run these from the repo root, which is the Docker build context:

```bash
fly apps create coscribe-sync
fly secrets set --app coscribe-sync DATABASE_URL=... SUPABASE_URL=https://<ref>.supabase.co SYNC_SECRET=...
pnpm deploy:sync
```

| Secret | Value |
|---|---|
| `DATABASE_URL` | Supabase **Session pooler** string (port 5432, user `postgres.<ref>`). Not the transaction pooler: postgres.js uses prepared statements. The direct `db.<ref>` host is IPv6 only. |
| `SUPABASE_URL` | `https://<ref>.supabase.co`, the token issuer |
| `SYNC_SECRET` | A long random string, shared with apps/web |

### apps/web on Vercel

Import the repo with **Root Directory** `apps/web`, keeping *Include files outside the root directory* on (it builds `packages/editor`).

Under **Domains**, `coscribe.ink` serves production, and `www.coscribe.ink` and the `vercel.app` domain redirect to it. Vercel defaults to the reverse; keep it this way, because sign-in returns to the page's own domain, and Supabase only accepts `coscribe.ink`.

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The project's Publishable key |
| `NEXT_PUBLIC_SYNC_URL` | `wss://coscribe-sync.fly.dev` |
| `SYNC_SECRET` | Same as on Fly |

`NEXT_PUBLIC_*` values are baked in at build time, so redeploy after changing them. If the build picks the wrong pnpm, add `ENABLE_EXPERIMENTAL_COREPACK=1` to use the `packageManager` version.

### Shipping changes

- Pushing to `main` deploys apps/web. apps/sync doesn't deploy on push: run `pnpm deploy:sync` after changing `apps/sync` or `packages/editor`.
- A new migration goes out with `pnpm supabase db push`, before the code that needs it.
- Debugging: `fly logs --app coscribe-sync`, Vercel's Logs tab, and Supabase **Logs → Auth**.

## Sign-in flow

1. `/login` starts Google or Discord OAuth with a redirect to `/auth/callback?next=...`.
2. The callback trades the code for a session. A user without a `profiles` row goes to `/onboarding`.
3. Onboarding picks a unique username (`[a-z0-9_]{3,20}`, enforced by the DB) and an Author Color from a fixed palette.
4. Profiles are public at `/u/<username>`.

## Roles and permissions

Role rules live in SQL: `story_role()` / `can_view_story()` helpers for RLS, and `security definer` RPCs for anything touching more than one row (create story, change roles, hand off Host, invites). `apps/web/src/lib/story-roles.ts` mirrors them only to decide which buttons to show.

## Live editing

Each Chapter and each Story Bible Entry body is a Yjs document, named `chapter:<uuid>` or `entry:<uuid>`, served by `apps/sync` and stored in `chapters.ydoc` / `entries.ydoc`. An Entry's type, name, and short description are plain columns, so the Story Bible can be listed and searched without opening every document.

1. The Chapter page opens a Hocuspocus connection, sending the Supabase access token (Viewers who aren't signed in send none).
2. `onAuthenticate` verifies the token against the project's JWKS and looks up the user's role: members edit unless the Chapter is locked or the story is Finished (Entries have no lock); anyone else gets read-only access to a Public story, or is rejected.
3. When the web app changes access (lock or unlock, remove or leave, Visibility, delete a story, Chapter, or Entry), it calls `POST /stories/<id>/refresh` on the sync server with `SYNC_SECRET`. Open connections switch to read-only or back live, or are disconnected.

## Snapshots

`apps/sync` saves a Chapter's full Yjs state to `chapter_snapshots` after about 10 minutes of activity and when the last connection leaves, skipping it when the text and author marks match the latest Snapshot. The timing is kept in memory, so a sync restart only delays the next one.

Co-hosts and up open History on a Chapter. The web app checks permissions through Supabase (RLS on `chapter_snapshots`, the `authorize_restore()` RPC), then calls `apps/sync` with `SYNC_SECRET`:

- `GET /snapshots/<id>` decodes the Snapshot and returns ProseMirror JSON for the preview.
- `POST /snapshots/<id>/restore` first snapshots the current text ("Before Restore"), then rewrites the live Chapter through a Hocuspocus direct connection as a diff, which open editors receive like any other edit. Author marks come back with the text.

"Copy from this Snapshot" copies the preview's selection (or all of it) as ProseMirror clipboard HTML, so pasting into the Chapter keeps each run's original author. Hosts can name Snapshots.

## Story Chat

`chat_messages` rows are readable and writable only by members (RLS via `story_role()`), and the table is in the `supabase_realtime` publication. The panel lives in `stories/[storyId]/layout.tsx`, so it stays subscribed while moving between a story's pages, and it's never rendered for Viewers. Realtime applies the same select policy per subscriber, so a removed Writer stops receiving messages.

## Finished and the Reader View

The Host marks a story Finished (or reopens it) in its settings, through the `set_story_finished()` RPC. The web app then calls `POST /stories/<id>/refresh`, and apps/sync switches every open Chapter and Entry to read-only live, since `onAuthenticate` and the refresh treat a Finished story like a locked Chapter.

A Finished story gets a Reader View at `/stories/<id>/read`: a title page with contents, each Chapter, the Story Bible on one page, and Credits. Its text comes from `GET /stories/<id>/content` on apps/sync, which returns every Chapter and Entry body as ProseMirror JSON (open documents read live, the rest decoded from storage), rendered server-side. Credits count the characters carrying each Writer's `author` mark, Chapters and Story Bible separately, and include former Writers whose text survives.

Profiles at `/u/<username>` list the Public stories that user hosts or writes in, Finished ones first.
