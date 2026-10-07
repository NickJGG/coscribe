"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/action-result";
import styles from "./ActionForm.module.css";

/** A form around a Server Action that returns an error message (or null), with an optional confirm step. */
export function ActionForm({
  action,
  confirm,
  className,
  children,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  confirm?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [error, formAction, pending] = useActionState(action, null);

  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      <fieldset disabled={pending} className={styles.fieldset}>
        {children}
      </fieldset>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </form>
  );
}
