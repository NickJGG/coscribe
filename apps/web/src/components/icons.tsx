/** Stroked 20×20 icons; their size and stroke come from the `className` (or `.with-icon`). */

export function NoteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden>
      <path d="M4 4.5h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H9l-3.5 3v-3H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

/** `filled` fills the head, as on a pinned Entry. */
export function PinIcon({ className, filled = false }: { className?: string; filled?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden>
      <path d="M7.5 3.5h5M8.5 3.5v5L6 11.5h8l-2.5-3v-5z" fill={filled ? "currentColor" : undefined} />
      <path d="M10 11.5V17" />
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

/** A drag handle. Filled on a 16×16 grid, unlike the rest. */
export function GripIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      {[3.5, 8, 12.5].map((y) => (
        <g key={y}>
          <circle cx="5.5" cy={y} r="1.3" />
          <circle cx="10.5" cy={y} r="1.3" />
        </g>
      ))}
    </svg>
  );
}

export function AddNoteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden>
      <path d="M4 4.5h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H9l-3.5 3v-3H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z" />
      <path d="M10 7v3.5M8.25 8.75h3.5" />
    </svg>
  );
}

export function SceneBreakIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden>
      {[4, 10, 16].map((cx) => (
        <circle key={cx} cx={cx} cy="10" r="1.6" fill="currentColor" stroke="none" />
      ))}
    </svg>
  );
}

export function BlockQuoteIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden>
      <path
        fill="currentColor"
        stroke="none"
        d="M3.75 5h5v5c0 2.75-1.63 4.5-4.38 5l-.5-1.38c1.76-.5 2.38-1.62 2.38-3.62h-2.5Zm7.5 0h5v5c0 2.75-1.63 4.5-4.38 5l-.5-1.38c1.76-.5 2.38-1.62 2.38-3.62h-2.5Z"
      />
    </svg>
  );
}

/** The short lines' starts, for left, centered and right-aligned text. */
const ALIGN_INDENT = { left: 3, center: 5.5, right: 8 };

export function AlignIcon({ align }: { align: keyof typeof ALIGN_INDENT }) {
  const x = ALIGN_INDENT[align];
  return (
    <svg viewBox="0 0 20 20" aria-hidden>
      <path d={`M3 4.5h14M${x} 8.5h9M3 12.5h14M${x} 16.5h9`} />
    </svg>
  );
}

export function BulletListIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden>
      {[5.5, 10, 14.5].map((cy) => (
        <circle key={cy} cx="3.75" cy={cy} r="1.2" fill="currentColor" stroke="none" />
      ))}
      <path d="M7.5 5.5h9.5M7.5 10h9.5M7.5 14.5h9.5" />
    </svg>
  );
}

export function NumberedListIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden>
      <path d="M3 4.25 4.5 3.5v5M2.75 12.25a1.5 1.5 0 0 1 3 .25c0 1.25-3 2.25-3 3.75h3M8.5 6h8.5M8.5 14h8.5" />
    </svg>
  );
}

export function SlidersIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden>
      <path d="M3 6h7.5M14.5 6H17M3 14h2.5M9.5 14H17" />
      <circle cx="12.5" cy="6" r="2" />
      <circle cx="7.5" cy="14" r="2" />
    </svg>
  );
}

export function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden>
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}

/** A page of headed lines: the Chapter's Outline. */
export function OutlineIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden>
      <rect x="3.5" y="2.5" width="13" height="15" rx="1.5" />
      <path d="M6.5 6.5h7M8.5 9.5h5M8.5 12.5h5M6.5 9.5h0M6.5 12.5h0" />
    </svg>
  );
}
