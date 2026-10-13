import { InputRule, Node } from "@tiptap/core"
import { Fragment, Slice, type Node as PMNode, type ResolvedPos } from "@tiptap/pm/model"
import { Plugin, PluginKey, TextSelection, type Command, type EditorState, type Transaction } from "@tiptap/pm/state"
import { ReplaceAroundStep } from "@tiptap/pm/transform"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import type { ContentJSON } from "./credits"

export const SCRIPT_ELEMENTS = ["sceneHeading", "action", "character", "parenthetical", "dialogue", "transition"] as const

export type ScriptElementType = (typeof SCRIPT_ELEMENTS)[number]

export const SCRIPT_ELEMENT_LABELS: Record<ScriptElementType, string> = {
  sceneHeading: "Scene Heading",
  action: "Action",
  character: "Character",
  parenthetical: "Parenthetical",
  dialogue: "Dialogue",
  transition: "Transition",
}

const isElement = (value: unknown): value is ScriptElementType => SCRIPT_ELEMENTS.includes(value as ScriptElementType)

/** The element Enter starts at the end of a line (Final Draft's order). */
const NEXT: Record<ScriptElementType, ScriptElementType> = {
  sceneHeading: "action",
  action: "action",
  character: "dialogue",
  parenthetical: "dialogue",
  dialogue: "action",
  transition: "sceneHeading",
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    script: {
      /** Turns the selected paragraphs into a Script's Action lines, or the selected Script lines back into paragraphs. */
      toggleScript: () => ReturnType
      setScriptElement: (element: ScriptElementType) => ReturnType
    }
  }
}

/** One line of a Script, its kind in `element`. Holds text and inline marks only. */
export const ScriptElement = Node.create({
  name: "scriptElement",
  content: "text*",

  addAttributes() {
    return {
      element: {
        default: "action",
        parseHTML: (el) => {
          const element = el.getAttribute("data-element")
          return isElement(element) ? element : "action"
        },
        renderHTML: (attrs) => ({ "data-element": attrs.element }),
      },
    }
  },

  parseHTML() {
    return [{ tag: "p[data-element]", priority: 60 }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["p", HTMLAttributes, 0]
  },
})

/**
 * A screenplay passage in a Chapter, of Script Elements. Adjacent Scripts always join. Typing `INT. ` or `EXT. `
 * on an empty paragraph starts one, and Enter, Tab and Shift-Tab move between elements as in Final Draft.
 */
export const Script = Node.create({
  name: "script",
  group: "block",
  content: "scriptElement+",
  defining: true,
  // Its keys run before the core keymap, and before TabKey's tab.
  priority: 110,

  parseHTML() {
    return [{ tag: "div[data-script]" }]
  },

  renderHTML() {
    return ["div", { "data-script": "" }, 0]
  },

  addCommands() {
    return {
      toggleScript:
        () =>
        ({ state, dispatch }) =>
          toggleScript(state, dispatch),
      setScriptElement:
        (element) =>
        ({ state, dispatch }) =>
          setScriptElement(element)(state, dispatch),
    }
  },

  addKeyboardShortcuts() {
    const run = (command: Command) => () => this.editor.isEditable && command(this.editor.state, this.editor.view.dispatch)
    return {
      Enter: run(scriptEnter),
      Tab: run(scriptTab),
      "Shift-Tab": run(scriptShiftTab),
      Backspace: run(scriptBackspace),
    }
  },

  addInputRules() {
    return [sceneHeadingRule]
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("script"),
        appendTransaction(transactions, _old, state) {
          if (!transactions.some((tr) => tr.docChanged && !tr.getMeta(Y_SYNC_META))) return null
          const tr = state.tr
          joinScripts(tr)
          return tr.steps.length ? tr : null
        },
        props: {
          transformPasted: (slice, view) => scriptSlice(slice, view.state.selection.$from),
          decorations: focusDecorations,
        },
      }),
    ]
  },
})

