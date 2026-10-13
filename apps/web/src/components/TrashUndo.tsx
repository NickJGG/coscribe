"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";
import { UndoToast } from "./UndoToast";
import styles from "./TrashUndo.module.css";

/**
 * The Undo toast after moving something to the Trash, shown from the `?trashed=` its delete redirected
 * with. Undoing or letting it drain drops the param, so a reload doesn't bring it back; a failed Undo keeps
 * it, with the reason in place of the toast.
 */
export function TrashUndo({ title, undo }: { title: string; undo: () => Promise<ActionResult> }) {
  const router = useRouter();
  const pathname = usePathname();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dismiss = () => router.replace(pathname, { scroll: false });

  return (
    <div className={styles.dock}>
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : (
        <UndoToast
          onUndo={() => {
            if (pending) return;
            startTransition(async () => {
              const result = await undo();
              if (result) setError(result);
              else dismiss();
            });
          }}
          onExpire={dismiss}
        >
          Moved <strong>{title}</strong> to the Trash
        </UndoToast>
      )}
    </div>
  );
}
