import { describe, expect, it } from "vitest";
import { toEditableText, toStoredBody, typedMentionAt, writerMentionIds, writerMentionParts } from "./writer-mentions";

const THEO = "2a6f97aa-0000-4000-8000-000000000001";
const MAYA = "2a6f97aa-0000-4000-8000-000000000002";
const members = [
  { id: THEO, name: "theo" },
  { id: MAYA, name: "maya_k" },
];
const names = new Map(members.map((m) => [m.id, m.name]));
const nameOf = (id: string) => names.get(id) ?? "someone";

describe("toStoredBody", () => {
  it("turns members' usernames into tokens, next to punctuation too", () => {
    expect(toStoredBody("@theo, does this work? cc @maya_k.", members)).toBe(`@[${THEO}], does this work? cc @[${MAYA}].`);
  });

  it("leaves non-members, emails and partial names as typed", () => {
    expect(toStoredBody("@sam and theo@example.com and @theodore", members)).toBe(
      "@sam and theo@example.com and @theodore"
    );
  });

  it("ignores case", () => {
    expect(toStoredBody("@Theo", members)).toBe(`@[${THEO}]`);
  });
});

describe("toEditableText", () => {
  it("round-trips with toStoredBody", () => {
    const text = "@theo, ask @maya_k (and @sam)";
    expect(toEditableText(toStoredBody(text, members), nameOf)).toBe(text);
  });
});

describe("writerMentionIds", () => {
  it("lists each Writer once", () => {
    expect(writerMentionIds(`@[${THEO}] @[${MAYA}] @[${THEO.toUpperCase()}]`)).toEqual([THEO, MAYA]);
  });

  it("ignores things that only look like tokens", () => {
    expect(writerMentionIds("@[not-a-uuid] @[------------------------------------]")).toEqual([]);
  });
});

describe("writerMentionParts", () => {
  it("splits text around tokens", () => {
    expect(writerMentionParts(`hi @[${THEO}]!`)).toEqual([{ text: "hi " }, { writerId: THEO }, { text: "!" }]);
    expect(writerMentionParts(`@[${THEO}]`)).toEqual([{ writerId: THEO }]);
    expect(writerMentionParts("plain")).toEqual([{ text: "plain" }]);
  });
});

describe("typedMentionAt", () => {
  it("finds the @query before the caret", () => {
    expect(typedMentionAt("hey @th", 7)).toEqual({ start: 4, query: "th" });
    expect(typedMentionAt("@", 1)).toEqual({ start: 0, query: "" });
    expect(typedMentionAt("hey @th more", 7)).toEqual({ start: 4, query: "th" });
  });

  it("ignores emails and finished words", () => {
    expect(typedMentionAt("theo@ex", 7)).toBeNull();
    expect(typedMentionAt("@theo ", 6)).toBeNull();
  });
});