/** `INT. ` or `EXT. ` typed on an otherwise empty top-level paragraph starts a Script with that Scene Heading. */
export const sceneHeadingRule = new InputRule({
  find: /^(INT|EXT)\.\s$/i,
  handler: ({ state, range, match }) => {
    const $from = state.doc.resolve(range.from)
    // The typed space isn't in the doc yet.
    if ($from.depth !== 1 || $from.parent.type.name !== "paragraph") return null
    if ($from.parent.content.size !== match[0].length - 1) return null
    const { tr } = state
    tr.insertText(`${match[1]!.toUpperCase()}. `, range.from, range.to)
    wrapParagraph(tr, $from.before(), "sceneHeading")
    joinScripts(tr)
  },
})

// y-tiptap's ySyncPluginKey: remote edits and the initial load. Each client joins its own edits' Scripts.
const Y_SYNC_META = "y-sync$"

type Line = { node: PMNode; element: ScriptElementType; pos: number; scriptPos: number; index: number; offset: number }

function lineAt($pos: ResolvedPos): Line | null {
  if ($pos.parent.type.name !== "scriptElement") return null
  return {
    node: $pos.parent,
    element: $pos.parent.attrs.element,
    pos: $pos.before(),
    scriptPos: $pos.before($pos.depth - 1),
    index: $pos.index($pos.depth - 1),
    offset: $pos.parentOffset,
  }
}

const caretLine = (state: EditorState) => (state.selection.empty ? lineAt(state.selection.$from) : null)

const isWrapped = (text: string) => text.length >= 2 && text.startsWith("(") && text.endsWith(")")

/** An empty line, or a Parenthetical holding only its `()`. */
const isBlank = ({ node, element }: Line) =>
  node.content.size === 0 || (element === "parenthetical" && node.textContent === "()")

/** Changes the line at `pos` to `element`, adding a Parenthetical's `()` or taking it off. */
function retype(tr: Transaction, pos: number, element: ScriptElementType) {
  const node = tr.doc.nodeAt(pos)!
  const was = node.attrs.element as ScriptElementType
  if (was === element) return
  const start = pos + 1
  const end = start + node.content.size
  const text = node.textContent
  const caretHere = tr.selection.empty && tr.selection.from >= start && tr.selection.from <= end
  tr.setNodeMarkup(pos, undefined, { ...node.attrs, element })
  if (element === "parenthetical" && !isWrapped(text)) {
    tr.insertText(")", end)
    tr.insertText("(", start)
    if (!text && caretHere) tr.setSelection(TextSelection.create(tr.doc, start + 1))
  } else if (was === "parenthetical" && isWrapped(text)) {
    tr.delete(end - 1, end)
    tr.delete(start, start + 1)
  }
}

/** Adds an `element` line after the line at `pos`, with the caret in it (inside a Parenthetical's `()`). */
function insertLine(tr: Transaction, pos: number, element: ScriptElementType) {
  const type = tr.doc.type.schema.nodes.scriptElement!
  const at = pos + tr.doc.nodeAt(pos)!.nodeSize
  const parenthetical = element === "parenthetical"
  tr.insert(at, type.create({ element }, parenthetical ? tr.doc.type.schema.text("()") : null))
  tr.setSelection(TextSelection.create(tr.doc, at + (parenthetical ? 2 : 1)))
}

/**
 * Wraps the top-level paragraph at `pos` in a Script of one `element` line. A ReplaceAroundStep keeps the text
 * itself untouched, so the authorship stamp doesn't take it over.
 */
function wrapParagraph(tr: Transaction, pos: number, element: ScriptElementType) {
  const { schema } = tr.doc.type
  const size = tr.doc.nodeAt(pos)!.nodeSize
  const wrapper = schema.nodes.script!.create(null, schema.nodes.scriptElement!.create({ element }))
  tr.step(new ReplaceAroundStep(pos, pos + size, pos + 1, pos + size - 1, new Slice(Fragment.from(wrapper), 0, 0), 2, true))
}

/**
 * Turns line `index` of the Script at `scriptPos` into a paragraph, splitting the Script around it. Returns the
 * paragraph's position. Lines before it keep their positions.
 */
