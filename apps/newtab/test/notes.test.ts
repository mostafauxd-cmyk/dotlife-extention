import { describe, expect, it } from "vitest";

import {
  asNote,
  barsPath,
  checklistProgress,
  clock,
  insertVoice,
  levelOf,
  linkLabel,
  urlsIn,
  withoutUrls,
  withUrlsKept,
  resample,
  setTranscript,
  transcriptIntoNote,
  expired,
  folderMapping,
  groupNotes,
  isEmptyNote,
  joinBackward,
  normalize,
  noteAsText,
  notesForDay,
  notesForTask,
  noteTitle,
  notePreview,
  repoint,
  rowDate,
  searchNotes,
  setKind,
  splitBlock,
  toggleDone,
  type Block,
  type Note,
  type Voice,
} from "../src/noghte/notes";

let seq = 0;
const id = (): string => `n${String(++seq)}`;

const note = (over: Partial<Note> & { text?: string[] } = {}): Note => {
  const { text = ["عنوان", "خط دوم"], ...rest } = over;
  return {
    id: id(),
    folderId: "f",
    blocks: text.map((t, i) => ({ id: id(), kind: i === 0 ? "title" : "text", text: t })),
    pinned: false,
    createdAt: "2026-10-06T08:00:00.000Z",
    updatedAt: "2026-10-06T08:00:00.000Z",
    ...rest,
  };
};

const dayOf = (iso: string): string => iso.slice(0, 10);

describe("title and preview", () => {
  it("takes the first written line as the title and the next as the preview", () => {
    const n = note({ text: ["", "  خرید هفته  ", "نان\nشیر"] });
    expect(noteTitle(n)).toBe("خرید هفته");
    expect(notePreview(n)).toBe("نان");
  });
  it("names an empty note and knows it is empty", () => {
    const n = note({ text: ["", " "] });
    expect(noteTitle(n)).toBe("یادداشت تازه");
    expect(isEmptyNote(n)).toBe(true);
  });
  it("counts checklist progress", () => {
    const n = note();
    n.blocks.push(
      { id: "a", kind: "check", text: "نان", done: true },
      { id: "b", kind: "check", text: "شیر", done: false },
      { id: "c", kind: "check", text: "", done: true },
    );
    expect(checklistProgress(n)).toEqual({ done: 1, total: 2 });
    expect(checklistProgress(note())).toBeNull();
  });
});

describe("search", () => {
  it("folds Arabic letters and ZWNJ, and needs every word", () => {
    expect(normalize("يادداشت‌ها")).toBe("یادداشتها");
    const a = note({ text: ["کتاب‌های پاییز", "خواندن"] });
    const b = note({ text: ["خرید", "کتاب"] });
    expect(
      searchNotes([a, b], "كتاب")
        .map((n) => n.id)
        .sort(),
    ).toEqual([a.id, b.id].sort());
    expect(searchNotes([a, b], "کتابهای خواندن")).toEqual([a]);
    expect(searchNotes([a, b], "  ")).toEqual([]);
  });
});

describe("sections", () => {
  it("groups pinned, today, yesterday, the week, the month and older months", () => {
    const at = (date: string): string => `${date}T09:00:00.000Z`;
    const pinned = note({ pinned: true, updatedAt: at("2026-01-01") });
    const today = note({ updatedAt: at("2026-10-06") });
    const yesterday = note({ updatedAt: at("2026-10-05") });
    const week = note({ updatedAt: at("2026-10-01") });
    const month = note({ updatedAt: at("2026-09-20") });
    const older = note({ updatedAt: at("2026-08-01") }); // 10 Mordad 1405
    const lastYear = note({ updatedAt: at("2025-08-01") }); // Mordad 1404
    const s = groupNotes(
      [older, today, week, pinned, lastYear, month, yesterday],
      "2026-10-06",
      dayOf,
    );
    expect(s.map((x) => x.title)).toEqual([
      "سنجاق‌شده",
      "امروز",
      "دیروز",
      "۷ روز گذشته",
      "۳۰ روز گذشته",
      "مرداد",
      "مرداد 1404",
    ]);
    expect(s[0]?.notes).toEqual([pinned]);
  });
  it("sorts each section newest first", () => {
    const a = note({ updatedAt: "2026-10-06T07:00:00.000Z" });
    const b = note({ updatedAt: "2026-10-06T09:00:00.000Z" });
    expect(groupNotes([a, b], "2026-10-06", dayOf)[0]?.notes).toEqual([b, a]);
  });
  it("dates a row by how long ago it was", () => {
    expect(rowDate({ date: "2026-10-06", time: "21:32" }, "2026-10-06")).toBe("21:32");
    expect(rowDate({ date: "2026-10-05", time: "08:00" }, "2026-10-06")).toBe("دیروز");
    expect(rowDate({ date: "2026-10-03", time: "08:00" }, "2026-10-06")).toBe("شنبه");
    expect(rowDate({ date: "2026-09-01", time: "08:00" }, "2026-10-06")).toBe("10 شهریور");
    expect(rowDate({ date: "2025-09-01", time: "08:00" }, "2026-10-06")).toBe("10 شهریور 1404");
  });
});

