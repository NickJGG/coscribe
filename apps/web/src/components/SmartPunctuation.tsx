"use client";

import { createContext, useContext, useEffect } from "react";
import type { Editor } from "@tiptap/core";

const SmartPunctuationContext = createContext(true);

/** The Story's Smart punctuation setting, for every editor on the desk. */
export function SmartPunctuationProvider({ on, children }: { on: boolean; children: React.ReactNode }) {
  return <SmartPunctuationContext value={on}>{children}</SmartPunctuationContext>;
}

/** Keeps `editor`'s SmartPunctuation extension (built once, with the editor) in step with the Story's setting. */
export function useSmartPunctuation(editor: Editor | null) {
  const on = useContext(SmartPunctuationContext);
  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.commands.setSmartPunctuation(on);
  }, [editor, on]);
}
