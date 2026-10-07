import { canInsertNode, isNodeSelection, mergeAttributes, Node, nodeInputRule } from "@tiptap/core"
import { NodeSelection, TextSelection } from "@tiptap/pm/state"

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    sceneBreak: {
      insertSceneBreak: () => ReturnType
    }
  }
}

/** The centered `* * *` divider between scenes. Typing `***` or `---` on an empty line inserts one. */
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
          if (!canInsertNode(state, this.type)) return false
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
    return [nodeInputRule({ find: /^(?:\*\*\*|---)\s$/, type: this.type })]
  },
})
