"use client";

import { useActionState, useRef, useState } from "react";
import type { ActionResult } from "@/lib/action-result";
import { ConfirmDialog, type Confirm } from "./ConfirmDialog";
import { useDropdown } from "./Dropdown";
import styles from "./ActionForm.module.css";

/**
 * A form around a Server Action that returns an error message (or null), with an optional confirm step.
 * The confirm stays open until the action succeeds, showing its error if it fails. Inside a Dropdown, asking
 * closes the menu and cancelling returns focus to its button.
 */
export function ActionForm({
  action,
  confirm,
  className,
  children,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  confirm?: Confirm;
  className?: string;
  children: React.ReactNode;
}) {
  const [asking, setAsking] = useState(false);
  const confirmed = useRef(false);
  const submitter = useRef<HTMLElement | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const dropdown = useDropdown();
  const [error, formAction, pending] = useActionState(
    confirm
      ? async (prev: ActionResult, formData: FormData) => {
          const result = await action(prev, formData);
          if (!result) setAsking(false);
          return result;
        }
      : action,
    null
  );

  return (
    <>
      <form
        ref={formRef}
        action={formAction}
        className={className}
        onSubmit={(e) => {
          if (!confirm || confirmed.current) {
            confirmed.current = false;
            return;
          }
          e.preventDefault();
          submitter.current = e.nativeEvent.submitter;
          dropdown?.close();
          setAsking(true);
        }}
      >
        <fieldset disabled={pending} className={styles.fieldset}>
          {children}
        </fieldset>
        {error && !asking && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
      </form>
      {confirm && (
        <ConfirmDialog
          {...confirm}
          open={asking}
          pending={pending}
          error={error}
          onCancel={() => setAsking(false)}
          onConfirm={() => {
            confirmed.current = true;
            formRef.current?.requestSubmit(submitter.current);
          }}
          returnTo={dropdown ? () => dropdown.trigger.current : undefined}
        />
      )}
    </>
  );
}
