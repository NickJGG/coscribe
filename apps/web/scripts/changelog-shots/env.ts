import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

export const BASE_URL = "http://localhost:3000";

export const WEB_DIR = path.resolve(import.meta.dirname, "../..");

export type Env = { supabaseUrl: string; anonKey: string; serviceKey: string; syncUrl: string };

/** The local Supabase's keys, refusing anything that isn't on this machine. */
export function loadEnv(): Env {
  const status = parseEnv(
    execSync("pnpm supabase status -o env", {
      cwd: path.resolve(WEB_DIR, "../.."),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
  );
  const supabaseUrl = status.API_URL;
  const anonKey = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
  const serviceKey = status.SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceKey) fail("Couldn't read the local Supabase keys. Is it running (`pnpm db:start`)?");
  if (!isLocal(supabaseUrl)) fail(`Refusing to run against ${supabaseUrl}: the demo accounts are local only.`);

  let local: Record<string, string | undefined> = {};
  try {
    local = parseEnv(readFileSync(path.join(WEB_DIR, ".env.local"), "utf8"));
  } catch {
    // No .env.local: sync on its default port.
  }
  const syncUrl = (local.NEXT_PUBLIC_SYNC_URL ?? "ws://localhost:1234").replace(/^ws/, "http");
  if (!isLocal(syncUrl)) fail(`Refusing to run against sync at ${syncUrl}.`);

  return { supabaseUrl, anonKey, serviceKey, syncUrl };
}

/** Never starts the servers: they're the user's to run. */
export async function checkServers(env: Env) {
  const up = (url: string) =>
    fetch(url, { signal: AbortSignal.timeout(5000) }).then(
      () => true,
      () => false
    );
  const [web, sync] = await Promise.all([up(BASE_URL), up(env.syncUrl)]);
  if (!web || !sync) fail("Start `pnpm dev` and `pnpm dev:sync` first.");
}

function isLocal(url: string) {
  const { hostname } = new URL(url);
  return hostname === "127.0.0.1" || hostname === "localhost";
}

export function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
