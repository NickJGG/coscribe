import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/supabase/database.types";
import { AUTHOR_COLORS } from "../../src/lib/profile-rules";
import { fail, type Env } from "./env";

export type Role = "host" | "writer";

export type DemoUser = { role: Role; id: string; email: string; username: string };

const DEMO: Record<Role, { email: string; username: string; color: string }> = {
  host: { email: "demo-host@coscribe.local", username: "demo_june", color: AUTHOR_COLORS[6] },
  writer: { email: "demo-writer@coscribe.local", username: "demo_theo", color: AUTHOR_COLORS[3] },
};

export function adminClient(env: Env): SupabaseClient<Database> {
  return createClient<Database>(env.supabaseUrl, env.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Finds or creates both demo accounts, with finished profiles so they skip onboarding. */
export async function demoUsers(admin: SupabaseClient<Database>): Promise<Record<Role, DemoUser>> {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) fail(`Couldn't list users: ${error.message}`);

  const users = {} as Record<Role, DemoUser>;
  for (const role of ["host", "writer"] as const) {
    const { email, username, color } = DEMO[role];
    let id = data.users.find((user) => user.email === email)?.id;
    if (!id) {
      const created = await admin.auth.admin.createUser({ email, email_confirm: true });
      if (created.error) fail(`Couldn't create ${email}: ${created.error.message}`);
      id = created.data.user.id;
    }
    const { error: profileError } = await admin
      .from("profiles")
      .upsert({ id, username, author_color: color, theme: "system" });
    if (profileError) fail(`Couldn't set up ${username}'s profile: ${profileError.message}`);
    users[role] = { role, id, email, username };
  }
  return users;
}
