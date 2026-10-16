"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Extension } from "@tiptap/core";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { Dropcursor, Gapcursor, Placeholder } from "@tiptap/extensions";
import {
  AuthorStamp,
  chapterExtensions,
  countWords,
  documentName,
  DOCUMENT_FIELD,
  entryExtensions,
  SmartPunctuation,
} from "@coscribe/editor";
import { authorColorCss } from "@/lib/profile-rules";
import type { EntryMentionEntry } from "@/lib/entries";
import { DEFAULT_TOOLBAR_LAYOUT, type ToolbarLayout } from "@/lib/toolbar-layout";
import { Authorship, HEX_COLOR, type StoryAuthor } from "./Authorship";
import { CueSuggestionList, CueSuggestions } from "./CueSuggestions";
import { useArrival } from "./DeskArrival";
import { DeskToolbar } from "./DeskToolbar";
import { FormattingToolbar } from "./FormattingToolbar";
import { Find, findKey, type FindConfig } from "./Find";
import { Narration } from "./Narration";
import { DeskListen, useDeskNarration, type NarratedChapter } from "./narration/DeskListen";
import { FindBar } from "./FindBar";
import { EntryMentionCards, entryMentionKey, EntryMentions, type EntryMentionConfig } from "./EntryMentions";
import { useSnapshotCompare } from "./SnapshotCompare";
import { NO_DOCUMENT, useLiveReport, type PresentWriter } from "./LiveStatus";
import { PinnedButton, usePinsSwitch } from "./PinnedEntries";
import { SelectionActions } from "./SelectionActions";
import { useSmartPunctuation } from "./SmartPunctuation";
import { useLiveSession, type LiveSession } from "./SyncSocket";
import { ViewOptions } from "./ViewOptions";
import { NoteHighlights, type NoteHighlightOptions } from "./notes/NoteHighlights";
import { NoteLayer } from "./notes/NoteMargin";
import { NotesButton } from "./notes/NotesPanel";
import { useNotes } from "./notes/NotesProvider";
import scriptStyles from "./Script.module.css";
import styles from "./LiveDocument.module.css";

/** The signed-in Writer, shown to others as a named caret. Null for Viewers. */
export type Writer = { userId: string; name: string; color: string };

/** The Story Bible Entries whose Entry Mentions this document underlines. */
export type DocumentEntryMentions = { storyId: string; entries: EntryMentionEntry[] };

export type { StoryAuthor } from "./Authorship";

type LiveKind = "chapter" | "entry";

const KINDS = {
  chapter: { extensions: chapterExtensions, noun: "Chapter", label: "Chapter text", placeholder: "Start writing…" },
  entry: {
    extensions: entryExtensions,
    noun: "Entry",
    label: "Entry body",
    placeholder: "Everything the Writers should keep straight…",
  },
} satisfies Record<LiveKind, unknown>;

const SLOW_MS = 1000;

/** Keeps the caret this far from the page's edges as it moves, in px; the bottom is above Back to top. */
const CARET_CLEARANCE = { top: 5, right: 5, bottom: 72, left: 5 };

/** Tab types a tab instead of leaving the editor. Below the default priority so Tab still indents list items. */
const TabKey = Extension.create({
  name: "tabKey",
  priority: 50,
  addKeyboardShortcuts() {
    return {
      // Read-only, Tab must still move between focusable Entry Mentions.
      Tab: ({ editor }) => editor.isEditable && editor.commands.command(({ tr }) => !!tr.insertText("	")),
    };
  },
});

/**
 * A live Chapter or Entry body. Edit rights come from apps/sync, not props: it can switch this editor
 * between read-only and editable at any time (lock, unlock, Finished) or cut it off (removed, made Private,
 * moved to the Trash).
 * It opens through the desk's SyncSocketProvider; its connection, Writers present and word
 * count go to the desk through LiveStatus, and its toolbar row fills the desk's. `tools` sit at the
 * row's end, then `outline` (shown even when read-only), before the View options menu; `toolbarLayout` is the signed-in account's Formatting toolbar order. `entryMentions` underlines those Entries' Entry Mentions, with a card on hover.
 * Inside a NotesProvider (a member's Chapter) it also shows and adds Notes. A selection can add a Note or an Entry. A `?find=` link from Story
 * search tints its matches, with `&n=` marking the current one, and puts the find bar in the toolbar row.
 * While a Snapshot comparison is open it stays connected but hidden, and leaves the toolbar row to it.
 * `narration` makes a Chapter listenable: while Listening it's read-only for everyone, and the toolbar row says how
 * to get back to editing.
 *
 * `embedded` is a Pinned Entry's body beside a Chapter: a reference connection with no toolbar, Notes, find
 * or Snapshots, which tells the desk nothing and doesn't count as being in the document.
 */
