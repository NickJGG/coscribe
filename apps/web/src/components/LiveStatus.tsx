"use client";

import { createContext, useCallback, useContext, useState } from "react";

export type LiveConnection = "connecting" | "live" | "offline" | "denied";

/** A Writer in the open document right now: one entry per person, however many tabs. */
export type PresentWriter = { id: string; name: string; color: string };

/**
 * The open live document as the desk around it shows it. `slow` turns true once connecting has taken
 * about a second; `ready` once its text is synced and on screen.
 */
export type LiveStatus = {
  doc: string | null;
  connection: LiveConnection;
  slow: boolean;
  ready: boolean;
  readOnly: boolean;
  writers: PresentWriter[];
  viewers: number;
  words: number;
};

export const NO_DOCUMENT: LiveStatus = {
  doc: null,
  connection: "connecting",
  slow: false,
  ready: false,
  readOnly: true,
  writers: [],
  viewers: 0,
  words: 0,
};

type Report = (patch: Partial<LiveStatus>) => void;

// Split so a document reporting every keystroke doesn't re-render itself through its own context.
const ReportContext = createContext<Report>(() => {});
const StatusContext = createContext<LiveStatus>(NO_DOCUMENT);

export function LiveStatusProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState(NO_DOCUMENT);
  const report = useCallback<Report>((patch) => setStatus((s) => ({ ...s, ...patch })), []);

  return (
    <ReportContext value={report}>
      <StatusContext value={status}>{children}</StatusContext>
    </ReportContext>
  );
}

/** How a live document tells the desk about itself. A no-op outside a LiveStatusProvider. */
export function useLiveReport() {
  return useContext(ReportContext);
}

export function useLiveStatus() {
  return useContext(StatusContext);
}
