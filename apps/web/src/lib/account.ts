import { isWriter, type MemberRole } from "./story-roles";

type MembershipRow = {
  role: MemberRole;
  story: {
    id: string;
    title: string;
    members: { role: MemberRole; joined_at: string; profile: { id: string; username: string } }[];
  };
};

export type HandOver = {
  id: string;
  title: string;
  /** Who could take over: Co-hosts first, then Writers, each in join order. */
  writers: { id: string; username: string; role: MemberRole }[];
};

/**
 * Splits the live Stories a User Hosts the way delete_account (0043) does: those with other Writers need a new
 * Host first, the rest are deleted with the account. Viewers don't count.
 */
export function hostedStories(rows: MembershipRow[], userId: string) {
  const handOver: HandOver[] = [];
  const solo: { id: string; title: string }[] = [];
  for (const { role, story } of rows) {
    if (role !== "host") continue;
    const writers = story.members
      .filter((m) => m.profile.id !== userId && isWriter(m.role))
      .sort(
        (a, b) => Number(b.role === "cohost") - Number(a.role === "cohost") || a.joined_at.localeCompare(b.joined_at)
      )
      .map((m) => ({ id: m.profile.id, username: m.profile.username, role: m.role }));
    if (writers.length) handOver.push({ id: story.id, title: story.title, writers });
    else solo.push({ id: story.id, title: story.title });
  }
  return { handOver, solo };
}
