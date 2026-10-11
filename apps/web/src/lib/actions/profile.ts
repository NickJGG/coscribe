"use server";

import { redirect } from "next/navigation";
import { refresh, revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { bioError, isAuthorColor, normalizeBio, normalizeUsername, usernameError } from "@/lib/profile-rules";
import { safeNext } from "@/lib/safe-next";
import { requireProfile } from "@/lib/viewer";
import type { Database } from "@/lib/supabase/database.types";

export type Theme = Database["public"]["Enums"]["theme"];

export type ProfileFormState = {
  username: string;
  authorColor: string;
  bio: string;
  usernameError?: string;
  bioError?: string;
  colorError?: string;
  formError?: string;
};

const UNIQUE_VIOLATION = "23505";

export async function saveProfile(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const authorColor = String(formData.get("author_color") ?? "");
  const hasBio = formData.has("bio");
  const bio = normalizeBio(String(formData.get("bio") ?? ""));
  const state: ProfileFormState = { username, authorColor, bio: bio ?? "" };

  const nameProblem = usernameError(username);
  if (nameProblem) return { ...state, usernameError: nameProblem };
  const bioProblem = bioError(bio);
  if (bioProblem) return { ...state, bioError: bioProblem };
  if (!isAuthorColor(authorColor)) return { ...state, colorError: "Pick one of the colors." };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) redirect("/login");

  const { error } = await supabase
    .from("profiles")
    .upsert({ id: userId, username, author_color: authorColor, ...(hasBio && { bio }) });

  if (error?.code === UNIQUE_VIOLATION) return { ...state, usernameError: "That username is taken." };
  if (error) return { ...state, formError: "Couldn't save your profile. Try again." };

  revalidatePath("/", "layout");
  redirect(safeNext(formData.get("next"), `/u/${username}`));
}

/** Live hint while typing; saveProfile still enforces uniqueness through the unique constraint. */
export async function isUsernameAvailable(raw: string): Promise<boolean> {
  const username = normalizeUsername(raw);
  if (usernameError(username)) return false;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const { data: owner } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  return !owner || owner.id === data?.claims.sub;
}

const THEMES: readonly Theme[] = ["light", "dark", "system"];

export async function setTheme(theme: Theme): Promise<void> {
  if (!THEMES.includes(theme)) return;
  const me = await requireProfile("/settings");
  const supabase = await createClient();
  await supabase.from("profiles").update({ theme }).eq("id", me.userId);
  refresh();
}

/** Off hides you from Friends' "Online now". Writers in a shared Story still see you there. */
export async function setShowOnline(show: boolean): Promise<void> {
  const me = await requireProfile("/settings");
  const supabase = await createClient();
  await supabase.from("profiles").update({ show_online: show === true }).eq("id", me.userId);
  refresh();
}
