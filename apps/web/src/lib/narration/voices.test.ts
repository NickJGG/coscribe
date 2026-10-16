import { describe, expect, it } from "vitest";
import { castVoices, PITCH, sortVoices, voiceKind } from "./voices";

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

describe("voiceKind", () => {
  it("reads the kind from known voice names and leaves the rest unknown", () => {
    const kind = (name: string) => voiceKind({ name, lang: "en-US" });
    expect(kind("Microsoft Aria Online (Natural) - English (United States)")).toBe("feminine");
    expect(kind("Microsoft AndrewMultilingual Online (Natural) - English (United States)")).toBe("masculine");
    expect(kind("Microsoft David - English (United States)")).toBe("masculine");
    expect(kind("Google UK English Female")).toBe("feminine");
    expect(kind("Google UK English Male")).toBe("masculine");
    expect(kind("Daniel (Enhanced)")).toBe("masculine");
    expect(kind("Samantha")).toBe("feminine");
    expect(kind("en-us-x-sfg-local")).toBeNull();
  });
});

describe("castVoices", () => {
  const v = (name: string, lang = "en-US") => ({ name, lang });
  const narrator = v("Microsoft Aria Online (Natural)");
  const voices = [
    narrator,
    v("Microsoft Guy Online (Natural)"),
    v("Microsoft Jenny Online (Natural)"),
    v("Microsoft David"),
    v("Microsoft Zira"),
    v("en-us-x-sfg-local"),
    v("Microsoft Katja Online (Natural)", "de-DE"),
  ];
  const names = (cast: ReturnType<typeof castVoices>) => Object.fromEntries([...cast].map(([k, c]) => [k, c.voice?.name]));

  it("gives each speaker a distinct voice in the narrator's language, never the narrator's", () => {
    const speakers = ["entry:a", "entry:b", "entry:c", "entry:d", "cue:BOB"];
    const cast = castVoices({ speakers, voices, narrator });
    const picked = [...cast.values()].map((c) => c.voice?.name);
    expect(new Set(picked).size).toBe(5);
    expect(picked).not.toContain(narrator.name);
    expect(picked).not.toContain("Microsoft Katja Online (Natural)");
    expect([...cast.values()].every((c) => c.pitch === 1)).toBe(true);
  });

  it("is stable per speaker, whoever else is in the Chapter", () => {
    const alone = castVoices({ speakers: ["entry:a"], voices, narrator });
    const withB = castVoices({ speakers: ["entry:a", "entry:b"], voices, narrator });
    expect(withB.get("entry:a")).toEqual(alone.get("entry:a"));
    expect(castVoices({ speakers: ["entry:a"], voices, narrator })).toEqual(alone);
  });

  it("prefers natural-sounding voices", () => {
    const cast = castVoices({ speakers: ["entry:a", "entry:b"], voices, narrator });
    expect(Object.values(names(cast)).sort()).toEqual(["Microsoft Guy Online (Natural)", "Microsoft Jenny Online (Natural)"]);
  });

  it("matches the cast kind, and applies the cast pitch", () => {
    const cast = castVoices({
      speakers: ["entry:a", "entry:b", "entry:c"],
      voices,
      narrator,
      cast: {
        "entry:a": { kind: "masculine", pitch: -1 },
        "entry:b": { kind: "masculine", pitch: 0 },
        "entry:c": { kind: "feminine", pitch: 1 },
      },
    });
    expect(cast.get("entry:a")?.pitch).toBe(PITCH[-1]);
    expect(cast.get("entry:c")?.pitch).toBe(PITCH[1]);
    expect(Object.values(names(cast)).sort()).toEqual([
      "Microsoft David",
      "Microsoft Guy Online (Natural)",
      "Microsoft Jenny Online (Natural)",
    ]);
    expect(names(cast)["entry:c"]).toBe("Microsoft Jenny Online (Natural)");
  });

  it("lets an override win and keeps automatic voices off it", () => {
    const cast = castVoices({
      speakers: ["entry:a", "entry:b"],
      voices: [narrator, v("Microsoft Guy Online (Natural)"), v("Microsoft David")],
      narrator,
      overrides: { "entry:a": "Microsoft Guy Online (Natural)" },
    });
    expect(names(cast)).toEqual({ "entry:a": "Microsoft Guy Online (Natural)", "entry:b": "Microsoft David" });
  });

  it("shares voices at a shifted pitch once they run out, and uses the narrator's only that way", () => {
    const two = castVoices({ speakers: ["entry:a", "entry:b"], voices: [narrator, v("Microsoft David")], narrator });
    expect([...two.values()].map((c) => c.voice?.name)).toEqual(["Microsoft David", "Microsoft David"]);
    expect(new Set([...two.values()].map((c) => c.pitch)).size).toBe(2);

    const alone = castVoices({ speakers: ["entry:a"], voices: [narrator], narrator });
    expect(alone.get("entry:a")?.voice).toBe(narrator);
    expect(alone.get("entry:a")?.pitch).not.toBe(1);
  });
});
