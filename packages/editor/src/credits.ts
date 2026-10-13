/** The slice of ProseMirror JSON that Credits reads. */
export type ContentJSON = {
  type?: string
  text?: string
  attrs?: Record<string, unknown> | null
  marks?: { type: string; attrs?: Record<string, unknown> | null }[]
  content?: ContentJSON[]
}

/**
 * Characters per `author` mark `userId`, summed into `into`. Text with no author mark (written before
 * marks existed) isn't credited to anyone.
 */
export function countAuthorCharacters(node: ContentJSON, into: Map<string, number> = new Map()): Map<string, number> {
  if (node.text) {
    const userId = node.marks?.find((m) => m.type === "author")?.attrs?.userId
    if (typeof userId === "string") into.set(userId, (into.get(userId) ?? 0) + [...node.text].length)
  }
  for (const child of node.content ?? []) countAuthorCharacters(child, into)
  return into
}
