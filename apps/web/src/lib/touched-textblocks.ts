import type { Transaction } from "@tiptap/pm/state";

/** The positions, in the new doc, of every textblock a transaction's steps changed. */
export function touchedTextblocks(tr: Transaction): Set<number> {
  const size = tr.doc.content.size;
  const touched = new Set<number>();
  tr.mapping.maps.forEach((map, i) => {
    const rest = tr.mapping.slice(i + 1);
    map.forEach((_oldFrom, _oldTo, from, to) => {
      const start = Math.min(rest.map(from, -1), size);
      const end = Math.min(Math.max(rest.map(to, 1), start + 1), size);
      tr.doc.nodesBetween(start, end, (node, pos) => {
        if (!node.isTextblock) return true;
        touched.add(pos);
        return false;
      });
    });
  });
  return touched;
}
