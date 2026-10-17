import Blockquote from "@tiptap/extension-blockquote"
import { BulletList, ListItem, OrderedList } from "@tiptap/extension-list"
import TextAlign from "@tiptap/extension-text-align"

/** A block quote of paragraphs and lists, so no Scene Breaks or Scripts inside. */
export const StoryBlockquote = Blockquote.extend({ content: "(paragraph | bulletList | orderedList)+" })

/** A Chapter's lists start only from the toolbar, their shortcuts or a paste: `- ` and `1. ` stay as typed. */
export const ChapterBulletList = BulletList.extend({ addInputRules: () => [] })

export const ChapterOrderedList = OrderedList.extend({ addInputRules: () => [] })

/** A Chapter's list item: paragraphs and nested lists, never a Scene Break, Script or block quote. */
export const ChapterListItem = ListItem.extend({ content: "paragraph (paragraph | bulletList | orderedList)*" })

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
