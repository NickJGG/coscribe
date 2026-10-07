"use client";

import { useEffect, useMemo, useState } from "react";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { Placeholder } from "@tiptap/extensions";
import * as Y from "yjs";
import {
  ACCESS_REVOKED,
  AuthorStamp,
  chapterExtensions,
  documentName,
  DOCUMENT_FIELD,
  entryExtensions,
  type AccessMessage,
  type DocumentKind,
} from "@coscribe/editor";
import { createClient } from "@/lib/supabase/client";
import { relativeTime } from "@/lib/relative-time";
import styles from "./LiveDocument.module.css";

/** The signed-in Writer, shown to others as a named caret. Null for Viewers. */
export type Writer = { userId: string; name: string; color: string };

/** A Story member whose text can carry an `author` mark. */
export type StoryAuthor = { id: string; name: string; color: string };

type Status = "connecting" | "live" | "offline" | "denied";
type Session = { provider: HocuspocusProvider; ydoc: Y.Doc };

const KINDS = {
  chapter: { extensions: chapterExtensions, noun: "Chapter", label: "Chapter text", placeholder: "Start writing…" },
  entry: {
    extensions: entryExtensions,
    noun: "Entry",
    label: "Entry body",
    placeholder: "Everything the Writers should keep straight…",
  },
} satisfies Record<DocumentKind, unknown>;

const STATUS_TEXT: Record<Exclude<Status, "denied">, string> = {
  connecting: "Connecting…",
  live: "Live",
  offline: "Reconnecting…",
};

/**
 * A live Chapter or Entry body. Edit rights come from apps/sync, not props: it can switch this editor
 * between read-only and editable at any time (lock, unlock, Finished) or cut it off (removed, made Private).
 */
export function LiveDocument({
  kind,
  id,
  writer,
  authors,
}: {
  kind: DocumentKind;
  id: string;
  writer: Writer | null;
  authors: StoryAuthor[];
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<Status>("connecting");
  const [readOnly, setReadOnly] = useState(true);
  const [showAuthors, setShowAuthors] = useState(false);

  useEffect(() => {
    const ydoc = new Y.Doc();
    const supabase = createClient();
    const provider: HocuspocusProvider = new HocuspocusProvider({
      url: process.env.NEXT_PUBLIC_SYNC_URL!,
      name: documentName(kind, id),
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
  }, [kind, id]);

  return (
    <div className={styles.live}>
      <div className={styles.bar}>
        <span className={styles.status} data-status={status} role="status">
          {status === "denied" ? `You can no longer open this ${KINDS[kind].noun}.` : STATUS_TEXT[status]}
          {status === "live" && readOnly && writer && <span className="muted"> · Read-only</span>}
        </span>
        {session && status !== "denied" && (
          <div className={styles.barEnd}>
            <Online provider={session.provider} noun={KINDS[kind].noun} />
            <label className={styles.toggle}>
              <input type="checkbox" checked={showAuthors} onChange={(e) => setShowAuthors(e.target.checked)} />
              Show authors
            </label>
          </div>
        )}
      </div>
      {session && status !== "denied" && (
        <Authorship authors={authors} show={showAuthors}>
          <LiveEditor
            kind={kind}
            session={session}
            writer={writer}
            editable={!readOnly && status !== "connecting"}
          />
        </Authorship>
      )}
    </div>
  );
}

function LiveEditor({
  kind,
  session,
  writer,
  editable,
}: {
  kind: DocumentKind;
  session: Session;
  writer: Writer | null;
  editable: boolean;
}) {
  const { extensions, label, placeholder } = KINDS[kind];
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: [
      ...extensions,
      Collaboration.configure({ document: session.ydoc, field: DOCUMENT_FIELD }),
      CollaborationCaret.configure({
        provider: session.provider,
        user: writer ?? { viewer: true },
      }),
      Placeholder.configure({ placeholder }),
      AuthorStamp.configure({ userId: writer?.userId ?? null }),
    ],
    editorProps: { attributes: { class: styles.prose, "aria-label": label } },
  });

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  return (
    <>
      {editor && editable && <Toolbar editor={editor} lists={kind === "entry"} />}
      <EditorContent editor={editor} />
    </>
  );
}

function Toolbar({ editor, lists }: { editor: Editor; lists: boolean }) {
  const active = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      bulletList: editor.isActive("bulletList"),
      orderedList: editor.isActive("orderedList"),
    }),
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
      {lists && (
        <>
          <button
            type="button"
            className={styles.tool}
            aria-pressed={active.bulletList}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Bulleted list (type - and a space)"
          >
            &bull; List
          </button>
          <button
            type="button"
            className={styles.tool}
            aria-pressed={active.orderedList}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Numbered list (type 1. and a space)"
          >
            1. List
          </button>
        </>
      )}
    </div>
  );
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

type Tip = { text: string; x: number; y: number };

/** "Show authors": tints each `author` run by its Author Color, and hovering one says who wrote it and when. */
export function Authorship({ authors, show, children }: { authors: StoryAuthor[]; show: boolean; children: React.ReactNode }) {
  const [tip, setTip] = useState<Tip | null>(null);
  const byId = useMemo(() => new Map(authors.map((a) => [a.id, a])), [authors]);
  const tints = useMemo(
    () =>
      authors
        .filter((a) => HEX_COLOR.test(a.color))
        .map((a) => `span[data-author="${a.id}"]{--author-tint:${a.color}}`)
        .join(""),
    [authors]
  );

  function onMouseOver(event: React.MouseEvent<HTMLDivElement>) {
    const span = (event.target as Element).closest<HTMLElement>("span[data-author]");
    if (!span) return setTip(null);
    const name = byId.get(span.dataset.author!)?.name ?? "A former Writer";
    const at = Number(span.dataset.at);
    const box = event.currentTarget.getBoundingClientRect();
    // A run can wrap across lines; anchor to the line under the pointer.
    const line =
      [...span.getClientRects()].find((r) => event.clientY >= r.top && event.clientY <= r.bottom) ??
      span.getBoundingClientRect();
    setTip({
      text: at ? `${name}, ${relativeTime(at)}` : name,
      x: event.clientX - box.left,
      y: line.top - box.top,
    });
  }

  return (
    <div
      className={styles.authorship}
      data-show-authors={show || undefined}
      onMouseOver={show ? onMouseOver : undefined}
      onMouseLeave={() => setTip(null)}
    >
      {show && <style>{tints}</style>}
      {children}
      {show && tip && (
        <div className={styles.authorTip} role="tooltip" style={{ left: tip.x, top: tip.y }}>
          {tip.text}
        </div>
      )}
    </div>
  );
}

type Present = { key: string; name: string; color: string };

/** Writers in this document right now (one entry per person, however many tabs), plus a Viewer count. */
function Online({ provider, noun }: { provider: HocuspocusProvider; noun: string }) {
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
    <ul className={styles.online} aria-label={`In this ${noun}`}>
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
