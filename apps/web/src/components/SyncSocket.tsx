"use client";

import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { HocuspocusProvider, HocuspocusProviderWebsocket } from "@hocuspocus/provider";
import * as Y from "yjs";
import { SCHEMA_VERSION, type SnapshotMessage, type SyncMessage } from "@coscribe/editor";

/** `snapshot` and `outdated` keep what apps/sync said, for a session reused after its message arrived. */
export type LiveSession = {
  provider: HocuspocusProvider;
  ydoc: Y.Doc;
  snapshot: SnapshotMessage | null;
  outdated: boolean;
};

type LiveDocuments = {
  /** The document's session, created on first open. Every open needs a matching close. */
  open: (name: string, token: () => Promise<string>) => LiveSession;
  close: (name: string) => void;
};

type Entry = LiveSession & { holders: number; answered: Promise<void> };

/** How long to wait for the server to answer a document's login before closing it anyway. */
const ANSWER_TIMEOUT_MS = 10_000;

const LiveDocumentsContext = createContext<LiveDocuments | null>(null);

/**
 * One websocket to apps/sync for every live document beneath it, so switching Chapters only syncs the new
 * text. Each document still authenticates on its own (apps/sync's onAuthenticate runs per document).
 *
 * It owns the documents too, because of how Hocuspocus queues messages for a document that isn't
 * authenticated yet: a close sent before the server answers is replayed right after the next login to
 * that document succeeds, killing the new connection. So a document reopened at once (React remounting
 * in development, quick back-and-forth) reuses its session, and a close waits for the server's answer.
 */
export function SyncSocketProvider({ children }: { children: React.ReactNode }) {
  const socket = useRef<HocuspocusProviderWebsocket | null>(null);
  const entries = useRef(new Map<string, Entry>());
  const mounted = useRef(false);

  const { documents, closeSocketIfDone } = useMemo(() => {
    const closeSocketIfDone = () => {
      if (mounted.current || entries.current.size) return;
      socket.current?.destroy();
      socket.current = null;
    };
    const documents: LiveDocuments = {
      open(name, token) {
        let entry = entries.current.get(name);
        if (!entry) {
          // Every document on the socket comes from this build, so the socket carries the schema version.
          socket.current ??= new HocuspocusProviderWebsocket({
            url: `${process.env.NEXT_PUBLIC_SYNC_URL!}?schema=${SCHEMA_VERSION}`,
          });
          const ydoc = new Y.Doc();
          const provider = new HocuspocusProvider({ websocketProvider: socket.current, name, document: ydoc, token });
          const answered = new Promise<void>((resolve) => {
            provider.on("authenticated", resolve);
            provider.on("authenticationFailed", resolve);
            setTimeout(resolve, ANSWER_TIMEOUT_MS);
          });
          // A provider on a shared socket doesn't attach itself.
          provider.attach();
          const created: Entry = { provider, ydoc, snapshot: null, outdated: false, holders: 0, answered };
          provider.on("stateless", ({ payload }: { payload: string }) => {
            const message = JSON.parse(payload) as SyncMessage;
            if (message.type === "snapshot") created.snapshot = message;
            else if (message.type === "outdated") created.outdated = true;
          });
          entry = created;
          entries.current.set(name, entry);
        }
        entry.holders++;
        return entry;
      },

      close(name) {
        const entry = entries.current.get(name);
        if (!entry) return;
        entry.holders--;
        void entry.answered.then(() =>
          setTimeout(() => {
            if (entry.holders > 0 || entries.current.get(name) !== entry) return;
            entries.current.delete(name);
            entry.provider.destroy();
            entry.ydoc.destroy();
            closeSocketIfDone();
          })
        );
      },
    };
    return { documents, closeSocketIfDone };
  }, []);

  // The socket outlives this provider until its last document is closed, so a remount keeps using it.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      closeSocketIfDone();
    };
  }, [closeSocketIfDone]);

  return <LiveDocumentsContext value={documents}>{children}</LiveDocumentsContext>;
}

/** Live documents on the shared socket. Call open and close from effects only. */
export function useLiveDocuments() {
  const documents = useContext(LiveDocumentsContext);
  if (!documents) throw new Error("useLiveDocuments needs a SyncSocketProvider");
  return documents;
}
