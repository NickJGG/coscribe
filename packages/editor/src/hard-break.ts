import { Extension } from "@tiptap/core"
import HardBreak from "@tiptap/extension-hard-break"
import { Fragment, Slice, type Node as PMNode } from "@tiptap/pm/model"
import { Plugin, PluginKey } from "@tiptap/pm/state"

/**
 * A line break inside a paragraph (Shift+Enter). It reads as one `\n` in `textContent`, so offsets into a
 * block's text stay ProseMirror offsets.
 */
export const LineBreak = HardBreak.extend({
  extendNodeSchema: (extension) => (extension.name === "hardBreak" ? { leafText: () => "\n" } : {}),

  addKeyboardShortcuts() {
    return { "Shift-Enter": () => this.editor.commands.setHardBreak() }
  },
})

const isBreak = (node: PMNode) => node.type.name === "hardBreak"

/** `block` split where 2+ line breaks run together, each part without line breaks at its edges. */
function splitAtBreakRuns(block: PMNode): PMNode[] {
  let found = false
  block.forEach((child) => (found ||= isBreak(child)))
  if (!found) return [block]
  const parts: PMNode[][] = [[]]
  let breaks: PMNode[] = []
  block.forEach((child) => {
    if (isBreak(child)) return void breaks.push(child)
    const part = parts[parts.length - 1]!
    if (part.length && breaks.length > 1) parts.push([child])
    else part.push(...(part.length ? breaks : []), child)
    breaks = []
  })
  return parts.map((part) => block.copy(Fragment.from(part)))
}

function splitFragment(fragment: Fragment): Fragment {
  const nodes: PMNode[] = []
  fragment.forEach((node) => {
    if (node.inlineContent) nodes.push(...splitAtBreakRuns(node))
    else if (node.isLeaf) nodes.push(node)
    else nodes.push(node.copy(splitFragment(node.content)))
  })
  return Fragment.from(nodes)
}

/** A pasted slice whose blank lines (`<br><br>`) start new paragraphs, as a typed one would. */
export function lineBreakSlice(slice: Slice): Slice {
  return new Slice(splitFragment(slice.content), slice.openStart, slice.openEnd)
}

export const LineBreakPaste = Extension.create({
  name: "lineBreakPaste",

  addProseMirrorPlugins() {
    return [new Plugin({ key: new PluginKey("lineBreakPaste"), props: { transformPasted: lineBreakSlice } })]
  },
})

/** `content` cut at its line breaks, which are dropped. */
export function lines(content: Fragment): Fragment[] {
  const out: PMNode[][] = [[]]
  content.forEach((child) => {
    if (isBreak(child)) out.push([])
    else out[out.length - 1]!.push(child)
  })
  return out.map((nodes) => Fragment.from(nodes))
}
