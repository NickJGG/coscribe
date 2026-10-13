"use client";

import { useState } from "react";
import { OutlineIcon } from "../icons";
import { OutlineDialog } from "./OutlineDialog";

/** The toolbar's way into the Chapter's Outline, for Writers. The Outline connects only while its dialog is open. */
export function OutlineButton({ chapterId, eyebrow }: { chapterId: string; eyebrow: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="button button-ghost button-tiny with-icon"
        data-tip="Outline"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <OutlineIcon />
        <span className="with-icon-label">Outline</span>
      </button>
      {open && <OutlineDialog chapterId={chapterId} eyebrow={eyebrow} onClose={() => setOpen(false)} />}
    </>
  );
}
