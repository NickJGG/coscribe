import Blockquote from "@tiptap/extension-blockquote"
import TextAlign from "@tiptap/extension-text-align"

/** A Chapter's block quote: paragraphs only, so no Scene Breaks inside. */
export const ChapterBlockquote = Blockquote.extend({ content: "paragraph+" })

/** An Entry's block quote, which can also hold lists. */
export const EntryBlockquote = Blockquote.extend({ content: "(paragraph | bulletList | orderedList)+" })

export type Alignment = "left" | "center" | "right"

/**
 * Center and right alignment on paragraphs. Left is the absence of the attribute, so pasted `text-align: left`
 * isn't stored and `setTextAlign("left")` clears it. No Mod-Shift-R: that's the browser's hard reload.
 */
export const Align = TextAlign.extend({
  addCommands() {
    const commands = this.parent!()
    return {
      ...commands,
      setTextAlign: (alignment) => (props) =>
        alignment === "left" ? props.commands.unsetTextAlign() : commands.setTextAlign!(alignment)(props),
    }
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Shift-l": () => this.editor.commands.setTextAlign("left"),
      "Mod-Shift-e": () => this.editor.commands.setTextAlign("center"),
    }
  },
}).configure({ types: ["paragraph"], alignments: ["center", "right"] })
