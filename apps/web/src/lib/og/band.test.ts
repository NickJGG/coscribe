import { describe, expect, it } from "vitest";
import { bandSegments, FORMER_WRITER_COLOR } from "./band";

describe("bandSegments", () => {
  it("splits by surviving characters, in the ribbon's order", () => {
    const band = bandSegments(
      [
        { id: "h", name: "nick", color: "#d93f4c", chars: 40 },
        { id: "a", name: "maya", color: "#3e63dd", chars: 10 },
      ],
      ["#d93f4c", "#3e63dd", "#12a594"]
    );
    expect(band).toEqual([
      { color: "#d93f4c", grow: 40 },
      { color: "#3e63dd", grow: 10 },
    ]);
  });

  it("greys out former Writers", () => {
    const band = bandSegments([{ id: "x", name: "juno", color: null, chars: 5 }], []);
    expect(band).toEqual([{ color: FORMER_WRITER_COLOR, grow: 5 }]);
  });

  it("skips Writers with no surviving text", () => {
    const band = bandSegments(
      [
        { id: "h", name: "nick", color: "#d93f4c", chars: 0 },
        { id: "a", name: "maya", color: "#3e63dd", chars: 3 },
      ],
      ["#d93f4c", "#3e63dd"]
    );
    expect(band).toEqual([{ color: "#3e63dd", grow: 3 }]);
  });

  it("splits evenly across the members' colors before anyone has written", () => {
    expect(bandSegments([], ["#d93f4c", "#3e63dd"])).toEqual([
      { color: "#d93f4c", grow: 1 },
      { color: "#3e63dd", grow: 1 },
    ]);
  });
});
