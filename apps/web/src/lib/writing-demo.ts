/**
 * The front page's scripted demos. A script is data: each Writer runs a track of steps in parallel, one unit a
 * tick, and `buildFrames` precomputes every frame of one loop, so a component only indexes `frames[tick % length]`.
 *
 * Steps: a string types one character a tick · {wait} · {del} deletes back one a tick · {at} moves the caret ·
 * {enter} splits the paragraph · {show} shows or hides the caret · {into, text} types into a UI field a character a
 * tick · {mark} sets a prop on the first match · {clear} removes it everywhere · {flag} sets a UI flag.
 */
export type WriterId = "maya" | "theo" | "juno";

/** A character, its author, and whether it sits in a Note's passage (`h`) or an Entry Mention (`m`). */
export type DemoChar = { c: string; a: WriterId; h?: true; m?: true };
export type DemoCaret = { p: number; o: number; visible: boolean };

export type Frame = {
  paras: DemoChar[][];
  carets: Partial<Record<WriterId, DemoCaret>>;
  fields: Record<string, string>;
  flags: Record<string, boolean>;
  fading?: true;
};

type Mark = "h" | "m";
type At = [p: number, find: string, side: "before" | "after"] | [p: number, "end"];

export type Step =
  | string
  | { wait: number }
  | { del: number }
  | { at: At }
  | { enter: true }
  | { show: boolean }
  | { into: string; text: string }
  | { mark: { p: number; find: string; prop: Mark } }
  | { clear: Mark }
  | { flag: string; value: boolean };

export type DemoScript = {
  paras: [WriterId, string][][];
  carets: Partial<Record<WriterId, [p: number, o: number | "end", visible?: boolean]>>;
  tracks: Partial<Record<WriterId, Step[]>>;
  /** "rewind" runs every edit backwards, two states a frame; "fade" fades the last frames out. */
  loop: "rewind" | "fade";
  /** The frame shown under reduced motion. */
  still: number;
};

export type Demo = { frames: Frame[]; still: number };

const FADE_FRAMES = 6;

type Track = { who: WriterId; steps: Step[]; i: number; sub: number };

/** Applies edits to a Frame in place. */
class Doc {
  constructor(public f: Frame) {}

  private text(p: number) {
    return this.f.paras[p].map((x) => x.c).join("");
  }

  private find(p: number, find: string) {
    const i = this.f.paras[p] ? this.text(p).indexOf(find) : -1;
    if (i < 0) throw new Error(`Demo script: "${find}" isn't in paragraph ${p}`);
    return i;
  }

  private others(who: WriterId) {
    return Object.entries(this.f.carets).filter(([w]) => w !== who).map(([, k]) => k);
  }

  insert(who: WriterId, c: string) {
    const k = this.f.carets[who]!;
    const para = this.f.paras[k.p];
    const ch: DemoChar = { c, a: who };
    if (para[k.o - 1]?.h || para[k.o]?.h) ch.h = true;
    para.splice(k.o, 0, ch);
    for (const o of this.others(who)) if (o.p === k.p && o.o > k.o) o.o++;
    k.o++;
  }

  del(who: WriterId) {
    const k = this.f.carets[who]!;
    if (k.o === 0) return;
    this.f.paras[k.p].splice(k.o - 1, 1);
    for (const o of this.others(who)) if (o.p === k.p && o.o >= k.o) o.o--;
    k.o--;
  }

  enter(who: WriterId) {
    const k = this.f.carets[who]!;
    const rest = this.f.paras[k.p].splice(k.o);
    this.f.paras.splice(k.p + 1, 0, rest);
    for (const o of this.others(who)) {
      if (o.p === k.p && o.o >= k.o) {
        o.p++;
        o.o -= k.o;
      } else if (o.p > k.p) o.p++;
    }
    k.p++;
    k.o = 0;
  }

  moveTo(who: WriterId, at: At) {
    const k = this.f.carets[who]!;
    if (at.length === 2) {
      const [p] = at;
      if (!this.f.paras[p]) throw new Error(`Demo script: there's no paragraph ${p}`);
      k.p = p;
      k.o = this.f.paras[p].length;
      return;
    }
    const [p, find, side] = at;
    const i = this.find(p, find);
    k.p = p;
    k.o = side === "before" ? i : i + find.length;
  }

  mark(p: number, find: string, prop: Mark) {
    const i = this.find(p, find);
    for (let n = i; n < i + find.length; n++) this.f.paras[p][n][prop] = true;
  }

  clear(prop: Mark) {
    for (const para of this.f.paras) for (const ch of para) delete ch[prop];
  }
}

function stepTrack(doc: Doc, tr: Track) {
  while (tr.i < tr.steps.length) {
    const st = tr.steps[tr.i];
    const advance = (n: number) => {
      if (++tr.sub >= n) {
        tr.i++;
        tr.sub = 0;
      }
    };
    if (typeof st === "string") {
      doc.insert(tr.who, st[tr.sub]);
      return advance(st.length);
    }
    if ("wait" in st) return advance(st.wait);
    if ("del" in st) {
      doc.del(tr.who);
      return advance(st.del);
    }
    if ("into" in st) {
      doc.f.fields[st.into] = (doc.f.fields[st.into] ?? "") + st.text[tr.sub];
      return advance(st.text.length);
    }
    if ("at" in st) doc.moveTo(tr.who, st.at);
    else if ("enter" in st) doc.enter(tr.who);
    else if ("show" in st) doc.f.carets[tr.who]!.visible = st.show;
    else if ("mark" in st) doc.mark(st.mark.p, st.mark.find, st.mark.prop);
    else if ("clear" in st) doc.clear(st.clear);
    else doc.f.flags[st.flag] = st.value;
    tr.i++;
  }
}

