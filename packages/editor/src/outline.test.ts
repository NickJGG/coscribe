import { describe, expect, it } from "vitest"
import * as Y from "yjs"
import {
  addCharacter,
  addedFields,
  addField,
  discardField,
  fieldFragment,
  OUTLINE_FIELDS,
  outlineCharacters,
  outlineHasContent,
  removeCharacter,
  removeField,
  renameField,
  restoreField,
} from "./outline"

function write(doc: Y.Doc, id: string, text: string) {
  const paragraph = new Y.XmlElement("paragraph")
  paragraph.insert(0, [new Y.XmlText(text)])
  doc.getXmlFragment(fieldFragment(id)).push([paragraph])
}

describe("added fields", () => {
  it("appends fields in order", () => {
    const doc = new Y.Doc()
    const a = addField(doc, "Weather")
    const b = addField(doc, "Timeline")
    expect(a).not.toBe(b)
    expect(addedFields(doc)).toEqual([
      { id: a, label: "Weather" },
      { id: b, label: "Timeline" },
    ])
  })

  it("restores a removed field in place, text and all", () => {
    const doc = new Y.Doc()
    const ids = ["One", "Two", "Three"].map((label) => addField(doc, label))
    write(doc, ids[1]!, "kept")
    const removed = removeField(doc, ids[1]!)
    expect(removed).toEqual({ field: { id: ids[1], label: "Two" }, index: 1 })
    expect(addedFields(doc).map((f) => f.label)).toEqual(["One", "Three"])

    restoreField(doc, removed!)
    expect(addedFields(doc).map((f) => f.label)).toEqual(["One", "Two", "Three"])
    expect(doc.getXmlFragment(fieldFragment(ids[1]!)).toString()).toContain("kept")
  })

  it("clamps the restore index when fields were removed meanwhile", () => {
    const doc = new Y.Doc()
    const [a, b] = ["One", "Two"].map((label) => addField(doc, label))
    const removed = removeField(doc, b!)!
    removeField(doc, a!)
    restoreField(doc, removed)
    expect(addedFields(doc)).toEqual([{ id: b, label: "Two" }])
  })

  it("doesn't restore a field twice", () => {
    const doc = new Y.Doc()
    const removed = removeField(doc, addField(doc, "One"))!
    restoreField(doc, removed)
    restoreField(doc, removed)
    expect(addedFields(doc)).toHaveLength(1)
  })

  it("renames a field, keeping its place", () => {
    const doc = new Y.Doc()
    const [a, b] = ["One", "Two"].map((label) => addField(doc, label))
    renameField(doc, a!, "Weather")
    renameField(doc, "missing", "Nothing")
    expect(addedFields(doc)).toEqual([
      { id: a, label: "Weather" },
      { id: b, label: "Two" },
    ])
  })

  it("returns null removing a field that isn't there", () => {
    expect(removeField(new Y.Doc(), "missing")).toBeNull()
  })

  it("discards a removed field's text, but not a restored one's", () => {
    const doc = new Y.Doc()
    const id = addField(doc, "One")
    write(doc, id, "text")
    const removed = removeField(doc, id)!
    restoreField(doc, removed)
    discardField(doc, id)
    expect(doc.getXmlFragment(fieldFragment(id)).length).toBe(1)

    removeField(doc, id)
    discardField(doc, id)
    expect(doc.getXmlFragment(fieldFragment(id)).length).toBe(0)
  })
})

describe("characters", () => {
  it("adds each Character once", () => {
    const doc = new Y.Doc()
    addCharacter(doc, "a")
    addCharacter(doc, "b")
    addCharacter(doc, "a")
    expect(outlineCharacters(doc)).toEqual(["a", "b"])
  })

  it("removes every copy of a Character added twice at once", () => {
    const doc = new Y.Doc()
    doc.getArray<string>("characters").push(["a", "b", "a"])
    removeCharacter(doc, "a")
    expect(outlineCharacters(doc)).toEqual(["b"])
  })
})

describe("outlineHasContent", () => {
  it("is false for a new Outline, or one with only empty paragraphs", () => {
    const doc = new Y.Doc()
    expect(outlineHasContent(doc)).toBe(false)
    doc.getXmlFragment(fieldFragment("summary")).push([new Y.XmlElement("paragraph")])
    addField(doc, "Empty")
    expect(outlineHasContent(doc)).toBe(false)
  })

  it("is true once a default field has text", () => {
    const doc = new Y.Doc()
    write(doc, OUTLINE_FIELDS[2]!.id, "x")
    expect(outlineHasContent(doc)).toBe(true)
  })

  it("counts added fields, but not removed ones", () => {
    const doc = new Y.Doc()
    const id = addField(doc, "Extra")
    write(doc, id, "x")
    expect(outlineHasContent(doc)).toBe(true)
    removeField(doc, id)
    expect(outlineHasContent(doc)).toBe(false)
  })

  it("is true with a Character and no text", () => {
    const doc = new Y.Doc()
    doc.getArray<string>("characters").push(["entry-id"])
    expect(outlineHasContent(doc)).toBe(true)
  })
})
