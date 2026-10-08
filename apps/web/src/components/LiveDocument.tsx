"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import { useSearchParams } from "next/navigation";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { Placeholder } from "@tiptap/extensions";
import {
  ACCESS_REVOKED,
  AuthorStamp,
  chapterExtensions,
  countWords,
  documentName,
  DOCUMENT_FIELD,
  entryExtensions,
  type AccessMessage,
  type DocumentKind,
} from "@coscribe/editor";
import { createClient } from "@/lib/supabase/client";
import { relativeTime } from "@/lib/relative-time";
import { authorColorCss } from "@/lib/profile-rules";
import { paragraphShares, type AuthorRun } from "@/lib/contribution";
import { useMeasure } from "@/lib/use-measure";
import type { MentionEntry } from "@/lib/entries";
import { DeskToolbar } from "./DeskToolbar";
import { Find, findKey, type FindConfig } from "./Find";
import { FindBar } from "./FindBar";
import { MentionCards, mentionKey, Mentions, type MentionConfig } from "./Mentions";
import { NO_DOCUMENT, useLiveReport, type LiveConnection, type PresentWriter } from "./LiveStatus";
import { Switch } from "./Switch";
import { useLiveDocuments, type LiveSession } from "./SyncSocket";
import { canAddNote, NoteHighlights, type NoteHighlightOptions } from "./notes/NoteHighlights";
import { NoteLayer } from "./notes/NoteMargin";
import { NotesButton } from "./notes/NotesPanel";
import { useNotes } from "./notes/NotesProvider";
import styles from "./LiveDocument.module.css";

/** The signed-in Writer, shown to others as a named caret. Null for Viewers. */
export type Writer = { userId: string; name: string; color: string };

/** The Story Bible Entries whose Mentions this document underlines. */
export type DocumentMentions = { storyId: string; entries: MentionEntry[] };

/** A Story member whose text can carry an `author` mark. */
export type StoryAuthor = { id: string; name: string; color: string };

const KINDS = {
  chapter: { extensions: chapterExtensions, noun: "Chapter", label: "Chapter text", placeholder: "Start writing…" },
  entry: {
    extensions: entryExtensions,
    noun: "Entry",
    label: "Entry body",
    placeholder: "Everything the Writers should keep straight…",
  },
} satisfies Record<DocumentKind, unknown>;

const SLOW_MS = 1000;

/**
 * A live Chapter or Entry body. Edit rights come from apps/sync, not props: it can switch this editor
 * between read-only and editable at any time (lock, unlock, Finished) or cut it off (removed, made Private).
 * It opens through the desk's SyncSocketProvider; its connection, Writers present and word
 * count go to the desk through LiveStatus, and its toolbar row fills the desk's. `tools` sit at the
 * row's end, before Show authors. `mentions` underlines those Entries' Mentions, with a card on hover.
 * Inside a NotesProvider (a member's Chapter) it also shows and adds Notes. A `?find=` link from Story
 * search tints its matches, with `&n=` marking the current one, and puts the find bar in the toolbar row.
 */
