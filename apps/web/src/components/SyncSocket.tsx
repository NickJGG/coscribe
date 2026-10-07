"use client";

import { createContext, useCallback, useContext, useEffect, useRef } from "react";
import { HocuspocusProviderWebsocket } from "@hocuspocus/provider";

const SyncSocketContext = createContext<(() => HocuspocusProviderWebsocket) | null>(null);

/**
 * One websocket to apps/sync for every live document beneath it, so switching Chapters only syncs the new
 * text. Each document still authenticates on its own (apps/sync's onAuthenticate runs per document).
 */
export function SyncSocketProvider({ children }: { children: React.ReactNode }) {
  const socket = useRef<HocuspocusProviderWebsocket | null>(null);
  const acquire = useCallback(
    () => (socket.current ??= new HocuspocusProviderWebsocket({ url: process.env.NEXT_PUBLIC_SYNC_URL! })),
    []
  );

  useEffect(
    () => () => {
      const closing = socket.current;
      socket.current = null;
      // Parent cleanups run before children's: let the documents flush and detach first.
      setTimeout(() => closing?.destroy());
    },
    []
  );

  return <SyncSocketContext value={acquire}>{children}</SyncSocketContext>;
}

/** The shared socket's getter, or null outside a SyncSocketProvider. Call it from effects only. */
export function useSyncSocket() {
  return useContext(SyncSocketContext);
}
