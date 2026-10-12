"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/viewer";
import { errorText, isUuid, type ActionResult } from "@/lib/action-result";

const UNIQUE_VIOLATION = "23505";
const INVALID = "Something went wrong. Try again.";

export async function sendFriendRequest(userId: string): Promise<ActionResult> {
  if (!isUuid(userId)) return INVALID;
  await requireProfile("/friends");
  const supabase = await createClient();

  const { error } = await supabase.rpc("send_friend_request", { p_user: userId });
  if (error?.message === "already_connected" || error?.code === UNIQUE_VIOLATION) {
    return "You're already connected, or a request is waiting.";
  }
  if (error) return errorText(error);

  refresh();
  return null;
}

export async function acceptFriendRequest(userId: string): Promise<ActionResult> {
  if (!isUuid(userId)) return INVALID;
  await requireProfile("/friends");
  const supabase = await createClient();

  const { error } = await supabase.rpc("accept_friend_request", { p_user: userId });
  if (error?.message === "not_found") return "That friend request no longer exists.";
  if (error) return errorText(error);

  refresh();
  return null;
}

/** Declines, cancels, or unfriends, depending on the connection's state. */
export async function removeFriendship(userId: string): Promise<ActionResult> {
  if (!isUuid(userId)) return INVALID;
  const me = await requireProfile("/friends");
  if (userId === me.userId) return INVALID;
  const supabase = await createClient();

  const { error } = await supabase.rpc("remove_friendship", { p_user: userId });
  if (error) return errorText(error);

  refresh();
  return null;
}