export function LiveDocument({
  kind,
  id,
  writer,
  authors,
  tools,
  mentions,
}: {
  kind: DocumentKind;
  id: string;
  writer: Writer | null;
  authors: StoryAuthor[];
  tools?: React.ReactNode;
  mentions?: DocumentMentions;
}) {
  const documents = useLiveDocuments();
  const report = useLiveReport();
  const [session, setSession] = useState<LiveSession | null>(null);
  const [connection, setConnection] = useState<LiveConnection>("connecting");
  const [synced, setSynced] = useState(false);
  const [slow, setSlow] = useState(false);
  const [readOnly, setReadOnly] = useState(true);
  const [showAuthors, setShowAuthors] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const params = useSearchParams();
  const findQuery = params.get("find")?.trim() ?? "";
  const findCurrent = occurrence(params.get("n"));
  const notes = useNotes();
  const attachNotes = notes?.setEditor;
  const onActivateNote = notes?.setActive;
  const onAddNote = notes?.startDraft;
  // The editor is built once with these, so they must never change (and don't).
  const noteOptions = useMemo<NoteHighlightOptions | undefined>(
    () => (onActivateNote && onAddNote ? { onActivate: onActivateNote, onAddNote } : undefined),
    [onActivateNote, onAddNote]
  );

  useEffect(() => {
    if (!attachNotes) return;
    attachNotes(editor);
    return () => attachNotes(null);
  }, [attachNotes, editor]);

  useEffect(() => {
    const name = documentName(kind, id);
    report({ ...NO_DOCUMENT, doc: name });
    const supabase = createClient();
    const live = documents.open(name, async () => (await supabase.auth.getSession()).data.session?.access_token ?? "");
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
      const message = JSON.parse(payload) as AccessMessage;
      if (message.type === "access") setReadOnly(message.readOnly);
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

    // The session is an external connection owned by this effect: the editor below needs the handle, and
    // one reused from a moment ago has already been answered, so its events won't come again.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (provider.isAuthenticated) setReadOnly(provider.authorizedScope !== "read-write");
    if (provider.isSynced) onSynced({ state: true });
    setSession(live);
    /* eslint-enable react-hooks/set-state-in-effect */
    const slowTimer = setTimeout(() => setSlow(true), SLOW_MS);

    return () => {
      clearTimeout(slowTimer);
      provider.off("authenticated", onAuthenticated);
      provider.off("authenticationFailed", onAuthenticationFailed);
      provider.off("synced", onSynced);
      provider.off("status", onStatus);
      provider.off("stateless", onStateless);
      provider.off("close", onClose);
      documents.close(name);
      report(NO_DOCUMENT);
    };
  }, [kind, id, documents, report]);

  useEffect(() => {
    report({ connection, slow, readOnly });
  }, [report, connection, slow, readOnly]);

  usePresence(session?.provider ?? null);

  if (connection === "denied") {
    return (
      <p className={styles.denied} role="status">
        You can no longer open this {KINDS[kind].noun}.
      </p>
    );
  }

  return (
    <div className={styles.live}>
      <DeskToolbar.Fill>
        <div className={styles.toolRow}>
          {editor && !readOnly && (
            <Toolbar editor={editor} lists={kind === "entry"} onAddNote={notes?.startDraft} />
          )}
          <div className={styles.toolAside}>
            {findQuery && <FindBar kind={kind} id={id} query={findQuery} current={findCurrent} editor={editor} />}
            {tools}
            {notes && <NotesButton />}
            {notes && (
              <Switch checked={notes.show} onChange={notes.setShow}>
                Show Notes
              </Switch>
            )}
            <Switch checked={showAuthors} onChange={setShowAuthors}>
              Show authors
            </Switch>
          </div>
        </div>
      </DeskToolbar.Fill>
      {session && synced ? (
        <MaybeMentionCards mentions={mentions}>
          <Authorship
            authors={authors}
            show={showAuthors}
            aside={notes && editor && <NoteLayer editor={editor} />}
          >
            <LiveEditor
              kind={kind}
              session={session}
              writer={writer}
              editable={!readOnly}
              mentions={mentions?.entries}
              notes={noteOptions}
              find={{ query: findQuery, current: findCurrent }}
              onEditor={setEditor}
            />
          </Authorship>
        </MaybeMentionCards>
      ) : (
        <div className={styles.loading} aria-label={`Loading the ${KINDS[kind].noun}`} role="status">
          {LOADING_LINES.map((width, i) => (
            <span key={i} style={{ width }} />
          ))}
        </div>
      )}
    </div>
  );
}

