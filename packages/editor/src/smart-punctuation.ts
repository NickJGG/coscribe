import { Extension } from "@tiptap/core"
import { Fragment, Slice, type Node as PMNode } from "@tiptap/pm/model"
import { Plugin, PluginKey, type Command } from "@tiptap/pm/state"

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    smartPunctuation: {
      setSmartPunctuation: (enabled: boolean) => ReturnType
    }
  }

  interface Storage {
    smartPunctuation: SmartPunctuationStorage
  }
}

export type SmartPunctuationStorage = { enabled: boolean }

/** Characters after which a quote opens rather than closes. */
const OPENS = /[\s([{<—–‘“-]/u

const opens = (before: string) => !before || OPENS.test(before)

const leafText = (node: PMNode) => node.type.spec.leafText?.(node) ?? "￼"

/**
 * `text` with curly quotes, em dashes for `--` and ellipses for `...`, as typing it would give. `before` is the
 * character before `text`, which decides which way a leading quote faces.
 */
export function smartenText(text: string, before = ""): string {
  let out = ""
  let prev = before
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    let next = ch
    if (ch === "." && text.startsWith("...", i)) {
      next = "…"
      i += 2
    } else if (ch === "-" && text[i + 1] === "-") {
      next = "—"
      i += 1
    } else if (ch === '"') {
      next = opens(prev) ? "“" : "”"
    } else if (ch === "'") {
      next = opens(prev) ? "‘" : "’"
    }
    out += next
    prev = next
  }
  return out
}

function smartenBlock(block: PMNode, before: string): PMNode {
  const children: PMNode[] = []
  let prev = before
  block.forEach((child) => {
    if (child.isText) {
      const text = smartenText(child.text!, prev)
      children.push(text === child.text ? child : child.type.schema.text(text, child.marks))
      prev = text[text.length - 1] ?? prev
    } else {
      children.push(child)
      prev = leafText(child)
    }
  })
  return block.copy(Fragment.from(children))
}

function smartenFragment(fragment: Fragment, before: { first: string }): Fragment {
  const nodes: PMNode[] = []
  fragment.forEach((node) => {
    if (node.inlineContent) {
      nodes.push(smartenBlock(node, before.first))
      before.first = ""
    } else if (node.isLeaf) {
      nodes.push(node)
    } else {
      nodes.push(node.copy(smartenFragment(node.content, before)))
    }
  })
  return Fragment.from(nodes)
}

/** A pasted slice smartened as typed text would be. `before` is the character before the caret. */
export function smartenSlice(slice: Slice, before = ""): Slice {
  // A closed slice starts its own paragraph, so its first quote has nothing before it.
  const first = { first: slice.openStart > 0 ? before : "" }
  return new Slice(smartenFragment(slice.content, first), slice.openStart, slice.openEnd)
}

/**
 * What typing `text` after `before` (up to two characters) turns into: `insert` in place of the typed character and
 * the `replace` characters before it. Null when it stays as typed.
 */
export function smartInput(before: string, text: string): { replace: number; insert: string } | null {
  if (text.length !== 1) return null
  const last = before.slice(-1)
  if (text === '"') return { replace: 0, insert: opens(last) ? "“" : "”" }
  if (text === "'") return { replace: 0, insert: opens(last) ? "‘" : "’" }
  if (text === "-" && last === "-") return { replace: 1, insert: "—" }
  if (text === "." && before.endsWith("..")) return { replace: 2, insert: "…" }
  return null
}

type Conversion = { from: number; to: number; original: string }

const smartPunctuationKey = new PluginKey<Conversion | null>("smartPunctuation")

/**
 * Converts typed punctuation in one transaction with the typed character, rather than through Tiptap input rules,
 * which give up when another plugin (authorStamp) appends to the typing transaction.
 */
export function smartPunctuationPlugin(storage: SmartPunctuationStorage): Plugin<Conversion | null> {
  return new Plugin<Conversion | null>({
    key: smartPunctuationKey,
    state: {
      init: () => null,
      apply(tr, prev) {
        const meta = tr.getMeta(smartPunctuationKey) as Conversion | undefined
        if (meta) return meta
        // authorStamp's mark on the converted text mustn't cost the Backspace undo.
        if (prev && tr.getMeta("appendedTransaction")) {
          const from = tr.mapping.map(prev.from, 1)
          const to = tr.mapping.map(prev.to, -1)
          return from < to ? { ...prev, from, to } : null
        }
        return tr.docChanged || tr.selectionSet ? null : prev
      },
    },
    props: {
      handleTextInput(view, from, to, text, deflt) {
        if (!storage.enabled) return false
        const $start = view.state.doc.resolve(from)
        if ($start.parent.type.spec.code || !$start.sameParent(view.state.doc.resolve(to))) return false
        const offset = $start.parentOffset
        const before = $start.parent.textBetween(Math.max(0, offset - 2), offset, undefined, leafText)
        const smart = smartInput(before, text)
        if (!smart) return false

        const start = from - smart.replace
        const tr = deflt().insertText(smart.insert, start, from + text.length)
        const original = before.slice(before.length - smart.replace) + text
        tr.setMeta(smartPunctuationKey, { from: start, to: start + smart.insert.length, original } satisfies Conversion)
        view.dispatch(tr)
        return true
      },
      transformPasted(slice, view) {
        if (!storage.enabled) return slice
        const { $from } = view.state.selection
        const offset = $from.parentOffset
        const before = offset ? $from.parent.textBetween(offset - 1, offset, undefined, leafText) : ""
        return smartenSlice(slice, before)
      },
    },
  })
}

/** Turns the punctuation just converted back into what was typed, when the caret is still right after it. */
export const undoSmartPunctuation: Command = (state, dispatch) => {
  const last = smartPunctuationKey.getState(state)
  const { empty, head } = state.selection
  if (!last || !empty || head !== last.to) return false
  dispatch?.(state.tr.insertText(last.original, last.from, last.to))
  return true
}

/**
 * Curly quotes, em dashes and ellipses as you type and paste, while `storage.enabled` (the Story's Smart punctuation
 * setting). Backspace right after one undoes it. Not part of any schema.
 */
export const SmartPunctuation = Extension.create<object, SmartPunctuationStorage>({
  name: "smartPunctuation",
  // Its Backspace runs before the core keymap's and Script's (110).
  priority: 120,

  addStorage() {
    return { enabled: true }
  },

  addCommands() {
    return {
      setSmartPunctuation:
        (enabled) =>
        ({ dispatch }) => {
          if (dispatch) this.storage.enabled = enabled
          return true
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      Backspace: () => this.editor.isEditable && undoSmartPunctuation(this.editor.state, this.editor.view.dispatch),
    }
  },

  addProseMirrorPlugins() {
    return [smartPunctuationPlugin(this.storage)]
  },
})
