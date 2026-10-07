import type { Database } from "@/lib/supabase/database.types";

export type EntryType = Database["public"]["Enums"]["entry_type"];

export const ENTRY_TYPES: EntryType[] = ["character", "place", "item", "lore"];

export const ENTRY_TYPE_LABEL: Record<EntryType, string> = {
  character: "Character",
  place: "Place",
  item: "Item",
  lore: "Lore",
};

export const NAME_MAX = 80;
export const DESCRIPTION_MAX = 280;

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

type Listed = { type: EntryType; name: string };

/** Entries of `type` (all when null) whose name contains every word of `query`, ignoring case and accents. */
export function filterEntries<T extends Listed>(entries: T[], query: string, type: EntryType | null): T[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  return entries.filter((e) => {
    if (type && e.type !== type) return false;
    const name = fold(e.name);
    return words.every((w) => name.includes(w));
  });
}

function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}
