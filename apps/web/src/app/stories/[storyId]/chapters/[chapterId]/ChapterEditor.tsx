"use client";

import { useEffect, useState } from "react";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { Placeholder } from "@tiptap/extensions";
import * as Y from "yjs";
import { ACCESS_REVOKED, chapterDocumentName, chapterExtensions, type AccessMessage } from "@coscribe/editor";
import { createClient } from "@/lib/supabase/client";
import styles from "./chapter.module.css";

/** The signed-in Writer, shown to others as a named caret. Null for Viewers. */
export type Writer = { userId: string; name: string; color: string };

type Status = "connecting" | "live" | "offline" | "denied";
type Session = { provider: HocuspocusProvider; ydoc: Y.Doc };

const STATUS_TEXT: Record<Status, string> = {
  connecting: "Connecting…",
  live: "Live",
  offline: "Reconnecting…",
  denied: "You can no longer open this Chapter.",
};

/**
 * The live Chapter document. Edit rights come from apps/sync, not props: it can switch this editor
 * between read-only and editable at any time (lock, unlock) or cut it off (removed, made Private).
 */
export function ChapterEditor({ chapterId, writer }: { chapterId: string; writer: Writer | null }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<Status>("connecting");
  const [readOnly, setReadOnly] = useState(true);

  useEffect(() => {
    const ydoc = new Y.Doc();
    const supabase = createClient();
    const provider: HocuspocusProvider = new HocuspocusProvider({
      url: process.env.NEXT_PUBLIC_SYNC_URL!,
      name: chapterDocumentName(chapterId),
      document: ydoc,
      token: async () => (await supabase.auth.getSession()).data.session?.access_token ?? "",
      onAuthenticated: ({ scope }) => setReadOnly(scope !== "read-write"),
      onAuthenticationFailed: () => setStatus("denied"),
      onSynced: ({ state }) => {
        if (state) setStatus("live");
      },
      onStatus: ({ status }) => {
        if (status === "disconnected") setStatus((s) => (s === "denied" ? s : "offline"));
      },
      onStateless: ({ payload }) => {
        const message = JSON.parse(payload) as AccessMessage;
        if (message.type === "access") setReadOnly(message.readOnly);
      },
      onClose: ({ event }) => {
        if (event.reason !== ACCESS_REVOKED) return;
        setStatus("denied");
        provider.destroy();
      },
    });
    // The provider is an external connection owned by this effect; the editor below needs the handle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession({ provider, ydoc });

    return () => {
      provider.destroy();
      ydoc.destroy();
    };
  }, [chapterId]);

  return (
    <div className={styles.live}>
      <div className={styles.bar}>
        <span className={styles.status} data-status={status} role="status">
          {STATUS_TEXT[status]}
          {status === "live" && readOnly && writer && <span className="muted"> · Read-only</span>}
        </span>
        {session && status !== "denied" && <Online provider={session.provider} />}
      </div>
      {session && status !== "denied" && (
        <LiveEditor session={session} writer={writer} editable={!readOnly && status !== "connecting"} />
      )}
    </div>
  );
}

function LiveEditor({ session, writer, editable }: { session: Session; writer: Writer | null; editable: boolean }) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: [
      ...chapterExtensions,
      Collaboration.configure({ document: session.ydoc }),
      CollaborationCaret.configure({
        provider: session.provider,
        user: writer ?? { viewer: true },
      }),
      Placeholder.configure({ placeholder: "Start writing…" }),
    ],
    editorProps: { attributes: { class: styles.prose, "aria-label": "Chapter text" } },
  });

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  return (
    <>
      {editor && editable && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const active = useEditorState({
    editor,
    selector: ({ editor }) => ({ bold: editor.isActive("bold"), italic: editor.isActive("italic") }),
  });

  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Formatting">
      <button
        type="button"
        className={styles.tool}
        aria-pressed={active.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold (Ctrl+B)"
      >
        <strong>B</strong>
      </button>
      <button
        type="button"
        className={styles.tool}
        aria-pressed={active.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic (Ctrl+I)"
      >
        <em>I</em>
      </button>
      <button
        type="button"
        className={styles.tool}
        onClick={() => editor.chain().focus().insertSceneBreak().run()}
        title="Scene Break (type *** on an empty line)"
      >
        * * *
      </button>
    </div>
  );
}

type Present = { key: string; name: string; color: string };

/** Writers in this Chapter right now (one entry per person, however many tabs), plus a Viewer count. */
function Online({ provider }: { provider: HocuspocusProvider }) {
  const [present, setPresent] = useState<{ writers: Present[]; viewers: number }>({ writers: [], viewers: 0 });

  useEffect(() => {
    const awareness = provider.awareness;
    if (!awareness) return;
    const update = () => {
      const writers = new Map<string, Present>();
      let viewers = 0;
      for (const state of awareness.getStates().values()) {
        const user = state.user as Partial<Writer> & { viewer?: boolean } | undefined;
        if (user?.userId && user.name && user.color) {
          writers.set(user.userId, { key: user.userId, name: user.name, color: user.color });
        } else if (user?.viewer) {
          viewers++;
        }
      }
      setPresent({ writers: [...writers.values()], viewers });
    };
    awareness.on("change", update);
    return () => awareness.off("change", update);
  }, [provider]);

  return (
    <ul className={styles.online} aria-label="In this Chapter">
      {present.writers.map((w) => (
        <li key={w.key} className={styles.person} style={{ "--author": w.color } as React.CSSProperties}>
          {w.name}
        </li>
      ))}
      {present.viewers > 0 && (
        <li className="muted">
          {present.viewers} {present.viewers === 1 ? "Viewer" : "Viewers"}
        </li>
      )}
    </ul>
  );
}
