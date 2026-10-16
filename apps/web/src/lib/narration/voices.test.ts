import { describe, expect, it } from "vitest";
import { sortVoices } from "./voices";

describe("sortVoices", () => {
  it("puts English first, natural-sounding voices first within each group", () => {
    const voices = [
      { name: "Google Deutsch", lang: "de-DE" },
      { name: "Microsoft Zira", lang: "en-US" },
      { name: "Microsoft Katja Online (Natural)", lang: "de-DE" },
      { name: "Microsoft Aria Online (Natural)", lang: "en-US" },
      { name: "Daniel", lang: "en-GB" },
      { name: "Ava (Enhanced)", lang: "en-US" },
    ];
    expect(sortVoices(voices).map((v) => v.name)).toEqual([
      "Ava (Enhanced)",
      "Microsoft Aria Online (Natural)",
      "Daniel",
      "Microsoft Zira",
      "Microsoft Katja Online (Natural)",
      "Google Deutsch",
    ]);
  });
});
