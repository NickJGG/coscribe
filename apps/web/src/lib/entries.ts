import type { Database } from "@/lib/supabase/database.types";

export type EntryType = Database["public"]["Enums"]["entry_type"];

export const ENTRY_TYPES: EntryType[] = ["character", "place", "item", "lore"];

export const ENTRY_TYPE_LABEL: Record<EntryType, string> = {
  character: "Character",
  place: "Place",
  item: "Item",
  lore: "Lore",
};

/** Headings for the Story Bible's type groups. */
export const ENTRY_GROUP_LABEL: Record<EntryType, string> = {
  character: "Characters",
  place: "Places",
  item: "Items",
  lore: "Lore",
};

export const NAME_MAX = 80;
export const DESCRIPTION_MAX = 280;
export const ALIASES_MAX = 20;

export type EntryFields = { type: EntryType; name: string; description: string };

/** Validates the Entry form. `description` is optional on create, where the form doesn't ask for it. */
export function readEntryFields(formData: FormData): { fields: EntryFields } | { error: string } {
  const type = String(formData.get("type") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!ENTRY_TYPES.includes(type as EntryType)) return { error: "Pick a type." };
  if (!name) return { error: "Give the Entry a name." };
  if (name.length > NAME_MAX) return { error: `Keep names under ${NAME_MAX} characters.` };
  if (description.length > DESCRIPTION_MAX) {
    return { error: `Keep the short description under ${DESCRIPTION_MAX} characters.` };
  }
  return { fields: { type: type as EntryType, name, description } };
}

/** Fields editable in place on the Entry page; any subset may be sent at once. */
export type EntryPatch = Partial<EntryFields & { aliases: string[]; linkEntryMentions: boolean }>;

/** Row columns for an `EntryPatch`, validated. Aliases are tidied, and ones repeating each other are dropped. */
export function readEntryPatch(
  patch: EntryPatch
): { columns: Partial<EntryFields & { aliases: string[]; link_entry_mentions: boolean }> } | { error: string } {
  const columns: Partial<EntryFields & { aliases: string[]; link_entry_mentions: boolean }> = {};
  if (patch.type !== undefined) {
    if (!ENTRY_TYPES.includes(patch.type)) return { error: "Pick a type." };
    columns.type = patch.type;
  }
  if (patch.name !== undefined) {
    const name = String(patch.name).trim();
    if (!name) return { error: "Give the Entry a name." };
    if (name.length > NAME_MAX) return { error: `Keep names under ${NAME_MAX} characters.` };
    columns.name = name;
  }
  if (patch.description !== undefined) {
    const description = String(patch.description).trim();
    if (description.length > DESCRIPTION_MAX) {
      return { error: `Keep the short description under ${DESCRIPTION_MAX} characters.` };
    }
    columns.description = description;
  }
  if (patch.aliases !== undefined) {
    if (!Array.isArray(patch.aliases)) return { error: "Something went wrong. Try again." };
    const seen = new Set<string>();
    const aliases: string[] = [];
    for (const raw of patch.aliases) {
      const alias = String(raw).trim().replace(/\s+/gu, " ");
      if (!alias) continue;
      if (alias.length > NAME_MAX) return { error: `Keep Aliases under ${NAME_MAX} characters.` };
      const key = alias.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      aliases.push(alias);
    }
    if (aliases.length > ALIASES_MAX) return { error: `An Entry can have up to ${ALIASES_MAX} Aliases.` };
    columns.aliases = aliases;
  }
  if (patch.linkEntryMentions !== undefined) columns.link_entry_mentions = patch.linkEntryMentions === true;
  return { columns };
}

/** An Entry as a live document's Entry Mentions and their cards see it. */
export type EntryMentionEntry = {
  id: string;
  type: EntryType;
  name: string;
  description: string;
  aliases: string[];
  linkEntryMentions: boolean;
};

export function entryMentionEntries(
  rows: { id: string; type: EntryType; name: string; description: string; aliases: string[]; link_entry_mentions: boolean }[]
): EntryMentionEntry[] {
  return rows.map(({ link_entry_mentions, ...e }) => ({ ...e, linkEntryMentions: link_entry_mentions }));
}
