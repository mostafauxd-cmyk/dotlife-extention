import { SAMPLE_ADS } from "@dotlife/ads";
import { describe, expect, it } from "vitest";

import { blankDraft, draftFromAd, draftToInput, type Draft } from "../src/data/slotForm";
import { validateAd } from "../src/data/validate";
import { makeAd } from "./helpers";

const draft = (slot: number, over: Partial<Draft> = {}): Draft => ({
  ...blankDraft(slot, "x"),
  advertiser: "الف",
  title: "عنوان",
  url: "https://example.com/",
  ...over,
});
const check = (d: Draft) => validateAd(draftToInput(d));
const errorsOf = (d: Draft): Record<string, string> => {
  const r = check(d);
  return r.ok ? {} : r.errors;
};

describe("validateAd", () => {
  it("accepts every sample ad as the form would send it back", () => {
    for (const ad of SAMPLE_ADS) {
      const r = validateAd(draftToInput(draftFromAd(ad)));
      expect(r, ad.id).toMatchObject({ ok: true });
    }
  });

  it("asks for what is missing, in Persian", () => {
    const e = errorsOf(draft(6, { title: "", advertiser: "", url: "" }));
    expect(e["title"]).toBe("عنوان لازم است.");
    expect(e["advertiser"]).toBe("آگهی‌دهنده لازم است.");
    expect(e["url"]).toContain("نشانی مقصد");
  });

  it("wants https, a real colour and sane numbers", () => {
    expect(errorsOf(draft(6, { url: "http://example.com/" }))["url"]).toContain("https");
    expect(
      errorsOf(draft(7, { tint: "red", extra: { kind: "کنسرت", date: "2026-10-23" } }))["tint"],
    ).toContain("#D9862B");
    expect(errorsOf(draft(6, { weight: "0" }))["weight"]).toContain("کمتر");
    expect(errorsOf(draft(6, { weight: "abc" }))["weight"]).toContain("درست");
    expect(errorsOf(draft(6, { dailyCap: "-5" }))["dailyCap"]).toBeDefined();
  });

  it("checks the days", () => {
    expect(errorsOf(draft(6, { from: "2026-10-20", until: "2026-10-10" }))["until"]).toContain(
      "پیش از",
    );
    expect(errorsOf(draft(6, { from: "۱۴۰۵/۰۷/۲۳" }))["from"]).toContain("۲۰۲۶-۱۰-۲۳");
  });

  it("holds a title to what the slot's box can show", () => {
    const long = "ب".repeat(30);
    expect(errorsOf(draft(1, { title: long, tint: "#D9862B", glyph: "ب" }))["title"]).toContain(
      "۱۶",
    );
    expect(errorsOf(draft(6, { title: long }))["title"]).toBeUndefined();
  });

  it("asks each slot for its own extras", () => {
    expect(errorsOf(draft(2, { tint: "#EA4C89" }))["extra.folder"]).toBe("پوشه‌ی شغل لازم است.");
    const seven = errorsOf(draft(7));
    expect(seven["extra.kind"]).toBeDefined();
    expect(seven["extra.date"]).toBeDefined();
    expect(errorsOf(draft(7, { extra: { kind: "کنسرت", date: "فردا" } }))["extra.date"]).toContain(
      "۲۰۲۶-۱۰-۲۳",
    );
    expect(
      errorsOf(draft(7, { extra: { kind: "نامعلوم", date: "2026-10-23" } }))["extra.kind"],
    ).toBeDefined();
    const eleven = errorsOf(draft(11, { tint: "#B8862B", extra: { price: "ارزان" } }));
    expect(eleven["extra.price"]).toContain("عدد");
    expect(errorsOf(draft(13))["extra.body"]).toBe("متن قالب لازم است.");
    expect(errorsOf(draft(3))["tint"]).toContain("رنگ برند");
    expect(errorsOf(draft(8, { extra: { occasionDay: "40" } }))["extra.occasionDay"]).toContain(
      "۳۱",
    );
  });

  it("keeps only the targeting a slot allows", () => {
    // slot 4 is aimed by search word only; the persona typed earlier is dropped, not an error
    const d = draft(4, { persona: ["dev"], keyword: ["قطار"], weekend: true });
    const input = draftToInput(d) as {
      targeting: { persona: string[]; keyword: string[]; weekend: boolean };
    };
    expect(input.targeting).toMatchObject({ persona: [], keyword: ["قطار"], weekend: false });
    expect(check(d)).toMatchObject({ ok: true });
  });

  it("refuses a disallowed target that arrives from outside (an import)", () => {
    const r = validateAd({
      ...makeAd({ slot: 4, model: "per-click" }),
      targeting: { ...makeAd().targeting, persona: ["dev"] },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors["targeting.persona"]).toContain("پرسونا");
  });

  it("never shows a field the slot lacks as an error", () => {
    // slot 5 has no cta, glyph, tint or image: values left in the draft are not sent
    const input = draftToInput(draft(5, { cta: "x", glyph: "y", tint: "bad", image: "bad" }));
    expect(input).toMatchObject({
      cta: undefined,
      glyph: undefined,
      tint: undefined,
      image: undefined,
    });
  });
});

describe("drafts", () => {
  it("starts from the slot's own product and sale model", () => {
    expect(blankDraft(13, "n")).toMatchObject({
      slot: 13,
      products: ["newtab"],
      model: "monthly-sponsor",
      status: "draft",
    });
  });
  it("round-trips an ad", () => {
    const ad = SAMPLE_ADS.find((a) => a.id === "sample-11");
    if (ad === undefined) throw new Error("no sample");
    const r = validateAd(draftToInput(draftFromAd(ad)));
    expect(r.ok && r.ad).toEqual(ad);
  });
});
