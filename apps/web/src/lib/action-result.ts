/** What `ActionForm` actions return: an error message to show, or null on success. */
export type ActionResult = string | null;

// Exception messages raised by the RPCs in supabase/migrations/.
const RPC_ERRORS: Record<string, string> = {
  not_signed_in: "Sign in first.",
  not_allowed: "You don't have permission to do that.",
  not_member: "They're no longer in this story.",
  not_friends: "You can only invite Friends.",
  already_member: "You're already writing in this story.",
  invite_not_found: "That invite no longer exists.",
  invite_used: "That Invite Link has already been used.",
  host_cannot_leave: "Hand off Host before leaving.",
  story_finished: "This story is Finished.",
  last_chapter: "A story needs at least one Chapter.",
  chapter_locked: "This Chapter is locked.",
  not_a_color: "Pick one of the colors.",
  color_taken: "Another Writer in this story has that color.",
};

export function errorText(error: { message: string } | null): ActionResult {
  if (!error) return null;
  return RPC_ERRORS[error.message] ?? "Something went wrong. Try again.";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