describe("editing", () => {
  const blocks = (): Block[] => [
    { id: "t", kind: "title", text: "خرید" },
    { id: "c", kind: "check", text: "نان و شیر", done: true },
    { id: "x", kind: "text", text: "بعد" },
  ];

  it("Enter in the title starts body text with the rest of the line", () => {
    const r = splitBlock(blocks(), 0, 2, id);
    expect(r.blocks.map((b) => [b.kind, b.text])).toEqual([
      ["title", "خر"],
      ["text", "ید"],
      ["check", "نان و شیر"],
      ["text", "بعد"],
    ]);
    expect(r.caret).toEqual({ id: r.blocks[1]?.id, at: 0 });
  });
  it("Enter in a checklist item continues the list, unticked", () => {
    const r = splitBlock(blocks(), 1, 3, id);
    expect(r.blocks[2]).toMatchObject({ kind: "check", text: " و شیر", done: false });
  });
  it("Enter on an empty list item leaves the list", () => {
    const b = blocks();
    b[1] = { id: "c", kind: "check", text: "", done: false };
    const r = splitBlock(b, 1, 0, id);
    expect(r.blocks[1]).toEqual({ id: "c", kind: "text", text: "" });
    expect(r.blocks).toHaveLength(3);
  });
  it("Backspace at the start turns a list item into text, then joins it upward", () => {
    const first = joinBackward(blocks(), 1);
    expect(first?.blocks[1]).toEqual({ id: "c", kind: "text", text: "نان و شیر" });
    const second = joinBackward(first?.blocks ?? [], 1);
    expect(second?.blocks[0]).toEqual({ id: "t", kind: "title", text: "خریدنان و شیر" });
    expect(second?.caret).toEqual({ id: "t", at: 4 });
    expect(joinBackward(blocks(), 0)).toBeNull();
  });
  it("a list kind on the title adds an item below; choosing it again turns an item back to text", () => {
    const r = setKind(blocks(), 0, "check", id);
    expect(r.blocks[0]?.kind).toBe("title");
    expect(r.blocks[1]).toMatchObject({ kind: "check", text: "", done: false });
    const back = setKind(blocks(), 1, "check", id);
    expect(back.blocks[1]).toEqual({ id: "c", kind: "text", text: "نان و شیر" });
    const heading = setKind(blocks(), 2, "heading", id);
    expect(heading.blocks[2]).toEqual({ id: "x", kind: "heading", text: "بعد" });
  });
  it("ticks only checklist items", () => {
    const b = toggleDone(toggleDone(blocks(), "c"), "x");
    expect(b[1]?.done).toBe(false);
    expect(b[2]).toEqual(blocks()[2]);
  });
});

describe("links", () => {
  it("finds a day's and a task's notes, leaving the trash out", () => {
    const a = note({ day: "2026-10-06", updatedAt: "2026-10-06T08:00:00.000Z" });
    const b = note({ day: "2026-10-06", taskId: "t", updatedAt: "2026-10-06T09:00:00.000Z" });
    const gone = note({ day: "2026-10-06", taskId: "t", deletedAt: "2026-10-06T10:00:00.000Z" });
    expect(notesForDay([a, b, gone], "2026-10-06")).toEqual([b, a]);
    expect(notesForDay([a, b], "2026-10-07")).toEqual([]);
    expect(notesForTask([a, b, gone], "t")).toEqual([b]);
  });
});

describe("sharing", () => {
  it("writes lists with their marks", () => {
    const n = note({ text: ["خرید", ""] });
    n.blocks.push(
      { id: "a", kind: "check", text: "نان", done: true },
      { id: "b", kind: "check", text: "شیر", done: false },
      { id: "c", kind: "bullet", text: "بعد" },
    );
    expect(noteAsText(n)).toBe("خرید\n\n☑ نان\n☐ شیر\n• بعد");
  });
});

