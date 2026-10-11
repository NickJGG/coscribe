"use client";

import { useEffect, useMemo, useState } from "react";
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
  type SnapshotMessage,
  type SyncMessage,
  type DocumentKind,
} from "@coscribe/editor";
import { createClient } from "@/lib/supabase/client";
import { authorColorCss } from "@/lib/profile-rules";
import type { EntryMentionEntry } from "@/lib/entries";
import { Authorship, HEX_COLOR, type StoryAuthor } from "./Authorship";
import { DeskToolbar } from "./DeskToolbar";
import { Find, findKey, type FindConfig } from "./Find";
import { FindBar } from "./FindBar";
import { EntryMentionCards, entryMentionKey, EntryMentions, type EntryMentionConfig } from "./EntryMentions";
import { useSnapshotCompare } from "./SnapshotCompare";
import { NO_DOCUMENT, useLiveReport, type LiveConnection, type PresentWriter } from "./LiveStatus";
import { SelectionActions } from "./SelectionActions";
import { Switch } from "./Switch";
import { useLiveDocuments, type LiveSession } from "./SyncSocket";
import { canAddNote, NoteHighlights, type NoteHighlightOptions } from "./notes/NoteHighlights";
import { NoteLayer } from "./notes/NoteMargin";
import { NotesButton } from "./notes/NotesPanel";
import { useNotes } from "./notes/NotesProvider";
import styles from "./LiveDocument.module.css";

/** The signed-in Writer, shown to others as a named caret. Null for Viewers. */
export type Writer = { userId: string; name: string; color: string };

/** The Story Bible Entries whose Entry Mentions this document underlines. */
export type DocumentEntryMentions = { storyId: string; entries: EntryMentionEntry[] };

