/** Stroked 20×20 icons; their size and stroke come from the `className` (or `.with-icon`). */

export function NoteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden>
      <path d="M4 4.5h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H9l-3.5 3v-3H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

/** `open` drops the shackle's right leg. */
export function LockIcon({ open = false, className }: { open?: boolean; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden>
      <rect x="4.5" y="9" width="11" height="8" rx="1.5" />
      <path d={open ? "M7 9V6.5a3 3 0 0 1 6 0" : "M7 9V6.5a3 3 0 0 1 6 0V9"} />
    </svg>
  );
}

export function CameraIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden>
      <path d="M3 7a1.5 1.5 0 0 1 1.5-1.5h2l1.2-2h4.6l1.2 2h2A1.5 1.5 0 0 1 17 7v7.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5Z" />
      <circle cx="10" cy="10.5" r="3" />
    </svg>
  );
}
