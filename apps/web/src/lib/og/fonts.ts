import { readFile } from "node:fs/promises";
import { join } from "node:path";

type Font = { name: string; data: Buffer; weight: 400 | 600; style: "normal" | "italic" };

// Satori takes ttf/otf/woff but not woff2, so these are static TTF instances checked in beside this file.
const SPECS = [
  { file: "Inter-Regular.ttf", name: "Inter", weight: 400, style: "normal" },
  { file: "Inter-SemiBold.ttf", name: "Inter", weight: 600, style: "normal" },
  { file: "Literata-Italic.ttf", name: "Literata", weight: 400, style: "italic" },
  { file: "Literata-SemiBold.ttf", name: "Literata", weight: 600, style: "normal" },
] as const;

let loaded: Promise<Font[]> | null = null;

export function ogFonts(): Promise<Font[]> {
  loaded ??= Promise.all(
    SPECS.map(async ({ file, ...font }) => ({
      ...font,
      data: await readFile(join(process.cwd(), "src/lib/og/fonts", file)),
    }))
  );
  return loaded;
}
