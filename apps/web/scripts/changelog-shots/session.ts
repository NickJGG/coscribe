import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cookie } from "playwright";
import type { Database } from "../../src/lib/supabase/database.types";
import { fail, type Env } from "./env";

export type Session = { cookies: Cookie[]; client: SupabaseClient<Database> };

/**
 * Signs in by redeeming a magic link server side, so no email is sent. The cookies are the web app's own, and sync
 * reads its access token from them, so live editing works too.
 */
export async function signIn(env: Env, admin: SupabaseClient<Database>, email: string): Promise<Session> {
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error) fail(`Couldn't make a sign-in link for ${email}: ${link.error.message}`);

  const jar = new Map<string, string>();
  const client = createServerClient<Database>(env.supabaseUrl, env.anonKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => {
        for (const { name, value } of cookies) {
          if (value) jar.set(name, value);
          else jar.delete(name);
        }
      },
    },
  });
  const { error } = await client.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: "magiclink" });
  if (error) fail(`Couldn't sign in ${email}: ${error.message}`);

  const cookies = [...jar].map(([name, value]): Cookie => ({
    name,
    value,
    domain: "localhost",
    path: "/",
    expires: -1,
    httpOnly: false,
    secure: false,
    sameSite: "Lax",
  }));
  return { cookies, client };
}
