import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarkChangelogSeen } from "@/components/MarkChangelogSeen";
import { UpdateCard } from "@/components/UpdateCard";
import { getUpdate, lineText, unseenUpdateDate } from "@/lib/changelog";
import { getViewer } from "@/lib/viewer";
import styles from "../changelog.module.css";

export async function generateMetadata({ params }: PageProps<"/changelog/[date]">): Promise<Metadata> {
  const update = await getUpdate((await params).date);
  if (!update) return {};
  return { title: `${update.title} · Changelog`, description: lineText(update.groups[0]!.lines[0]!) };
}

export default async function UpdatePage({ params }: PageProps<"/changelog/[date]">) {
  const update = await getUpdate((await params).date);
  if (!update) notFound();
  const profile = (await getViewer())?.profile;
  const unseen = profile && (await unseenUpdateDate(profile.changelog_seen));

  return (
    <div className="page">
      {unseen && <MarkChangelogSeen date={unseen} />}
      <Link href="/changelog" className={styles.back}>
        &larr; All updates
      </Link>
      <UpdateCard update={update} standalone />
    </div>
  );
}