function copy(f: Frame): Frame {
  return {
    paras: f.paras.map((p) => p.map((ch) => ({ ...ch }))),
    carets: Object.fromEntries(Object.entries(f.carets).map(([w, k]) => [w, { ...k }])),
    fields: { ...f.fields },
    flags: { ...f.flags },
  };
}

function initial(script: DemoScript): Frame {
  const paras = script.paras.map((p) => p.flatMap(([a, t]) => [...t].map((c): DemoChar => ({ c, a }))));
  const carets: Frame["carets"] = {};
  for (const [who, [p, o, visible]] of Object.entries(script.carets) as [WriterId, [number, number | "end", boolean?]][]) {
    carets[who] = { p, o: o === "end" ? paras[p].length : o, visible: visible !== false };
  }
  return { paras, carets, fields: {}, flags: {} };
}

/** Every frame of one loop. Throws if a step targets text that isn't there. */
export function buildFrames(script: DemoScript): Demo {
  const doc = new Doc(initial(script));
  const tracks: Track[] = (Object.entries(script.tracks) as [WriterId, Step[]][]).map(([who, steps]) => ({
    who,
    steps,
    i: 0,
    sub: 0,
  }));
  const frames = [copy(doc.f)];
  while (tracks.some((t) => t.i < t.steps.length)) {
    for (const t of tracks) stepTrack(doc, t);
    frames.push(copy(doc.f));
  }

  if (script.loop === "fade") {
    for (const f of frames.slice(-FADE_FRAMES)) f.fading = true;
    return { frames, still: script.still };
  }

  const states = frames.filter((f, i) => i === 0 || JSON.stringify(f) !== JSON.stringify(frames[i - 1]));
  for (let i = states.length - 3; i > 0; i -= 2) frames.push(states[i]);
  frames.push(frames[0]);
  return { frames, still: script.still };
}

/** maya and theo type at once; theo slips "tarred " into maya's sentence while she's still finishing it. */
export const TOGETHER: DemoScript = {
  paras: [[["maya", "The bells began at a quarter past two"]], [["theo", "Eleven. There were only ever ten"]]],
  carets: { maya: [0, "end"], theo: [1, "end"] },
  tracks: {
    maya: [
      { wait: 3 },
      ", when the sea had pulled back so far that Wren could see the old pi",
      { wait: 4 },
      "lings.",
      { wait: 16 },
      { at: [1, "end"] },
      { enter: true },
      { wait: 6 },
      "Nobody had painted the eleventh.",
      { wait: 50 },
    ],
    theo: [
      { wait: 4 },
      " bells on the spit, and Wren had painted every one of them.",
      { wait: 6 },
      { at: [0, "the old ", "after"] },
      { wait: 2 },
      "tarred ",
      { wait: 30 },
    ],
  },
  loop: "rewind",
  still: 140,
};

/** theo pins a Note to a passage, maya replies, fixes it and Resolves it. */
export const NOTES: DemoScript = {
  paras: [[["maya", "Eleven bells hung from the jetty, one for every boat the spit had lost."]]],
  carets: { maya: [0, "end"], theo: [0, 0, false] },
  tracks: {
    theo: [
      { wait: 10 },
      { show: true },
      { at: [0, "Eleven bells", "after"] },
      { wait: 4 },
      { mark: { p: 0, find: "Eleven bells", prop: "h" } },
      { flag: "noteOpen", value: true },
      { show: false },
      { wait: 3 },
      { into: "nt", text: "Wasn't it ten in Chapter 1?" },
      { wait: 60 },
    ],
    maya: [
      { wait: 48 },
      { flag: "replyOpen", value: true },
      { into: "nr", text: "It was. Fixing it." },
      { wait: 6 },
      { at: [0, "Eleven", "after"] },
      { del: 6 },
      "Ten",
      { wait: 8 },
      { flag: "resolveShown", value: true },
      { wait: 14 },
      { flag: "resolved", value: true },
      { clear: "h" },
      { wait: 30 },
    ],
  },
  loop: "fade",
  still: 80,
};

/** Show authors turns on, and juno types on in her Author Color. */
export const AUTHORS: DemoScript = {
  paras: [
    [
      ["maya", "The keeper’s wife kept the lamp lit through every storm that winter. "],
      ["theo", "She never once asked who it was for."],
    ],
    [["juno", "When the boats came home, they came home to her light."]],
  ],
  carets: { juno: [1, "end", false] },
  tracks: {
    juno: [
      { wait: 18 },
      { flag: "showAuthors", value: true },
      { wait: 18 },
      { show: true },
      " Not one of them knew her name.",
      { wait: 30 },
      { show: false },
      { flag: "showAuthors", value: false },
      { wait: 22 },
    ],
  },
  loop: "fade",
  still: 70,
};

/** theo types an Alias, it becomes an Entry Mention, and its Entry card opens under it. */
export const BIBLE: DemoScript = {
  paras: [[["maya", "By midnight the whole spit was awake."]]],
  carets: { theo: [0, "end"] },
  tracks: {
    theo: [
      { wait: 8 },
      " Old Aldous",
      { mark: { p: 0, find: "Aldous", prop: "m" } },
      " rang the first bell himself.",
      { wait: 8 },
      { flag: "entryCard", value: true },
      { wait: 55 },
      { flag: "entryCard", value: false },
      { wait: 14 },
    ],
  },
  loop: "fade",
  still: 60,
};
