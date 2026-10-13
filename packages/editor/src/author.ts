import { Extension, Mark } from "@tiptap/core"
import type { Mark as PMMark } from "@tiptap/pm/model"
import { Plugin, PluginKey, type EditorState, type Transaction } from "@tiptap/pm/state"

export type AuthorAttrs = { userId: string; at: number }

/** The `userId` of Imported Text: text brought in from a file that no Writer claimed. Credited to no one's account. */
export const IMPORTED_AUTHOR = "imported"

/** Who wrote a run of text, and when (epoch ms). Credits sum marked text length per `userId`. */
export const Author = Mark.create({
  name: "author",

  addAttributes() {
    return {
      userId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-author"),
        renderHTML: (attrs) => ({ "data-author": attrs.userId }),
      },
      at: {
        default: null,
        parseHTML: (el) => Number(el.getAttribute("data-at")) || null,
        renderHTML: (attrs) => ({ "data-at": attrs.at }),
      },
    }
  },

  parseHTML() {
    return [{ tag: "span[data-author]" }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", HTMLAttributes, 0]
  },
})

/**
 * Typing that continues the user's own run within this window keeps the run's `at`, so a session of
 * writing stays one mark instead of one per keystroke.
 */
export const AUTHOR_RUN_MS = 10 * 60_000

type Range = { from: number; to: number; pasted: boolean }

// y-tiptap's ySyncPluginKey; it tags remote edits, the initial load, and undo/redo with this meta.
const Y_SYNC_META = "y-sync$"

function fromYjs(tr: Transaction): boolean {
  return !!(tr.getMeta(Y_SYNC_META) as { isChangeOrigin?: boolean } | undefined)?.isChangeOrigin
}

/** Stamps text the local user inserts with their `author` mark. Remote and undo/redo changes are left alone. */
export function authorStampPlugin(userId: string): Plugin {
  const ownRun = (mark: PMMark | undefined, now: number): mark is PMMark =>
    !!mark && mark.attrs.userId === userId && now - mark.attrs.at < AUTHOR_RUN_MS

  return new Plugin({
    key: new PluginKey("authorStamp"),

    appendTransaction(transactions, _oldState, state: EditorState) {
      let ranges: Range[] = []
      for (const tr of transactions) {
        const local = tr.docChanged && !fromYjs(tr)
        const uiEvent = tr.getMeta("uiEvent")
        const pasted = uiEvent === "paste" || uiEvent === "drop"
        for (const map of tr.mapping.maps) {
          ranges = ranges
            .map((r) => ({ ...r, from: map.map(r.from, 1), to: map.map(r.to, -1) }))
            .filter((r) => r.from < r.to)
          if (local) {
            map.forEach((_oldStart, _oldEnd, from, to) => {
              if (from < to) ranges.push({ from, to, pasted })
            })
          }
        }
      }
      if (ranges.length === 0) return null

      const type = state.schema.marks.author!
      const now = Date.now()
      const tr = state.tr
      for (const { from, to, pasted } of ranges) {
        state.doc.nodesBetween(from, to, (node, pos) => {
          if (!node.isText) return
          const current = type.isInSet(node.marks)
          // Pasted or dropped text keeps its authors (moving or copying Mia's sentence leaves it Mia's).
          if ((pasted && current) || ownRun(current, now)) return

          const start = Math.max(from, pos)
          const end = Math.min(to, pos + node.nodeSize)
          const before = type.isInSet(state.doc.resolve(start).nodeBefore?.marks ?? [])
          const after = type.isInSet(state.doc.resolve(end).nodeAfter?.marks ?? [])
          const run = [before, after].find((m) => ownRun(m, now))
          tr.addMark(start, end, run ?? type.create({ userId, at: now } satisfies AuthorAttrs))
        })
      }
      return tr.steps.length ? tr : null
    },
  })
}

/** Client-only: stamps the signed-in Writer's insertions. Leave `userId` null for Viewers. */
export const AuthorStamp = Extension.create<{ userId: string | null }>({
  name: "authorStamp",

  addOptions() {
    return { userId: null }
  },

  addProseMirrorPlugins() {
    return this.options.userId ? [authorStampPlugin(this.options.userId)] : []
  },
})
