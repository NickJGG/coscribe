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

/** The non-empty Entry Type groups in the Story's type order, each keeping its Entries' order. */
export function entryGroups<E extends { type: EntryType }>(
  entries: E[],
  typeOrder: EntryType[]
): { type: EntryType; entries: E[] }[] {
  return typeOrder
    .map((type) => ({ type, entries: entries.filter((e) => e.type === type) }))
    .filter((g) => g.entries.length);
}

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

/** A Character's Voice for narration: the kind of speech voice (null is Any) and its pitch. */
export type EntryVoice = { kind: VoiceKind | null; pitch: VoicePitch };
export type VoiceKind = "feminine" | "masculine";
export type VoicePitch = -1 | 0 | 1;

export const NO_VOICE: EntryVoice = { kind: null, pitch: 0 };

/** Fields editable in place on the Entry page; any subset may be sent at once. */
export type EntryPatch = Partial<EntryFields & { aliases: string[]; linkEntryMentions: boolean; voice: EntryVoice }>;

type EntryColumns = Partial<
  EntryFields & {
    aliases: string[];
    link_entry_mentions: boolean;
    voice_kind: VoiceKind | null;
    voice_pitch: VoicePitch;
  }
>;

/** Row columns for an `EntryPatch`, validated. Aliases are tidied, and ones repeating each other are dropped. */
export function readEntryPatch(patch: EntryPatch): { columns: EntryColumns } | { error: string } {
  const columns: EntryColumns = {};
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
  if (patch.voice !== undefined) {
    const voice: Partial<EntryVoice> | null = patch.voice;
    const kind = voice?.kind;
    const pitch = voice?.pitch;
    if ((kind !== null && kind !== "feminine" && kind !== "masculine") || (pitch !== -1 && pitch !== 0 && pitch !== 1)) {
      return { error: "Something went wrong. Try again." };
    }
    columns.voice_kind = kind;
    columns.voice_pitch = pitch;
  }
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
  voice: EntryVoice;
};

export function entryMentionEntries(
  rows: {
    id: string;
    type: EntryType;
    name: string;
    description: string;
    aliases: string[];
    link_entry_mentions: boolean;
    voice_kind: string | null;
    voice_pitch: number;
  }[]
): EntryMentionEntry[] {
  return rows.map(({ link_entry_mentions, voice_kind, voice_pitch, ...e }) => ({
    ...e,
    linkEntryMentions: link_entry_mentions,
    voice: {
      kind: voice_kind === "feminine" || voice_kind === "masculine" ? voice_kind : null,
      pitch: voice_pitch === -1 || voice_pitch === 1 ? voice_pitch : 0,
    },
  }));
}
