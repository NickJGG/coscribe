import { describe, expect, it } from "vitest"
import { prosemirrorJSONToYXmlFragment } from "@tiptap/y-tiptap"
import * as Y from "yjs"
import { chapterSchema, DOCUMENT_FIELD, entrySchema } from "@coscribe/editor"
import { chapterContent, chapterStats, contentHash, decodeChapter, replaceChapterContent } from "./chapter-content"

const mia = { userId: "mia", at: 1 }
const jordan = { userId: "jordan", at: 2 }

function para(...runs: [string, typeof mia][]) {
  return {
    type: "paragraph",
    content: runs.map(([text, author]) => ({ type: "text", text, marks: [{ type: "author", attrs: author }] })),
  }
}

function chapterDoc(...paragraphs: ReturnType<typeof para>[]): Y.Doc {
  const doc = new Y.Doc()
  prosemirrorJSONToYXmlFragment(chapterSchema, { type: "doc", content: paragraphs }, doc.getXmlFragment(DOCUMENT_FIELD))
  return doc
}

describe("chapter content", () => {
  it("round-trips through Snapshot bytes with author marks intact", () => {
    const doc = chapterDoc(para(["Once upon a time ", mia], ["there was", jordan]))
    const restored = decodeChapter(Y.encodeStateAsUpdate(doc))
    expect(restored.toJSON()).toEqual(chapterContent(doc).toJSON())
    expect(restored.firstChild!.child(1).marks[0]!.attrs).toEqual(jordan)
  })

  it("decodes Entry bodies with the Entry schema, lists included", () => {
    const doc = new Y.Doc()
    const body = {
      type: "doc",
      content: [{ type: "bulletList", content: [{ type: "listItem", content: [para(["A sword", mia])] }] }],
    }
    prosemirrorJSONToYXmlFragment(entrySchema, body, doc.getXmlFragment(DOCUMENT_FIELD))
    expect(decodeChapter(Y.encodeStateAsUpdate(doc), "entry").toJSON()).toEqual(body)
  })

  it("hashes equal content equally, and tells authors apart", () => {
    const a = chapterDoc(para(["Same words.", mia]))
    const b = chapterDoc(para(["Same words.", mia]))
    const c = chapterDoc(para(["Same words.", jordan]))
    expect(contentHash(chapterContent(a))).toBe(contentHash(chapterContent(b)))
    expect(contentHash(chapterContent(a))).not.toBe(contentHash(chapterContent(c)))
  })

  it("restores as a diff that a connected client merges, keeping the original authors", () => {
    const snapshot = chapterContent(chapterDoc(para(["Kept.", mia]), para(["Deleted by Jordan.", mia])))
    const live = chapterDoc(para(["Kept.", mia]), para(["Written later.", jordan]))
    const client = new Y.Doc()
    Y.applyUpdate(client, Y.encodeStateAsUpdate(live))
    live.on("update", (update: Uint8Array) => Y.applyUpdate(client, update))

    const keptParagraph = live.getXmlFragment(DOCUMENT_FIELD).get(0)
    replaceChapterContent(live, snapshot)

    expect(chapterContent(live).toJSON()).toEqual(snapshot.toJSON())
    expect(chapterContent(client).toJSON()).toEqual(snapshot.toJSON())
    expect(live.getXmlFragment(DOCUMENT_FIELD).get(0)).toBe(keptParagraph)
  })
})

describe("chapterStats", () => {
  it("counts words across paragraphs and characters per author", () => {
    const doc = chapterDoc(para(["Once upon ", mia], ["a time", jordan]), para(["The end.", mia]))
    expect(chapterStats(chapterContent(doc))).toEqual({ words: 6, authorChars: { mia: 18, jordan: 6 } })
  })

  it("doesn't join words across a paragraph break", () => {
    const doc = chapterDoc(para(["end", mia]), para(["start", mia]))
    expect(chapterStats(chapterContent(doc)).words).toBe(2)
  })

  it("is empty for an empty Chapter", () => {
    expect(chapterStats(chapterContent(new Y.Doc()))).toEqual({ words: 0, authorChars: {} })
  })
})