function occurrence(param: string | null): number | null {
  const n = Number(param);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const LOADING_LINES = ["100%", "96%", "100%", "88%", "100%", "93%", "62%"];

function MaybeMentionCards({ mentions, children }: { mentions?: DocumentMentions; children: React.ReactNode }) {
  if (!mentions) return children;
  return (
    <MentionCards storyId={mentions.storyId} entries={mentions.entries}>
      {children}
    </MentionCards>
  );
}

const NO_MENTIONS: MentionEntry[] = [];

function LiveEditor({
  kind,
  session,
  writer,
  editable,
  mentions = NO_MENTIONS,
  notes,
  find,
  onEditor,
}: {
  kind: DocumentKind;
  session: LiveSession;
  writer: Writer | null;
  editable: boolean;
  mentions?: MentionEntry[];
  notes?: NoteHighlightOptions;
  find: FindConfig;
  onEditor: (editor: Editor | null) => void;
}) {
  const report = useLiveReport();
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
        render: renderCaret,
      }),
      Placeholder.configure({ placeholder }),
      AuthorStamp.configure({ userId: writer?.userId ?? null }),
      Mentions.configure({ entries: mentions, focusable: !editable }),
      ...(notes ? [NoteHighlights.configure(notes)] : []),
      Find.configure(find),
    ],
    editorProps: { attributes: { class: styles.prose, "aria-label": label } },
  });

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const current = mentionKey.getState(editor.state);
    if (current?.entries === mentions && current.focusable === !editable) return;
    const config: MentionConfig = { entries: mentions, focusable: !editable };
    editor.view.dispatch(editor.state.tr.setMeta(mentionKey, config));
  }, [editor, mentions, editable]);

  const { query, current } = find;
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const state = findKey.getState(editor.state);
    if (state?.query === query && state.current === current) return;
    const config: FindConfig = { query, current };
    editor.view.dispatch(editor.state.tr.setMeta(findKey, config));
  }, [editor, query, current]);

  useEffect(() => {
    onEditor(editor);
    return () => onEditor(null);
  }, [editor, onEditor]);

  useEffect(() => {
    if (!editor) return;
    const count = () => report({ words: countWords(editor.state.doc) });
    count();
    report({ ready: true });
    editor.on("update", count);
    return () => {
      editor.off("update", count);
    };
  }, [editor, report]);

  return <EditorContent editor={editor} />;
}

/** Like CollaborationCaret's default, but colored through CSS so the label follows the theme. */
function renderCaret(user: Record<string, unknown>): HTMLElement {
  const caret = document.createElement("span");
  caret.classList.add("collaboration-carets__caret");
  if (typeof user.color === "string" && HEX_COLOR.test(user.color)) {
    caret.style.setProperty("--author", authorColorCss(user.color));
  }
  if (typeof user.name === "string") {
    const label = document.createElement("div");
    label.classList.add("collaboration-carets__label");
    label.textContent = user.name;
    caret.append(label);
  }
  return caret;
}

function Toolbar({ editor, lists, onAddNote }: { editor: Editor; lists: boolean; onAddNote?: () => void }) {
  const active = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      bulletList: editor.isActive("bulletList"),
      orderedList: editor.isActive("orderedList"),
      note: canAddNote(editor),
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
      <span className={styles.toolSep} aria-hidden />
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
          <span className={styles.toolSep} aria-hidden />
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
      {onAddNote && (
        <>
          <span className={styles.toolSep} aria-hidden />
          <button
            type="button"
            className={styles.tool}
            disabled={!active.note}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onAddNote}
            title="Add Note on the selected text (Ctrl+Alt+M)"
          >
            Add Note
          </button>
        </>
      )}
    </div>
  );
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

type Tip = { text: string; x: number; y: number };

/** A paragraph's split margin bar, placed against the Authorship box. */
type Bar = { top: number; height: number; shares: AuthorRun[] };

const NO_BARS: Bar[] = [];

/**
 * "Show authors": tints each `author` run by its Author Color, puts a bar in the margin of each paragraph
 * split by each Writer's share of its characters, and hovering a run says who wrote it and when.
 */
