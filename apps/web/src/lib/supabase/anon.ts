import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/** A client without the request's cookies, for what every visitor sees alike: it reads as a signed-out visitor. */
export function anonClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
