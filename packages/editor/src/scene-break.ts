import { canInsertNode, InputRule, isNodeSelection, mergeAttributes, Node, nodeInputRule } from "@tiptap/core"
import type { NodeType, ResolvedPos } from "@tiptap/pm/model"
import { NodeSelection, TextSelection } from "@tiptap/pm/state"

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    sceneBreak: {
      insertSceneBreak: () => ReturnType
    }
  }
}

/**
 * The centered `* * *` divider between scenes. Typing `***` or `---` on an empty line inserts one (`—-` too, which is
 * what `---` becomes with Smart punctuation on).
 */
export const SceneBreak = Node.create({
  name: "sceneBreak",
  group: "block",
  atom: true,
  selectable: true,

  parseHTML() {
    return [{ tag: "hr" }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["hr", mergeAttributes(HTMLAttributes, { "data-scene-break": "" })]
  },

  addCommands() {
    return {
      insertSceneBreak:
        () =>
        ({ chain, state }) => {
          if (!canInsertNode(state, this.type) || refusedByList(state.selection.$from, this.type)) return false
          const insert = chain()
          if (isNodeSelection(state.selection)) {
            insert.insertContentAt(state.selection.$to.pos, { type: this.name })
          } else {
            insert.insertContent({ type: this.name })
          }

          // Leave the caret in the block after the break, adding an empty paragraph at the end of the Chapter.
          return insert
            .command(({ tr, dispatch }) => {
              if (!dispatch) return true
              const { $to } = tr.selection
              if ($to.nodeAfter) {
                tr.setSelection(
                  $to.nodeAfter.isTextblock
                    ? TextSelection.create(tr.doc, $to.pos + 1)
                    : NodeSelection.create(tr.doc, $to.pos)
                )
              } else {
                const paragraph = $to.parent.type.contentMatch.defaultType?.create()
                if (paragraph) {
                  tr.insert($to.end(), paragraph)
                  tr.setSelection(TextSelection.create(tr.doc, $to.end() + 1))
                }
              }
              tr.scrollIntoView()
              return true
            })
            .run()
        },
    }
  },

  addInputRules() {
    const rule = nodeInputRule({ find: /^(?:\*\*\*|---|—-)\s$/, type: this.type })
    return [
      new InputRule({
        find: rule.find,
        // Not in a Script line or a Chapter's list item, which would split the Script or list around the break.
        handler: (props) => {
          const $from = props.state.doc.resolve(props.range.from)
          if ($from.parent.type.name === "scriptElement" || refusedByList($from, this.type)) return null
          return rule.handler(props)
        },
      }),
    ]
  },
})

/** In a list item that can't hold a Scene Break (a Chapter's), where inserting one would split the list around it. */
function refusedByList($pos: ResolvedPos, type: NodeType): boolean {
  for (let depth = $pos.depth; depth > 0; depth--) {
    const node = $pos.node(depth)
    if (node.type.name === "listItem") {
      return !node.type.contentMatch.matchType(node.type.schema.nodes.paragraph!)?.matchType(type)
    }
  }
  return false
}
