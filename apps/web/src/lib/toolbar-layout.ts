/**
 * The order of the desk's Formatting toolbar: groups move as blocks, and tools reorder only within their group.
 * A saved order is merged with the current tool set, so new tools and groups appear at the end and unknown ids drop.
 */

export const TOOLBAR_GROUPS = [
  ["inline", ["bold", "italic", "strike"]],
  ["block", ["sceneBreak", "blockquote", "script", "align"]],
  ["lists", ["bulletList", "orderedList"]],
  ["note", ["addNote"]],
] as const;

type Groups = typeof TOOLBAR_GROUPS;
export type GroupId = Groups[number][0];
export type ToolId = Groups[number][1][number];
export type ToolbarLayout = [GroupId, ToolId[]][];

const DEFAULT_TOOLS = new Map<string, readonly string[]>(TOOLBAR_GROUPS);

export const DEFAULT_TOOLBAR_LAYOUT: ToolbarLayout = TOOLBAR_GROUPS.map(([group, tools]) => [group, [...tools]]);

export function resolveToolbarLayout(saved: unknown): ToolbarLayout {
  const savedTools = new Map<GroupId, unknown[]>();
  if (Array.isArray(saved)) {
    for (const entry of saved) {
      if (!Array.isArray(entry) || !DEFAULT_TOOLS.has(entry[0]) || savedTools.has(entry[0])) continue;
      savedTools.set(entry[0], Array.isArray(entry[1]) ? entry[1] : []);
    }
  }

  const groups: GroupId[] = [...savedTools.keys()];
  for (const [group] of TOOLBAR_GROUPS) if (!savedTools.has(group)) groups.push(group);

  return groups.map((group) => {
    const known = DEFAULT_TOOLS.get(group)!;
    const tools = new Set((savedTools.get(group) ?? []).filter((tool) => known.includes(tool as string)) as ToolId[]);
    for (const tool of known) tools.add(tool as ToolId);
    return [group, [...tools]];
  });
}

export function isDefaultLayout(layout: ToolbarLayout): boolean {
  return sameLayout(layout, DEFAULT_TOOLBAR_LAYOUT);
}

export function sameLayout(a: ToolbarLayout, b: ToolbarLayout): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