describe("loading and the trash", () => {
  it("keeps valid notes and drops malformed ones", () => {
    const good = note({ day: "2026-10-06" });
    expect(asNote(JSON.parse(JSON.stringify(good)))).toEqual(good);
    expect(asNote({ id: "x" })).toBeNull();
    expect(asNote({ ...good, blocks: [{ id: 1 }] })).toBeNull();
  });
  it("expires notes after 30 days in the trash", () => {
    const n = note({ deletedAt: "2026-09-01T00:00:00.000Z" });
    expect(expired(n, new Date("2026-09-30T00:00:00.000Z"))).toBe(false);
    expect(expired(n, new Date("2026-10-02T00:00:00.000Z"))).toBe(true);
    expect(expired(note(), new Date())).toBe(false);
  });
});

describe("folders are task lists", () => {
  const folder = (id: string, name: string, isDefault = false) => ({
    id,
    name,
    isDefault,
    createdAt: "2026-10-06T08:00:00.000Z",
    updatedAt: "2026-10-06T08:00:00.000Z",
  });
  const lists = [
    { id: "L1", name: "شخصی", isDefault: true },
    { id: "L2", name: "كار", isDefault: false },
  ];

  it("sends the default folder to the default list and matches the rest by name", () => {
    const r = folderMapping(
      [folder("F0", "یادداشت‌ها", true), folder("F1", "کار"), folder("F2", "لات")],
      lists,
    );
    expect([...r.map]).toEqual([
      ["F0", "L1"],
      ["F1", "L2"],
    ]);
    expect(r.missing.map((f) => f.id)).toEqual(["F2"]);
  });

  it("leaves notes on live lists, moves the rest, and never strands one", () => {
    const a = note({ folderId: "L2" });
    const b = note({ folderId: "F1" });
    const c = note({ folderId: "gone" });
    const out = repoint([a, b, c], new Map([["F1", "L2"]]), new Set(["L1", "L2"]), "L1");
    expect(out.map((n) => n.folderId)).toEqual(["L2", "L2", "L1"]);
    expect(out[0]).toBe(a);
  });
});

