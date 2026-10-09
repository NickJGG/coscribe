import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStory } from "@/lib/story";
import { requireProfile } from "@/lib/viewer";
import { canManageInvites } from "@/lib/story-roles";
import { NavLink } from "@/components/NavLink";
import styles from "./settings.module.css";

export const metadata: Metadata = { title: "Story settings" };

export default async function StorySettingsLayout(props: LayoutProps<"/stories/[storyId]/settings">) {
  const { storyId } = await props.params;
  await requireProfile(`/stories/${storyId}/settings`);
  const data = await getStory(storyId);
  if (!data?.myRole) notFound();
  const { myRole } = data;
  const base = `/stories/${storyId}/settings`;

  const tabs = [
    { slug: "story", label: "Story", shown: myRole === "host" },
    { slug: "writers", label: "Writers", shown: true },
    { slug: "invites", label: "Invites", shown: canManageInvites(myRole) },
    { slug: "you", label: "You", shown: true },
  ].filter((t) => t.shown);

  return (
    <div className="page">
      <h1>Settings</h1>
      <nav className={styles.tabs} aria-label="Settings">
        {tabs.map(({ slug, label }) => (
          <NavLink key={slug} href={`${base}/${slug}`} className={styles.tab}>
            {label}
          </NavLink>
        ))}
      </nav>
      {props.children}
    </div>
  );
}