export function LiveDocument({
  kind,
  id,
  writer,
  authors,
  tools,
  outline,
  toolbarLayout = DEFAULT_TOOLBAR_LAYOUT,
  entryMentions,
  narration = null,
  embedded = false,
}: {
  kind: LiveKind;
  id: string;
  writer: Writer | null;
  authors: StoryAuthor[];
  tools?: React.ReactNode;
  outline?: React.ReactNode;
  toolbarLayout?: ToolbarLayout;
  entryMentions?: DocumentEntryMentions;
  narration?: NarratedChapter;
  embedded?: boolean;
}) {
  const name = documentName(kind, id);
  const { session, connection, synced, readOnly, outdated, snapshot } = useLiveSession(name, { reference: embedded });
  const report = useReport(embedded);
  const [slow, setSlow] = useState(false);
  const [showAuthors, setShowAuthors] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const asideRef = useRef<HTMLDivElement>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const params = useSearchParams();
  const router = useRouter();
  const findQuery = embedded ? "" : (params.get("find")?.trim() ?? "");
  const findCurrent = embedded ? null : occurrence(params.get("n"));
  const notesContext = useNotes();
  const compareContext = useSnapshotCompare();
  const notes = embedded ? null : notesContext;
  const compare = embedded ? null : compareContext;
  const pinsSwitch = usePinsSwitch(entryMentions?.entries ?? NO_ENTRY_MENTIONS);
  const narrated = embedded ? null : narration;
  const listen = useDeskNarration(editor, narrated, !readOnly);
  const { listening } = listen;
  const toolbarShown = !outdated && !!editor && !readOnly && !listening;
  // Turning read-only unmounts the Formatting toolbar and its draft; don't resume customizing after.
  if (customizing && !toolbarShown) setCustomizing(false);
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
    report({ ...NO_DOCUMENT, doc: name });
    const slowTimer = setTimeout(() => setSlow(true), SLOW_MS);
    return () => {
      clearTimeout(slowTimer);
      report(NO_DOCUMENT);
    };
  }, [name, report]);

  useEffect(() => {
    if (snapshot) report({ snapshotChanged: snapshot.changed, snapshotEmpty: snapshot.empty });
  }, [report, snapshot]);

  useEffect(() => {
    report({ connection, slow, readOnly });
  }, [report, connection, slow, readOnly]);

  usePresence(embedded ? null : (session?.provider ?? null));

  const stopListening = listen.stop;
  useEffect(() => {
    if (comparing && listening) stopListening();
  }, [comparing, listening, stopListening]);

  // The page re-renders as the Trash notice, with who did it and Restore.
  useEffect(() => {
    if (connection === "trashed") router.refresh();
  }, [connection, router]);

  if (connection === "denied") {
    return (
      <p className={styles.denied} role="status">
        You can no longer open this {KINDS[kind].noun}.
      </p>
    );
  }
  if (connection === "trashed") {
    return (
      <p className={styles.denied} role="status">
        This {KINDS[kind].noun} was moved to the Trash.
      </p>
    );
  }

  return (
    <div className={embedded ? `${styles.live} ${styles.embedded}` : styles.live} hidden={comparing}>
      {!comparing && !embedded && (
        <DeskToolbar.Fill>
          <div className={styles.toolRow}>
            {outdated && <Outdated />}
            {listening && !readOnly && (
              <p className={styles.listening} role="status">
                Listening · press <kbd>Esc</kbd> or Stop to edit
              </p>
            )}
            {toolbarShown && (
              <FormattingToolbar
                editor={editor}
                layout={toolbarLayout}
                lists={kind === "entry"}
                scripts={kind === "chapter"}
                onAddNote={notes?.startDraft}
                customizing={customizing}
                onFinish={() => {
                  setCustomizing(false);
                  asideRef.current?.querySelector<HTMLElement>('button[aria-label="View options"]')?.focus();
                }}
              />
            )}
            <div ref={asideRef} className={styles.toolAside}>
              {findQuery && <FindBar kind={kind} id={id} query={findQuery} current={findCurrent} editor={editor} />}
              {tools}
              {narrated && <DeskListen source={listen.source} listening={listening} />}
              {outline}
              {notes && <NotesButton />}
              {kind === "chapter" && <PinnedButton entries={entryMentions?.entries ?? NO_ENTRY_MENTIONS} />}
              <ViewOptions
                notes={notes}
                pins={kind === "chapter" ? pinsSwitch : null}
                showAuthors={showAuthors}
                onShowAuthors={setShowAuthors}
                onCustomize={toolbarShown ? () => setCustomizing(true) : undefined}
              />
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
                  {kind === "chapter" && !embedded && entryMentions && (
                    <CueSuggestionList editor={editor} storyId={entryMentions.storyId} chapterId={id} />
                  )}
                </>
              )
            }
          >
            <LiveEditor
              kind={kind}
              embedded={embedded}
              session={session}
              writer={writer}
              editable={!readOnly && !listening}
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

const ignoreReport: ReturnType<typeof useLiveReport> = () => {};

/** The desk's LiveStatus reporter, or one that drops everything for an embedded document. */
function useReport(embedded: boolean) {
  const report = useLiveReport();
  return embedded ? ignoreReport : report;
}

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
  embedded,
  session,
  writer,
  editable,
  entryMentions = NO_ENTRY_MENTIONS,
  notes,
  find,
  onEditor,
}: {
  kind: LiveKind;
  embedded: boolean;
  session: LiveSession;
  writer: Writer | null;
  editable: boolean;
  entryMentions?: EntryMentionEntry[];
  notes?: NoteHighlightOptions;
  find: FindConfig;
  onEditor: (editor: Editor | null) => void;
}) {
  const report = useReport(embedded);
  const { extensions, label, placeholder } = KINDS[kind];
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: [
      ...extensions,
      Collaboration.configure({ document: session.ydoc, field: DOCUMENT_FIELD }),
      CollaborationCaret.configure({
        provider: session.provider,
        // A Pinned Entry's caret still shows, but its Writer isn't counted as here.
        user: { ...(writer ?? { viewer: true }), ...(embedded && { reference: true }) },
        render: renderCaret,
      }),
      Placeholder.configure({ placeholder }),
      Gapcursor,
      Dropcursor,
      AuthorStamp.configure({ userId: writer?.userId ?? null }),
      SmartPunctuation,
      EntryMentions.configure({ entries: entryMentions, focusable: !editable }),
      ...(notes ? [NoteHighlights.configure(notes)] : []),
      Find.configure(find),
      ...(kind === "chapter" && !embedded ? [Narration] : []),
      ...(kind === "chapter" && !embedded ? [CueSuggestions] : []),
      TabKey,
    ],
    editorProps: {
      attributes: { class: `${styles.prose} ${scriptStyles.scripts}`, "aria-label": label },
      ...(!embedded && { scrollThreshold: CARET_CLEARANCE, scrollMargin: CARET_CLEARANCE }),
    },
  });

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  // Picked from the sidebar overlay: the caret goes to the start, unless focus has moved on since arriving.
  const arrivalRef = useArrival();
  const pathname = usePathname();
  useEffect(() => {
    const pending = arrivalRef?.current;
    if (!editor || editor.isDestroyed || embedded || !editable || !arrivalRef || pending?.path !== pathname) return;
    arrivalRef.current = null;
    const focused = document.activeElement;
    if (focused === document.body || focused === pending.focused) editor.commands.focus("start");
  }, [editor, editable, embedded, arrivalRef, pathname]);

  useSmartPunctuation(editor);

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
        const user = state.user as (Partial<Writer> & { viewer?: boolean; reference?: boolean }) | undefined;
        if (user?.reference) continue;
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
