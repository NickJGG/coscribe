"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { HocuspocusProvider, HocuspocusProviderWebsocket } from "@hocuspocus/provider";
import * as Y from "yjs";
import { ACCESS_REVOKED, SCHEMA_VERSION, type SnapshotMessage, type SyncMessage } from "@coscribe/editor";
import { createClient } from "@/lib/supabase/client";
import type { LiveConnection } from "./LiveStatus";

/** `snapshot` and `outdated` keep what apps/sync said, for a session reused after its message arrived. */
export type LiveSession = {
  provider: HocuspocusProvider;
  ydoc: Y.Doc;
  snapshot: SnapshotMessage | null;
  outdated: boolean;
};

/** A `reference` session is a Pinned Entry's body, which apps/sync doesn't count as being in the document. */
type LiveDocuments = {
  /** The document's session, created on first open. Every open needs a matching close. */
  open: (name: string, token: () => Promise<string>, reference?: boolean) => LiveSession;
  close: (name: string, reference?: boolean) => void;
};

type Entry = LiveSession & { holders: number; answered: Promise<void>; reference: boolean };

const sessionKey = (name: string, reference = false) => (reference ? `ref:${name}` : name);

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
 *
 * Reference sessions get a second socket: Hocuspocus allows one session per document on a socket, and an
 * Entry page opened while its pinned body is still closing must not inherit (or be killed by) that one.
 */
export function SyncSocketProvider({ children }: { children: React.ReactNode }) {
  const sockets = useRef<{ live?: HocuspocusProviderWebsocket; reference?: HocuspocusProviderWebsocket }>({});
  const entries = useRef(new Map<string, Entry>());
  const mounted = useRef(false);

  const { documents, closeSocketIfDone } = useMemo(() => {
    // The live socket stays while the desk is mounted; the reference one only while a Pinned Entry is open.
    const closeSocketIfDone = () => {
      const open = [...entries.current.values()];
      for (const mode of ["live", "reference"] as const) {
        if (mode === "live" && mounted.current) continue;
        if (open.some((e) => e.reference === (mode === "reference"))) continue;
        sockets.current[mode]?.destroy();
        delete sockets.current[mode];
      }
    };
    const documents: LiveDocuments = {
      open(name, token, reference = false) {
        const key = sessionKey(name, reference);
        let entry = entries.current.get(key);
        if (!entry) {
          const mode = reference ? "reference" : "live";
          // Every document on the socket comes from this build, so the socket carries the schema version.
          const socket = (sockets.current[mode] ??= new HocuspocusProviderWebsocket({
            url: `${process.env.NEXT_PUBLIC_SYNC_URL!}?schema=${SCHEMA_VERSION}`,
          }));
          const ydoc = new Y.Doc();
          const provider = new HocuspocusProvider({ websocketProvider: socket, name, document: ydoc, token });
          const answered = new Promise<void>((resolve) => {
            provider.on("authenticated", resolve);
            provider.on("authenticationFailed", resolve);
            setTimeout(resolve, ANSWER_TIMEOUT_MS);
          });
          // A provider on a shared socket doesn't attach itself.
          provider.attach();
          const created: Entry = { provider, ydoc, snapshot: null, outdated: false, holders: 0, answered, reference };
          provider.on("stateless", ({ payload }: { payload: string }) => {
            const message = JSON.parse(payload) as SyncMessage;
            if (message.type === "snapshot") created.snapshot = message;
            else if (message.type === "outdated") created.outdated = true;
          });
          entry = created;
          entries.current.set(key, entry);
        }
        entry.holders++;
        return entry;
      },

      close(name, reference = false) {
        const key = sessionKey(name, reference);
        const entry = entries.current.get(key);
        if (!entry) return;
        entry.holders--;
        void entry.answered.then(() =>
          setTimeout(() => {
            if (entry.holders > 0 || entries.current.get(key) !== entry) return;
            entries.current.delete(key);
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

/**
 * Holds one live document open while mounted, and follows what apps/sync says about it: whether it's
 * read-only (which can change at any time), outdated, cut off, and (for Chapters) the latest Snapshot state.
 */
export function useLiveSession(name: string, { reference = false }: { reference?: boolean } = {}) {
  const documents = useLiveDocuments();
  const [session, setSession] = useState<LiveSession | null>(null);
  const [connection, setConnection] = useState<LiveConnection>("connecting");
  const [synced, setSynced] = useState(false);
  const [readOnly, setReadOnly] = useState(true);
  const [outdated, setOutdated] = useState(false);
  const [snapshot, setSnapshot] = useState<SnapshotMessage | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const token = async () => (await supabase.auth.getSession()).data.session?.access_token ?? "";
    const live = documents.open(name, reference ? async () => `ref:${await token()}` : token, reference);
    const { provider } = live;

    const onAuthenticated = ({ scope }: { scope: string }) => setReadOnly(scope !== "read-write");
    const onAuthenticationFailed = () => setConnection("denied");
    const onSynced = ({ state }: { state: boolean }) => {
      if (!state) return;
      setConnection("live");
      setSynced(true);
    };
    const onStatus = ({ status }: { status: string }) => {
      if (status === "disconnected") setConnection((s) => (s === "denied" ? s : "offline"));
    };
    const onStateless = ({ payload }: { payload: string }) => {
      const message = JSON.parse(payload) as SyncMessage;
      if (message.type === "access") setReadOnly(message.readOnly);
      else if (message.type === "snapshot") setSnapshot(message);
      else if (message.type === "outdated") setOutdated(true);
    };
    const onClose = ({ event }: { event: CloseEvent }) => {
      if (event.reason === ACCESS_REVOKED) setConnection("denied");
    };
    provider.on("authenticated", onAuthenticated);
    provider.on("authenticationFailed", onAuthenticationFailed);
    provider.on("synced", onSynced);
    provider.on("status", onStatus);
    provider.on("stateless", onStateless);
    provider.on("close", onClose);

    // The session is an external connection owned by this effect: the editor needs the handle, and
    // one reused from a moment ago has already been answered, so its events won't come again.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (provider.isAuthenticated) setReadOnly(provider.authorizedScope !== "read-write");
    if (provider.isSynced) onSynced({ state: true });
    setSnapshot(live.snapshot);
    setOutdated(live.outdated);
    setSession(live);
    /* eslint-enable react-hooks/set-state-in-effect */

    return () => {
      provider.off("authenticated", onAuthenticated);
      provider.off("authenticationFailed", onAuthenticationFailed);
      provider.off("synced", onSynced);
      provider.off("status", onStatus);
      provider.off("stateless", onStateless);
      provider.off("close", onClose);
      documents.close(name, reference);
    };
  }, [name, reference, documents]);

  return { session, connection, synced, readOnly, outdated, snapshot };
}
