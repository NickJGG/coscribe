"use client";

import { Fragment, useEffect, useId, useOptimistic, useRef, useState, useTransition } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { SCRIPT_ELEMENT_LABELS, SCRIPT_ELEMENTS, type Alignment, type ScriptElementType } from "@coscribe/editor";
import { setToolbarLayout } from "@/lib/actions/profile";
import {
  DEFAULT_TOOLBAR_LAYOUT,
  sameLayout,
  type GroupId,
  type ToolbarLayout,
  type ToolId,
} from "@/lib/toolbar-layout";
import {
  AddNoteIcon,
  AlignIcon,
  BlockQuoteIcon,
  BulletListIcon,
  GripIcon,
  NumberedListIcon,
  SceneBreakIcon,
  ScriptIcon,
} from "./icons";
import { canAddNote } from "./notes/NoteHighlights";
import styles from "./LiveDocument.module.css";

type Active = {
  bold: boolean;
  italic: boolean;
  strike: boolean;
  blockquote: boolean;
  align: Alignment;
  bulletList: boolean;
  orderedList: boolean;
  note: boolean;
  script: boolean;
  canScript: boolean;
  scriptElement: ScriptElementType | null;
};

type Tool = {
  label: string;
  tip?: string;
  keys?: string;
  icon: (active: Active) => React.ReactNode;
  pressed?: (active: Active) => boolean;
  run: (editor: Editor, onAddNote?: () => void) => void;
};