export function Authorship({
  authors,
  show,
  aside,
  children,
}: {
  authors: StoryAuthor[];
  show: boolean;
  /** Laid over the box beside the text, unclipped, like the bars. */
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [tip, setTip] = useState<Tip | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const clip = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLDivElement>(null);
  const roots = useMemo(() => [text], []);
  const measure = useCallback(() => measureBars(box.current!, text.current!), []);
  const bars = useMeasure(roots, show ? measure : null, NO_BARS);
  const byId = useMemo(() => new Map(authors.map((a) => [a.id, a])), [authors]);
  const tints = useMemo(
    () =>
      authors
        .filter((a) => HEX_COLOR.test(a.color))
        .map((a) => `span[data-author="${a.id}"]{--author-tint:${authorColorCss(a.color)}}`)
        .join(""),
    [authors]
  );

  function onMouseOver(event: React.MouseEvent<HTMLDivElement>) {
    const span = (event.target as Element).closest<HTMLElement>("span[data-author]");
    if (!span || !clip.current) return setTip(null);
    const name = byId.get(span.dataset.author!)?.name ?? "A former Writer";
    const at = Number(span.dataset.at);
    const origin = clip.current.getBoundingClientRect();
    // A run can wrap across lines; anchor to the line under the pointer.
    const line =
      [...span.getClientRects()].find((r) => event.clientY >= r.top && event.clientY <= r.bottom) ??
      span.getBoundingClientRect();
    setTip({
      text: at ? `${name}, ${relativeTime(at)}` : name,
      x: event.clientX - origin.left,
      y: line.top - origin.top,
    });
  }

  function barColor(author: string) {
    const color = byId.get(author)?.color;
    return color && HEX_COLOR.test(color) ? authorColorCss(color) : undefined;
  }

  return (
    <div
      ref={box}
      className={styles.authorship}
      data-show-authors={show || undefined}
      onMouseOver={show ? onMouseOver : undefined}
      onMouseLeave={() => setTip(null)}
    >
      {show && <style>{tints}</style>}
      {show && (
        <div className={styles.margin} aria-hidden>
          {bars.map((bar, i) => (
            <span key={i} className={styles.bar} style={{ top: bar.top, height: bar.height }}>
              {bar.shares.map((s) => (
                <span key={s.author} style={{ flexGrow: s.chars, "--c": barColor(s.author) } as React.CSSProperties} />
              ))}
            </span>
          ))}
        </div>
      )}
      {aside}
      {/* Caret labels and the tooltip can stick out past a phone's edge; the margin bars must not be cut off. */}
      <div ref={clip} className={styles.clip}>
        <div ref={text}>{children}</div>
        {show && tip && (
          <div className={styles.authorTip} role="tooltip" style={{ left: tip.x, top: tip.y }}>
            {tip.text}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Each paragraph's margin bar, measured from its rendered `span[data-author]` runs. Works the same over a
 * live editor and over static Reader markup.
 */
function measureBars(origin: HTMLElement, root: HTMLElement): Bar[] {
  const paragraphs = [...root.querySelectorAll("p")];
  if (!paragraphs.length) return [];
  const top = origin.getBoundingClientRect().top;
  // Trim each bar to the text rather than the full line boxes, as in the design.
  const inset = parseFloat(getComputedStyle(paragraphs[0]!).fontSize) * 0.45;

  return paragraphs.flatMap((p) => {
    const shares = paragraphShares(
      [...p.querySelectorAll<HTMLElement>("span[data-author]")].map((span) => ({
        author: span.dataset.author!,
        chars: authoredLength(span),
      }))
    );
    if (!shares.length) return [];
    const rect = p.getBoundingClientRect();
    return [
      {
        top: Math.round(rect.top - top + inset),
        height: Math.max(3, Math.round(rect.height - 2 * inset)),
        shares,
      },
    ];
  });
}

/** A run's own characters, leaving out the name label of any remote caret drawn inside it. */
function authoredLength(span: HTMLElement): number {
  let length = span.textContent.length;
  for (const label of span.querySelectorAll(".collaboration-carets__label")) length -= label.textContent.length;
  return length;
}

/** Reports who is in this document: Writers by name, Viewers only as a count. */
function usePresence(provider: HocuspocusProvider | null) {
  const report = useLiveReport();

  useEffect(() => {
    const awareness = provider?.awareness;
    if (!awareness) return;
    const update = () => {
      const writers = new Map<string, PresentWriter>();
      let viewers = 0;
      for (const state of awareness.getStates().values()) {
        const user = state.user as (Partial<Writer> & { viewer?: boolean }) | undefined;
        if (user?.userId && user.name && user.color) {
          writers.set(user.userId, { id: user.userId, name: user.name, color: user.color });
        } else if (user?.viewer) {
          viewers++;
        }
      }
      report({ writers: [...writers.values()], viewers });
    };
    update();
    awareness.on("change", update);
    return () => awareness.off("change", update);
  }, [provider, report]);
}
