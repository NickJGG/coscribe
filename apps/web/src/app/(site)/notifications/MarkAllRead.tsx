"use client";

import { useRouter } from "next/navigation";
import { MarkAllReadButton } from "@/components/Notifications";

export function MarkAllRead() {
  const router = useRouter();
  return <MarkAllReadButton className="button button-ghost button-small" onDone={() => router.refresh()} />;
}