function unwrapLine(tr: Transaction, scriptPos: number, index: number): number {
  const script = tr.doc.nodeAt(scriptPos)!
  let start = scriptPos + 1
  for (let i = 0; i < index; i++) start += script.child(i).nodeSize
  const line = script.child(index)
  if (index < script.childCount - 1) tr.split(start + line.nodeSize, 1)
  let pos = scriptPos
  if (index > 0) {
    tr.split(start, 1)
    pos = start + 1
  }
  const paragraph = tr.doc.type.schema.nodes.paragraph!.create()
  const size = line.nodeSize + 2
  tr.step(new ReplaceAroundStep(pos, pos + size, pos + 2, pos + size - 2, new Slice(Fragment.from(paragraph), 0, 0), 1, true))
  return pos
}

/** Joins every pair of adjacent top-level Scripts. */
export function joinScripts(tr: Transaction) {
  const { doc } = tr
  let pos = doc.content.size
  for (let i = doc.childCount - 1; i > 0; i--) {
    pos -= doc.child(i).nodeSize
    if (doc.child(i).type.name === "script" && doc.child(i - 1).type.name === "script") tr.join(pos)
  }
}

export const toggleScript: Command = (state, dispatch) => {
  const { $from, $to } = state.selection
  const first = lineAt($from)
  if (first) {
    const last = lineAt($to)
    const script = state.doc.nodeAt(first.scriptPos)!
    const end = last && last.scriptPos === first.scriptPos ? last.index : script.childCount - 1
    if (dispatch) {
      const tr = state.tr
      for (let i = end; i >= first.index; i--) unwrapLine(tr, first.scriptPos, i)
      dispatch(tr.scrollIntoView())
    }
    return true
  }

  const { doc } = state
  const from = $from.index(0)
  const to = Math.max(from, $to.depth ? $to.index(0) : $to.index(0) - 1)
  let paragraphs = 0
  for (let i = from; i <= to; i++) {
    const name = doc.child(i).type.name
    if (name === "paragraph") paragraphs++
    else if (name !== "script") return false
  }
  if (!paragraphs) return false
  if (dispatch) {
    const tr = state.tr
    let pos = 0
    const starts: number[] = []
    for (let i = 0; i <= to; i++) {
      starts.push(pos)
      pos += doc.child(i).nodeSize
    }
    for (let i = to; i >= from; i--) {
      if (doc.child(i).type.name === "paragraph") wrapParagraph(tr, starts[i]!, "action")
    }
    joinScripts(tr)
    dispatch(tr.scrollIntoView())
  }
  return true
}

/** Sets the selected Script lines to `element`. */
export function setScriptElement(element: ScriptElementType): Command {
  return (state, dispatch) => {
    const { from, to } = state.selection
    const lines: number[] = []
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (node.type.name === "scriptElement") lines.push(pos)
      return node.type.name !== "scriptElement"
    })
    if (!lines.length) return false
    if (dispatch) {
      const tr = state.tr
      for (const pos of lines.reverse()) retype(tr, pos, element)
      dispatch(tr)
    }
    return true
  }
}

/**
 * Enter at the end of a line starts the next element; just before a Parenthetical's `)` counts as the end.
 * An empty line becomes Action, and an empty Action line leaves the Script (splitting it if lines follow).
 * Mid-line, the core split runs.
 */
export const scriptEnter: Command = (state, dispatch) => {
  const line = caretLine(state)
  if (!line) return false
  const { node, element, pos, offset } = line
  const end = node.content.size - (element === "parenthetical" && node.textContent.endsWith(")") ? 1 : 0)
  if (!isBlank(line) && offset < end) return false
  if (dispatch) {
    const tr = state.tr
    if (!isBlank(line)) insertLine(tr, pos, NEXT[element])
    else if (element !== "action") retype(tr, pos, "action")
    else {
      const at = unwrapLine(tr, line.scriptPos, line.index)
      tr.setSelection(TextSelection.create(tr.doc, at + 1))
    }
    dispatch(tr.scrollIntoView())
  }
  return true
}