describe("voice blocks", () => {
  const voice = (over: Partial<Voice> = {}): Voice => ({
    file: "a.m4a",
    durationMs: 42_000,
    peaks: [0.2, 0.8],
    ...over,
  });
  const lines = (...kinds: [Block["kind"], string][]): Block[] =>
    kinds.map(([kind, text], i) => ({ id: `b${String(i)}`, kind, text }));

  it("keeps a note that only has a recording, and names it", () => {
    const n = note({ text: ["", ""] });
    n.blocks.push({ id: "v", kind: "voice", text: "", voice: voice() });
    expect(isEmptyNote(n)).toBe(false);
    expect(noteTitle(n)).toBe("یادداشت صوتی");
  });

  it("drops in at the line being written, keeping a line to write after it", () => {
    const b = lines(["title", "خرید"], ["text", "نان"]);
    const r = insertVoice(b, 1, voice(), id);
    expect(r.blocks.map((x) => x.kind)).toEqual(["title", "text", "voice", "text"]);
    expect(r.blocks[2]?.id).toBe(r.id);
    expect(r.blocks[3]?.text).toBe("");
  });

  it("goes above an empty last line instead of after it", () => {
    const b = lines(["title", ""], ["text", ""]);
    const r = insertVoice(b, null, voice(), id);
    expect(r.blocks.map((x) => x.kind)).toEqual(["title", "voice", "text"]);
  });

  it("goes between lines in the middle without adding one", () => {
    const b = lines(["title", "t"], ["text", "یک"], ["text", "دو"]);
    const r = insertVoice(b, 1, voice(), id);
    expect(r.blocks.map((x) => x.text)).toEqual(["t", "یک", "", "دو"]);
  });

  it("never joins a line into a recording above it", () => {
    const b = [
      ...lines(["title", "t"]),
      { id: "v", kind: "voice" as const, text: "", voice: voice() },
    ];
    b.push({ id: "e", kind: "text", text: "" });
    const r = joinBackward(b, 2);
    expect(r?.blocks.map((x) => x.id)).toEqual(["b0", "v"]);
    expect(r?.caret).toEqual({ id: "b0", at: 1 });
    b[2] = { id: "e", kind: "text", text: "متن" };
    expect(joinBackward(b, 2)).toBeNull();
  });

  it("finds a note by the words of its recording", () => {
    const n = note({ text: ["جلسه", ""] });
    n.blocks.push({
      id: "v",
      kind: "voice",
      text: "",
      voice: voice({ transcript: { status: "done", text: "بودجه‌ی سال بعد" } }),
    });
    expect(searchNotes([n], "بودجه")).toHaveLength(1);
  });

  it("writes a transcript into the note as lines under the recording", () => {
    const b: Block[] = [
      { id: "t", kind: "title", text: "t" },
      {
        id: "v",
        kind: "voice",
        text: "",
        voice: voice({ transcript: { status: "done", text: "اول\nدوم" } }),
      },
    ];
    const r = transcriptIntoNote(b, "v", id);
    expect(r?.blocks.map((x) => x.text)).toEqual(["t", "", "اول", "دوم"]);
    expect(transcriptIntoNote(setTranscript(b, "v", null), "v", id)).toBeNull();
  });

  it("round-trips through storage and drops a broken recording", () => {
    const n = note();
    n.blocks.push({
      id: "v",
      kind: "voice",
      text: "",
      voice: voice({ transcript: { status: "pending" } }),
    });
    expect(asNote(JSON.parse(JSON.stringify(n)))?.blocks[2]).toEqual(n.blocks[2]);
    const broken = {
      ...n,
      blocks: [...n.blocks.slice(0, 2), { id: "x", kind: "voice", text: "" }],
    };
    expect(asNote(broken)?.blocks).toHaveLength(2);
  });

  it("shares a recording as a line with its length and words", () => {
    const n = note({ text: ["جلسه"] });
    n.blocks.push({
      id: "v",
      kind: "voice",
      text: "",
      voice: voice({ durationMs: 65_000, transcript: { status: "done", text: "سلام" } }),
    });
    expect(noteAsText(n)).toBe("جلسه\n🎙 یادداشت صوتی (1:05)\nسلام");
  });

  it("reads clocks, levels and bars", () => {
    expect(clock(0)).toBe("0:00");
    expect(clock(247_400)).toBe("4:07");
    expect(levelOf(-160)).toBe(0);
    expect(levelOf(0)).toBe(1);
    expect(levelOf(-25)).toBeGreaterThan(0.2);
    expect(resample([0.1, 0.9, 0.2, 0.3], 2)).toEqual([0.9, 0.3]);
    expect(resample([0.5], 3)).toEqual([0.5, 0.5, 0.5]);
    expect(resample([], 2)).toEqual([0, 0]);
  });
});

describe("barsPath", () => {
  it("draws each bar as a centred vertical stroke", () => {
    expect(barsPath([1, 0], { step: 4, bar: 2, height: 12 })).toBe("M1 1V11M5 5.99V6.01");
  });
});

describe("links in a line", () => {
  it("finds the addresses, without the punctuation that ends a sentence", () => {
    expect(urlsIn("بخوان: https://a.com/x-y، و (http://b.org/p?q=1). تمام")).toEqual([
      "https://a.com/x-y",
      "http://b.org/p?q=1",
    ]);
    expect(urlsIn("بدون لینک")).toEqual([]);
    expect(urlsIn("https://a.com https://a.com")).toEqual(["https://a.com"]);
  });

  it("leaves the addresses out of the text that a link stands in for", () => {
    expect(withoutUrls("خلاصه خبر.\nhttps://a.com/x-y")).toBe("خلاصه خبر.");
    expect(withoutUrls("بخوان https://a.com/x، تمام")).toBe("بخوان ، تمام");
    expect(withoutUrls("https://a.com/x")).toBe("");
    expect(withoutUrls("بدون لینک")).toBe("بدون لینک");
    expect(withoutUrls("کلمه ")).toBe("کلمه ");
  });

  it("puts the kept addresses back after the edited words", () => {
    expect(withUrlsKept("خلاصه\nhttps://a.com/x", "خلاصهٔ نو ")).toBe(
      "خلاصهٔ نو \nhttps://a.com/x",
    );
    expect(withUrlsKept("https://a.com/x", "")).toBe("https://a.com/x");
    expect(withUrlsKept("https://a.com/x", "https://a.com/x ok")).toBe("https://a.com/x ok");
  });

  it("labels an address without its scheme and www, shortened", () => {
    expect(linkLabel("https://www.eghtesadonline.com/fa/news/1/")).toBe(
      "eghtesadonline.com/fa/news/1",
    );
    expect(linkLabel("https://a.com/" + "x".repeat(80)).length).toBe(56);
  });
});
