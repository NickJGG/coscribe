"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/viewer";
import { errorText, isUuid, type ActionResult } from "@/lib/action-result";
import { isInviteLinkDays } from "@/lib/story-roles";

const INVALID = "Something went wrong. Try again.";
const JOIN_FINISHED = "This story is Finished. You can join once it's Reopened.";

export type InviteRole = "writer" | "viewer";

export async function inviteFriend(storyId: string, userId: string, role: InviteRole): Promise<ActionResult> {
  if (!isUuid(storyId) || !isUuid(userId) || !isInviteRole(role)) return INVALID;
  await requireProfile(`/stories/${storyId}/settings`);

  const supabase = await createClient();
  const { error } = await supabase.rpc("invite_friend", { p_story: storyId, p_user: userId, p_role: role });
  if (error) return error.message === "already_member" ? "They're already in this story." : errorText(error);

  refresh();
  return null;
}

/** The new link shows up in the settings page's pending list, so there's nothing to return. */
export async function createInviteLink(
  storyId: string,
  role: InviteRole,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const lasts = Number(formData.get("lasts") ?? 7);
  if (!isUuid(storyId) || !isInviteRole(role) || !isInviteLinkDays(lasts)) return INVALID;
  await requireProfile(`/stories/${storyId}/settings`);

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_invite_link", { p_story: storyId, p_role: role, p_lasts: lasts });
  if (error) return errorText(error);

  refresh();
  return null;
}

/** Declining (as the invitee) and revoking (as a Co-host or the Host) are the same delete. */
export async function deleteInvite(inviteId: string): Promise<ActionResult> {
  if (!isUuid(inviteId)) return INVALID;
  await requireProfile("/stories");

  const supabase = await createClient();
  const { error } = await supabase.from("invites").delete().eq("id", inviteId);
  if (error) return errorText(error);

  refresh();
  return null;
}

export async function acceptInvite(inviteId: string): Promise<ActionResult> {
  if (!isUuid(inviteId)) return INVALID;
  await requireProfile("/stories");

  const supabase = await createClient();
  const { data: storyId, error } = await supabase.rpc("accept_invite", { p_invite: inviteId });
  if (error) return error.message === "story_finished" ? JOIN_FINISHED : errorText(error);

  redirect(`/stories/${storyId}`);
}

export async function acceptInviteLink(token: string): Promise<ActionResult> {
  await requireProfile(`/invite/${encodeURIComponent(token)}`);

  const supabase = await createClient();
  const { data: storyId, error } = await supabase.rpc("accept_invite_link", { p_token: token });
  if (error) return error.message === "story_finished" ? JOIN_FINISHED : errorText(error);

  redirect(`/stories/${storyId}`);
}

function isInviteRole(role: unknown): role is InviteRole {
  return role === "writer" || role === "viewer";
}
