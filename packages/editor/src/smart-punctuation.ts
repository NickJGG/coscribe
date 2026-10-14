import { Extension, InputRule, textInputRule } from "@tiptap/core"
import { Fragment, Slice, type Node as PMNode } from "@tiptap/pm/model"
import { Plugin, PluginKey } from "@tiptap/pm/state"

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
      prev = child.type.spec.leafText?.(child) ?? "￼"
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
 * Curly quotes, em dashes and ellipses as you type and paste, while `storage.enabled` (the Story's Smart punctuation
 * setting). Backspace right after one undoes it. Not part of any schema.
 */
export const SmartPunctuation = Extension.create<object, SmartPunctuationStorage>({
  name: "smartPunctuation",

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

  addInputRules() {
    const rules = [
      textInputRule({ find: /(?:^|[\s([{<—–‘“-])(")$/u, replace: "“" }),
      textInputRule({ find: /"$/, replace: "”" }),
      textInputRule({ find: /(?:^|[\s([{<—–‘“-])(')$/u, replace: "‘" }),
      textInputRule({ find: /'$/, replace: "’" }),
      textInputRule({ find: /--$/, replace: "—" }),
      textInputRule({ find: /\.\.\.$/, replace: "…" }),
    ]
    return rules.map(
      (rule) =>
        new InputRule({ find: rule.find, handler: (props) => (this.storage.enabled ? rule.handler(props) : null) })
    )
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("smartPunctuation"),
        props: {
          transformPasted: (slice, view) => {
            if (!this.storage.enabled) return slice
            const { $from } = view.state.selection
            const offset = $from.parentOffset
            const before = offset ? $from.parent.textBetween(offset - 1, offset, undefined, "￼") : ""
            return smartenSlice(slice, before)
          },
        },
      }),
    ]
  },
})
