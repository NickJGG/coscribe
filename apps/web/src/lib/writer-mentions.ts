/**
 * Writer Mentions in Notes, replies and Story Chat. Bodies store each as `@[<profile id>]`; people only
 * ever type and read `@username`, so tokens exist only in storage.
 */

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

export const WRITER_MENTION = new RegExp(`@\\[(${UUID})\\]`, "gi");

/** `@username` as typed, not inside a word or an email address. */
const TYPED_MENTION = /(?<![\w@])@([a-z0-9_]{3,20})(?!\w)/gi;

export type WriterMentionPart = { text: string } | { writerId: string };

export function writerMentionIds(body: string): string[] {
  return [...new Set([...body.matchAll(WRITER_MENTION)].map((m) => m[1]!.toLowerCase()))];
}

export function writerMentionParts(body: string): WriterMentionPart[] {
  const parts: WriterMentionPart[] = [];
  let at = 0;
  for (const m of body.matchAll(WRITER_MENTION)) {
    if (m.index > at) parts.push({ text: body.slice(at, m.index) });
    parts.push({ writerId: m[1]!.toLowerCase() });
    at = m.index + m[0].length;
  }
  if (at < body.length) parts.push({ text: body.slice(at) });
  return parts;
}

/** Each typed `@username` of a current member becomes their token; anything else stays as typed. */
export function toStoredBody(text: string, members: { id: string; name: string }[]): string {
  const byName = new Map(members.map((m) => [m.name.toLowerCase(), m.id]));
  return text.replace(TYPED_MENTION, (typed, name: string) => {
    const id = byName.get(name.toLowerCase());
    return id ? `@[${id}]` : typed;
  });
}

/** The reverse of toStoredBody, to seed an edit box. */
export function toEditableText(body: string, nameOf: (id: string) => string): string {
  return body.replace(WRITER_MENTION, (_, id: string) => `@${nameOf(id.toLowerCase())}`);
}

/** The `@query` being typed just before the caret, if any. */
export function typedMentionAt(text: string, caret: number): { start: number; query: string } | null {
  const m = /(?<![\w@])@([a-z0-9_]{0,20})$/i.exec(text.slice(0, caret));
  return m ? { start: m.index, query: m[1]! } : null;
}