/** Action becomes Character; Character and Dialogue add a Parenthetical below, or when empty become Transition / Parenthetical. */
export const scriptTab: Command = (state, dispatch) => {
  const line = lineAt(state.selection.$from)
  if (!line) return false
  const tr = state.tr
  const blank = isBlank(line)
  if (line.element === "action") retype(tr, line.pos, "character")
  else if (line.element === "character") blank ? retype(tr, line.pos, "transition") : insertLine(tr, line.pos, "parenthetical")
  else if (line.element === "dialogue") blank ? retype(tr, line.pos, "parenthetical") : insertLine(tr, line.pos, "parenthetical")
  // Other lines swallow Tab rather than type one.
  if (dispatch && tr.docChanged) dispatch(tr.scrollIntoView())
  return true
}

const SHIFT_TAB: Partial<Record<ScriptElementType, ScriptElementType>> = {
  character: "action",
  transition: "character",
  parenthetical: "dialogue",
}

export const scriptShiftTab: Command = (state, dispatch) => {
  const line = lineAt(state.selection.$from)
  if (!line) return false
  const element = SHIFT_TAB[line.element]
  if (element && dispatch) {
    const tr = state.tr
    retype(tr, line.pos, element)
    dispatch(tr.scrollIntoView())
  }
  return true
}

/**
 * In an empty `()`, the Parenthetical becomes Dialogue. At the start of a Script's first line, the line leaves
 * as a paragraph; at the start of a later line, it joins the line above.
 */
export const scriptBackspace: Command = (state, dispatch) => {
  const line = caretLine(state)
  if (!line) return false
  const emptyParenthetical = line.element === "parenthetical" && line.node.textContent === "()" && line.offset === 1
  if (!emptyParenthetical && line.offset !== 0) return false
  if (dispatch) {
    const tr = state.tr
    if (emptyParenthetical) retype(tr, line.pos, "dialogue")
    else if (line.index === 0) {
      const at = unwrapLine(tr, line.scriptPos, 0)
      tr.setSelection(TextSelection.create(tr.doc, at + 1))
    }
    else tr.join(line.pos)
    dispatch(tr.scrollIntoView())
  }
  return true
}

/** Inside a Script, pasted paragraphs (and plain-text lines) become Action lines. */
export function scriptSlice(slice: Slice, $at: ResolvedPos): Slice {
  if (!lineAt($at)) return slice
  const type = $at.parent.type
  let changed = false
  const nodes: PMNode[] = []
  slice.content.forEach((node) => {
    if (node.type.name === "paragraph") {
      nodes.push(type.create({ element: "action" }, node.content))
      changed = true
    } else {
      nodes.push(node)
    }
  })
  return changed ? new Slice(Fragment.from(nodes), slice.openStart, slice.openEnd) : slice
}

/** Marks the Script holding the caret `is-focused`, and labels its empty lines with their element. */
function focusDecorations(state: EditorState): DecorationSet | null {
  const { $from } = state.selection
  if ($from.depth < 1 || $from.node(1).type.name !== "script") return null
  const script = $from.node(1)
  const pos = $from.before(1)
  const decorations = [Decoration.node(pos, pos + script.nodeSize, { class: "is-focused" })]
  script.forEach((line, offset) => {
    if (line.content.size) return
    const at = pos + 1 + offset
    decorations.push(
      Decoration.node(at, at + line.nodeSize, { "data-placeholder": SCRIPT_ELEMENT_LABELS[line.attrs.element as ScriptElementType] })
    )
  })
  return DecorationSet.create(state.doc, decorations)
}

/** The distinct Character cues in a document, in order, ignoring case. */
export function scriptCues(doc: ContentJSON): string[] {
  const cues = new Map<string, string>()
  const visit = (node: ContentJSON) => {
    if (node.type === "scriptElement") {
      if (node.attrs?.element !== "character") return
      const cue = (node.content ?? []).map((c) => c.text ?? "").join("").trim()
      if (cue && !cues.has(cue.toLowerCase())) cues.set(cue.toLowerCase(), cue)
      return
    }
    node.content?.forEach(visit)
  }
  visit(doc)
  return [...cues.values()]
}
