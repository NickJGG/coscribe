"use client";

import { useRef, useState, useTransition } from "react";
import type { ActionResult } from "@/lib/action-result";
import styles from "./InlineEdit.module.css";

/**
 * Text that turns into an input when clicked, in the same type as `className` gives it. Enter or leaving
 * the field saves; Escape cancels. Without `editable` it's plain text, and `placeholder` shows only to
 * those who can fill it in.
 */
export function InlineEdit({
  as: Tag,
  className,
  value,
  label,
  maxLength,
  placeholder,
  editable,
  spellCheck,
  onSave,
}: {
  as: "h1" | "p";
  className?: string;
  value: string;
  label: string;
  maxLength: number;
  placeholder?: string;
  editable: boolean;
  spellCheck?: boolean;
  onSave: (next: string) => Promise<ActionResult>;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Disabling or removing the focused input blurs it, which would save a second time.
  const settled = useRef(false);

  if (!editable) return value ? <Tag className={className}>{value}</Tag> : null;

  function save(input: HTMLInputElement) {
    if (settled.current) return;
    settled.current = true;
    const next = input.value.trim();
    if (next === value) return setEditing(false);
    startTransition(async () => {
      const result = await onSave(next);
      setError(result);
      if (result) settled.current = false;
      else setEditing(false);
    });
  }

  return (
    <>
      <Tag className={className}>
        {editing ? (
          <input
            className={styles.input}
            defaultValue={value}
            aria-label={label}
            placeholder={placeholder}
            maxLength={maxLength}
            spellCheck={spellCheck}
            disabled={pending}
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            onBlur={(e) => save(e.currentTarget)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                save(e.currentTarget);
              } else if (e.key === "Escape") {
                e.preventDefault();
                settled.current = true;
                setError(null);
                setEditing(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            className={styles.button}
            data-empty={!value || undefined}
            onClick={() => {
              settled.current = false;
              setEditing(true);
            }}
            title={`Edit ${label.toLowerCase()}`}
          >
            {value || placeholder}
          </button>
        )}
      </Tag>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </>
  );
}