const TOOLS: Record<Exclude<ToolId, "align">, Tool> = {
  bold: {
    label: "Bold",
    keys: "Ctrl+B",
    icon: () => <strong>B</strong>,
    pressed: (a) => a.bold,
    run: (editor) => editor.chain().focus().toggleBold().run(),
  },
  italic: {
    label: "Italic",
    keys: "Ctrl+I",
    icon: () => <em>I</em>,
    pressed: (a) => a.italic,
    run: (editor) => editor.chain().focus().toggleItalic().run(),
  },
  strike: {
    label: "Strikethrough",
    keys: "Ctrl+Shift+S",
    icon: () => <s>S</s>,
    pressed: (a) => a.strike,
    run: (editor) => editor.chain().focus().toggleStrike().run(),
  },
  sceneBreak: {
    label: "Scene Break",
    keys: "Type *** on an empty line",
    icon: () => <SceneBreakIcon />,
    run: (editor) => editor.chain().focus().insertSceneBreak().run(),
  },
  blockquote: {
    label: "Block quote",
    keys: "Ctrl+Shift+B · type > and a space",
    icon: () => <BlockQuoteIcon />,
    pressed: (a) => a.blockquote,
    run: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  script: {
    label: "Script",
    keys: "Type INT. or EXT. and a space",
    icon: () => <ScriptIcon />,
    pressed: (a) => a.script,
    run: (editor) => editor.chain().focus().toggleScript().run(),
  },
  bulletList: {
    label: "Bulleted list",
    keys: "Type - and a space",
    icon: () => <BulletListIcon />,
    pressed: (a) => a.bulletList,
    run: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  orderedList: {
    label: "Numbered list",
    keys: "Type 1. and a space",
    icon: () => <NumberedListIcon />,
    pressed: (a) => a.orderedList,
    run: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  addNote: {
    label: "Add Note",
    tip: "Add Note on the selected text",
    keys: "Ctrl+Alt+M",
    icon: () => <AddNoteIcon />,
    run: (_, onAddNote) => onAddNote?.(),
  },
};

const GROUP_LABELS: Record<GroupId, string> = {
  inline: "Text style",
  block: "Paragraph",
  lists: "Lists",
  note: "Notes",
};

/** Tools that don't apply inside a Script. */
const NOT_IN_SCRIPT = new Set<ToolId>(["sceneBreak", "blockquote", "align"]);

function toolDisabled(tool: ToolId, active: Active): boolean {
  if (active.script && NOT_IN_SCRIPT.has(tool)) return true;
  return (tool === "addNote" && !active.note) || (tool === "script" && !active.canScript);
}

const labelOf = (tool: ToolId) => (tool === "align" ? "Alignment" : TOOLS[tool].label);

const ALIGNMENTS = [
  { align: "left", label: "Align left", keys: "Ctrl+Shift+L" },
  { align: "center", label: "Center", keys: "Ctrl+Shift+E" },
  { align: "right", label: "Align right", keys: undefined },
] satisfies { align: Alignment; label: string; keys?: string }[];

const keepEditorFocus = (e: React.MouseEvent) => e.preventDefault();

/** How to reach each Script Element from the keyboard. */
const ELEMENT_KEYS: Record<ScriptElementType, string> = {
  sceneHeading: "Type INT. or EXT. and a space · Enter after a Transition",
  action: "Enter after a Scene Heading or Dialogue",
  character: "Tab on an Action line",
  parenthetical: "Tab on a Character or Dialogue line",
  dialogue: "Enter after a Character",
  transition: "Tab on an empty Character line",
};

function scriptElementOf(editor: Editor): ScriptElementType | null {
  const { parent } = editor.state.selection.$from;
  return parent.type.name === "scriptElement" ? parent.attrs.element : null;
}

function alignmentOf(editor: Editor): Alignment {
  if (editor.isActive({ textAlign: "center" })) return "center";
  return editor.isActive({ textAlign: "right" }) ? "right" : "left";
}

/**
 * The desk's Formatting toolbar, in the signed-in account's order. `customizing` is started from the View options
 * menu: it reorders groups by their grips and tools within their group, and the order is saved once, on Done.
 * Cancel, Escape or unmounting drops the draft. Either way it ends with `onFinish`.
 * Lists show only on an Entry, the Script tool only on a Chapter, and Add Note only with `onAddNote`. While the
 * caret is in a Script, its element picker heads the toolbar.
 */
export function FormattingToolbar({
  editor,
  layout,
  lists,
  scripts,
  onAddNote,
  customizing,
  onFinish,
}: {
  editor: Editor;
  layout: ToolbarLayout;
  lists: boolean;
  scripts: boolean;
  onAddNote?: () => void;
  customizing: boolean;
  onFinish: () => void;
}) {
  const active = useEditorState({
    editor,
    selector: ({ editor }): Active => ({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      strike: editor.isActive("strike"),
      blockquote: editor.isActive("blockquote"),
      align: alignmentOf(editor),
      bulletList: editor.isActive("bulletList"),
      orderedList: editor.isActive("orderedList"),
      note: canAddNote(editor),
      script: editor.isActive("script"),
      canScript: scripts && editor.can().toggleScript(),
      scriptElement: scriptElementOf(editor),
    }),
  });
  const [saved, setSaved] = useOptimistic(layout);
  // This session's edits: null until something changes, so starting needs no copy of `saved`.
  const [draft, setDraft] = useState<ToolbarLayout | null>(null);
  const [dragging, setDragging] = useState(false);
  const [, startTransition] = useTransition();
  const toolbarRef = useRef<HTMLDivElement>(null);
  const layoutShown = customizing ? (draft ?? saved) : saved;
  const shown = layoutShown
    .filter(([group]) => (group !== "lists" || lists) && (group !== "note" || onAddNote))
    .map(([group, tools]): [GroupId, ToolId[]] => [group, tools.filter((tool) => tool !== "script" || scripts)]);

  useEffect(() => {
    if (customizing) toolbarRef.current?.querySelector<HTMLElement>("[data-grip]")?.focus();
  }, [customizing]);

  const finish = (save: boolean) => {
    if (save && draft && !sameLayout(draft, saved)) {
      startTransition(async () => {
        setSaved(draft);
        await setToolbarLayout(draft);
      });
    }
    setDraft(null);
    onFinish();
  };

  return (
    <div
      ref={toolbarRef}
      className={customizing ? `${styles.toolbar} ${styles.customizing}` : styles.toolbar}
      role="toolbar"
      aria-label="Formatting"
      onKeyDown={(e) => {
        // During a drag, Escape cancels only the drag.
        if (customizing && e.key === "Escape" && !dragging) finish(false);
      }}
    >
      {customizing ? (
        <CustomizeGroups layout={layoutShown} shown={shown} active={active} onChange={setDraft} onDragging={setDragging} />
      ) : (
        <>
          {active.scriptElement && (
            <>
              <ElementTool editor={editor} element={active.scriptElement} />
              <span className={styles.toolSep} aria-hidden />
            </>
          )}
          {shown.map(([group, tools], i) => (
            <Fragment key={group}>
              {i > 0 && <span className={styles.toolSep} aria-hidden />}
              {tools.map((tool) =>
                tool === "align" ? (
                  <AlignTool key={tool} editor={editor} align={active.align} disabled={toolDisabled(tool, active)} />
                ) : (
                  <ToolButton
                    key={tool}
                    tool={TOOLS[tool]}
                    active={active}
                    disabled={toolDisabled(tool, active)}
                    onMouseDown={tool === "addNote" ? keepEditorFocus : undefined}
                    onClick={() => TOOLS[tool].run(editor, onAddNote)}
                  />
                )
              )}
            </Fragment>
          ))}
        </>
      )}
      {customizing && (
        <>
          <span className={styles.toolSep} aria-hidden />
          <span className={styles.customizeActions}>
            <button
              type="button"
              className="button button-ghost button-tiny"
              onClick={() => setDraft(DEFAULT_TOOLBAR_LAYOUT)}
            >
              Reset
            </button>
            <button type="button" className="button button-ghost button-tiny" onClick={() => finish(false)}>
              Cancel
            </button>
            <button type="button" className="button button-primary button-tiny" onClick={() => finish(true)}>
              Done
            </button>
          </span>
        </>
      )}
    </div>
  );
}

function ToolButton({ tool, active, ...props }: { tool: Tool; active: Active } & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={styles.tool}
      aria-pressed={tool.pressed?.(active)}
      data-tip={tool.tip ?? tool.label}
      data-keys={tool.keys}
      aria-label={tool.label}
      {...props}
    >
      {tool.icon(active)}
    </button>
  );
}

type SortData = { type: "group" } | { type: "tool"; group: GroupId };

const SCREEN_READER_INSTRUCTIONS = {
  draggable:
    "To reorder a group or a tool, press Space or Enter to pick it up. Use the arrow keys to move it, then Space or Enter to drop it, or Escape to cancel. Tools stay in their own group.",
};

/** Groups and tools only land among their own kind, and tools only within their group. */
const sameContainer: CollisionDetection = (args) => {
  const from = args.active.data.current as SortData | undefined;
  return closestCenter({
    ...args,
    droppableContainers: args.droppableContainers.filter((container) => {
      const to = container.data.current as SortData | undefined;
      if (!from || !to || from.type !== to.type) return false;
      return from.type === "group" || (to.type === "tool" && to.group === from.group);
    }),
  });
};

function CustomizeGroups({
  layout,
  shown,
  active,
  onChange,
  onDragging,
}: {
  layout: ToolbarLayout;
  shown: ToolbarLayout;
  active: Active;
  onChange: (layout: ToolbarLayout) => void;
  onDragging: (dragging: boolean) => void;
}) {
  const dndId = useId();
  // dnd-kit announces from an effect, after the drop has already reordered the toolbar.
  const dropMessage = useRef("");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const siblingsOf = (data: SortData): UniqueIdentifier[] =>
    data.type === "group" ? shown.map(([group]) => group) : (shown.find(([group]) => group === data.group)?.[1] ?? []);
  const dataOf = (id: UniqueIdentifier): SortData => {
    const group = shown.find(([group, tools]) => group === id || tools.includes(id as ToolId));
    return group?.[0] === id || !group ? { type: "group" } : { type: "tool", group: group[0] };
  };
  const nameOf = (id: UniqueIdentifier) =>
    dataOf(id).type === "group" ? `${GROUP_LABELS[id as GroupId]} group` : labelOf(id as ToolId);
  const placeOf = (id: UniqueIdentifier) => siblingsOf(dataOf(id)).indexOf(id) + 1;

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}, at position ${placeOf(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${nameOf(active.id)} is over position ${placeOf(over.id)}.` : `${nameOf(active.id)} is outside its row.`,
    onDragEnd: () => dropMessage.current,
    onDragCancel: ({ active }) =>
      `Reordering cancelled. ${nameOf(active.id)} stayed at position ${placeOf(active.id)}.`,
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    onDragging(false);
    const data = dataOf(active.id);
    const siblings = siblingsOf(data);
    const from = siblings.indexOf(active.id);
    const to = over ? siblings.indexOf(over.id) : -1;
    if (from < 0 || to < 0 || from === to) {
      dropMessage.current = `${nameOf(active.id)} stayed at position ${from + 1}.`;
      return;
    }
    dropMessage.current = `${nameOf(active.id)} moved to position ${to + 1}.`;
    if (data.type === "group") {
      const groups = layout.map(([group]) => group);
      onChange(arrayMove(layout, groups.indexOf(active.id as GroupId), groups.indexOf(over!.id as GroupId)));
    } else {
      onChange(
        layout.map(([group, tools]) =>
          group === data.group
            ? [group, arrayMove(tools, tools.indexOf(active.id as ToolId), tools.indexOf(over!.id as ToolId))]
            : [group, tools]
        )
      );
    }
  };

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={sameContainer}
      modifiers={[restrictToHorizontalAxis]}
      accessibility={{ announcements, screenReaderInstructions: SCREEN_READER_INSTRUCTIONS }}
      onDragStart={() => onDragging(true)}
      onDragEnd={onDragEnd}
      onDragCancel={() => onDragging(false)}
    >
      <SortableContext items={shown.map(([group]) => group)} strategy={horizontalListSortingStrategy}>
        {shown.map(([group, tools]) => (
          <SortableGroup key={group} group={group}>
            <SortableContext items={tools} strategy={horizontalListSortingStrategy}>
              {tools.map((tool) => (
                <SortableTool key={tool} tool={tool} group={group} active={active} />
              ))}
            </SortableContext>
          </SortableGroup>
        ))}
      </SortableContext>
    </DndContext>
  );
}

function SortableGroup({ group, children }: { group: GroupId; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: group,
    data: { type: "group" } satisfies SortData,
  });
  return (
    <span
      ref={setNodeRef}
      role="group"
      aria-label={GROUP_LABELS[group]}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={isDragging ? `${styles.toolGroup} ${styles.dragging}` : styles.toolGroup}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className={styles.toolGrip}
        data-grip
        aria-label={`Reorder the ${GROUP_LABELS[group]} group`}
        {...attributes}
        {...listeners}
      >
        <GripIcon />
      </button>
      {children}
    </span>
  );
}

function SortableTool({ tool, group, active }: { tool: ToolId; group: GroupId; active: Active }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tool,
    data: { type: "tool", group } satisfies SortData,
  });
  const props = {
    ref: setNodeRef,
    style: { transform: CSS.Translate.toString(transform), transition },
    className: isDragging ? `${styles.tool} ${styles.dragging}` : styles.tool,
    ...attributes,
    ...listeners,
    "aria-disabled": true,
  };
  if (tool === "align") {
    return (
      <button type="button" data-tip="Alignment" aria-label="Alignment" {...props}>
        <AlignIcon align={active.align} />
      </button>
    );
  }
  return <ToolButton tool={TOOLS[tool]} active={active} {...props} />;
}

/** A toolbar button's popover: Escape, a click outside, or tabbing away closes it. */
function usePopover() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      if (wrapRef.current?.contains(document.activeElement)) buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const onBlur = (e: React.FocusEvent) => {
    const next = e.relatedTarget as Node | null;
    if (next && !e.currentTarget.contains(next)) setOpen(false);
  };

  return { open, setOpen, wrapRef, buttonRef, onBlur };
}

/** One button showing the paragraph's alignment, opening a row of the three. Clicks keep focus in the editor. */
function AlignTool({ editor, align, disabled }: { editor: Editor; align: Alignment; disabled: boolean }) {
  const { open, setOpen, wrapRef, buttonRef, onBlur } = usePopover();
  const rowId = useId();

  return (
    <span
      ref={wrapRef}
      className={styles.alignTool}
      onBlur={onBlur}
    >
      <button
        ref={buttonRef}
        type="button"
        className={styles.tool}
        aria-label="Alignment"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={rowId}
        data-tip="Alignment"
        disabled={disabled}
        onMouseDown={keepEditorFocus}
        onClick={() => setOpen(!open)}
      >
        <AlignIcon align={align} />
      </button>
      <span id={rowId} className={styles.alignRow} role="group" aria-label="Alignment" hidden={!open}>
        {ALIGNMENTS.map((option) => (
          <button
            key={option.align}
            type="button"
            className={styles.tool}
            aria-pressed={align === option.align}
            aria-label={option.label}
            data-tip={option.label}
            data-keys={option.keys}
            onMouseDown={keepEditorFocus}
            onClick={() => {
              editor.chain().focus().setTextAlign(option.align).run();
              setOpen(false);
            }}
          >
            <AlignIcon align={option.align} />
          </button>
        ))}
      </span>
    </span>
  );
}

/**
 * The caret line's Script Element, opening a list of all six; picking one changes the selected lines. The way
 * between elements where there's no Tab key, as on a phone.
 */
function ElementTool({ editor, element }: { editor: Editor; element: ScriptElementType }) {
  const { open, setOpen, wrapRef, buttonRef, onBlur } = usePopover();
  const listId = useId();

  return (
    <span
      ref={wrapRef}
      className={styles.alignTool}
      onBlur={onBlur}
    >
      <button
        ref={buttonRef}
        type="button"
        className={`${styles.tool} ${styles.elementTool}`}
        aria-label={`Script Element: ${SCRIPT_ELEMENT_LABELS[element]}`}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={listId}
        data-tip="Script Element"
        onMouseDown={keepEditorFocus}
        onClick={() => setOpen(!open)}
      >
        {SCRIPT_ELEMENT_LABELS[element]} <span aria-hidden>&#9662;</span>
      </button>
      <span id={listId} className={styles.elementList} role="group" aria-label="Script Element" hidden={!open}>
        {SCRIPT_ELEMENTS.map((option) => (
          <button
            key={option}
            type="button"
            className={styles.tool}
            aria-pressed={element === option}
            data-tip={SCRIPT_ELEMENT_LABELS[option]}
            data-keys={ELEMENT_KEYS[option]}
            data-side="right"
            onMouseDown={keepEditorFocus}
            onClick={() => {
              editor.chain().focus().setScriptElement(option).run();
              setOpen(false);
            }}
          >
            {SCRIPT_ELEMENT_LABELS[option]}
          </button>
        ))}
      </span>
    </span>
  );
}