export type { StoryAuthor } from "./Authorship";

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
 * row's end, before Show authors. `entryMentions` underlines those Entries' Entry Mentions, with a card on hover.
 * Inside a NotesProvider (a member's Chapter) it also shows and adds Notes. A selection can add a Note or an Entry. A `?find=` link from Story
 * search tints its matches, with `&n=` marking the current one, and puts the find bar in the toolbar row.
 * While a Snapshot comparison is open it stays connected but hidden, and leaves the toolbar row to it.
 */
export function LiveDocument({
  kind,
  id,
  writer,
  authors,
  tools,
  entryMentions,
}: {
  kind: DocumentKind;
  id: string;
  writer: Writer | null;
  authors: StoryAuthor[];
  tools?: React.ReactNode;
  entryMentions?: DocumentEntryMentions;
}) {
  const documents = useLiveDocuments();
  const report = useLiveReport();
  const [session, setSession] = useState<LiveSession | null>(null);
  const [connection, setConnection] = useState<LiveConnection>("connecting");
  const [synced, setSynced] = useState(false);
  const [slow, setSlow] = useState(false);
  const [readOnly, setReadOnly] = useState(true);
  const [outdated, setOutdated] = useState(false);
  const [showAuthors, setShowAuthors] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const params = useSearchParams();
  const findQuery = params.get("find")?.trim() ?? "";
  const findCurrent = occurrence(params.get("n"));
  const notes = useNotes();
  const compare = useSnapshotCompare();
  const attachCompare = compare?.setEditor;
  const comparing = !!compare?.compare;
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
    if (!attachCompare) return;
    attachCompare(editor);
    return () => attachCompare(null);
  }, [attachCompare, editor]);

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
    const reportSnapshot = ({ changed, empty }: SnapshotMessage) =>
      report({ snapshotChanged: changed, snapshotEmpty: empty });
    const onStateless = ({ payload }: { payload: string }) => {
      const message = JSON.parse(payload) as SyncMessage;
      if (message.type === "access") setReadOnly(message.readOnly);
      else if (message.type === "snapshot") reportSnapshot(message);
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

    // The session is an external connection owned by this effect: the editor below needs the handle, and
    // one reused from a moment ago has already been answered, so its events won't come again.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (provider.isAuthenticated) setReadOnly(provider.authorizedScope !== "read-write");
    if (provider.isSynced) onSynced({ state: true });
    if (live.snapshot) reportSnapshot(live.snapshot);
    setOutdated(live.outdated);
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
    <div className={styles.live} hidden={comparing}>
      {!comparing && (
        <DeskToolbar.Fill>
          <div className={styles.toolRow}>
            {outdated ? (
              <Outdated />
            ) : (
              editor &&
              !readOnly && <Toolbar editor={editor} lists={kind === "entry"} onAddNote={notes?.startDraft} />
            )}
            <div className={styles.toolAside}>
              {findQuery && <FindBar kind={kind} id={id} query={findQuery} current={findCurrent} editor={editor} />}
              {tools}
              {notes && <NotesButton />}
              {notes && (
                <Switch checked={notes.show} onChange={notes.setShow}>
                  Show notes
                </Switch>
              )}
              <Switch checked={showAuthors} onChange={setShowAuthors}>
                Show authors
              </Switch>
            </div>
          </div>
        </DeskToolbar.Fill>
      )}
      {session && synced ? (
        <MaybeEntryMentionCards entryMentions={entryMentions}>
          <Authorship
            authors={authors}
            show={showAuthors}
            aside={
              editor && (
                <>
                  {notes && <NoteLayer editor={editor} />}
                  <SelectionActions editor={editor} entryMentions={entryMentions} onAddNote={notes?.startDraft} />
                </>
              )
            }
          >
            <LiveEditor
              kind={kind}
              session={session}
              writer={writer}
              editable={!readOnly}
              entryMentions={entryMentions?.entries}
              notes={noteOptions}
              find={{ query: findQuery, current: findCurrent }}
              onEditor={setEditor}
            />
          </Authorship>
        </MaybeEntryMentionCards>
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

function MaybeEntryMentionCards({ entryMentions, children }: { entryMentions?: DocumentEntryMentions; children: React.ReactNode }) {
  if (!entryMentions) return children;
  return (
    <EntryMentionCards storyId={entryMentions.storyId} entries={entryMentions.entries}>
      {children}
    </EntryMentionCards>
  );
}

const NO_ENTRY_MENTIONS: EntryMentionEntry[] = [];

function LiveEditor({
  kind,
  session,
  writer,
  editable,
  entryMentions = NO_ENTRY_MENTIONS,
  notes,
  find,
  onEditor,
}: {
  kind: DocumentKind;
  session: LiveSession;
  writer: Writer | null;
  editable: boolean;
  entryMentions?: EntryMentionEntry[];
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
      EntryMentions.configure({ entries: entryMentions, focusable: !editable }),
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
    const current = entryMentionKey.getState(editor.state);
    if (current?.entries === entryMentions && current.focusable === !editable) return;
    const config: EntryMentionConfig = { entries: entryMentions, focusable: !editable };
    editor.view.dispatch(editor.state.tr.setMeta(entryMentionKey, config));
  }, [editor, entryMentions, editable]);

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

/** apps/sync runs a newer schema than this tab, which stays read-only until it reloads. */
function Outdated() {
  return (
    <p className={styles.outdated} role="status">
      Coscribe has been updated. Reload to keep writing.
      <button type="button" className="button button-primary button-tiny" onClick={() => location.reload()}>
        Reload
      </button>
    </p>
  );
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
        data-tip="Bold"
        data-keys="Ctrl+B"
        aria-label="Bold"
      >
        <strong>B</strong>
      </button>
      <button
        type="button"
        className={styles.tool}
        aria-pressed={active.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        data-tip="Italic"
        data-keys="Ctrl+I"
        aria-label="Italic"
      >
        <em>I</em>
      </button>
      <span className={styles.toolSep} aria-hidden />
      <button
        type="button"
        className={styles.tool}
        onClick={() => editor.chain().focus().insertSceneBreak().run()}
        data-tip="Scene Break"
        data-keys="Type *** on an empty line"
        aria-label="Scene Break"
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
            data-tip="Bulleted list"
            data-keys="Type - and a space"
          >
            &bull; List
          </button>
          <button
            type="button"
            className={styles.tool}
            aria-pressed={active.orderedList}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            data-tip="Numbered list"
            data-keys="Type 1. and a space"
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
            data-tip="Add Note on the selected text"
            data-keys="Ctrl+Alt+M"
          >
            Add Note
          </button>
        </>
      )}
    </div>
  );
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
