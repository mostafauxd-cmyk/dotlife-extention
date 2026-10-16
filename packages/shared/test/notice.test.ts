import { describe, expect, it } from "vitest";

import { parseAppConfig } from "../src/appConfig";
import {
  NOTICES_PER_30_DAYS,
  noticeFor,
  noticeTime,
  parseNotice,
  parseNotices,
  planNotices,
  type Notice,
} from "../src/notice";

const raw = (over: Record<string, unknown> = {}) => ({
  id: "yalda",
  on: true,
  at: "2026-12-20T19:00",
  title: "یلدا",
  ...over,
});

describe("parseNotice", () => {
  it("is off unless said, and needs a name, a title and a good time", () => {
    expect(parseNotice(raw({ on: undefined }))).toBeNull();
    expect(parseNotice(raw({ id: "Bad id" }))).toBeNull();
    expect(parseNotice(raw({ title: "" }))).toBeNull();
    expect(parseNotice(raw({ at: "2026-12-20" }))).toBeNull();
    expect(parseNotice(raw({ at: "2026-13-20T19:00" }))).toBeNull();
    expect(parseNotice(raw())).toEqual({
      id: "yalda",
      on: true,
      at: "2026-12-20T19:00",
      title: "یلدا",
      text: null,
      link: null,
      age: "all",
      gender: "all",
    });
  });

  it("drops a link that is not the web or the app, and an unknown audience", () => {
    const n = parseNotice(raw({ link: "intent://x", age: "kids", gender: "x" }));
    expect(n).toMatchObject({ link: null, age: "all", gender: "all" });
    expect(parseNotice(raw({ link: "dotlife://occasions" }))?.link).toBe("dotlife://occasions");
  });

  it("reads the same twice, inside the settings", () => {
    const once = parseAppConfig({ notices: [raw({ age: "over35", link: "https://a.ir" }), 3] });
    expect(once.notices).toHaveLength(1);
    expect(parseAppConfig(JSON.parse(JSON.stringify(once)))).toEqual(once);
    expect(parseNotices([raw(), raw()])).toHaveLength(1);
  });

  it("takes the time on the phone's own clock", () => {
    expect(noticeTime("2026-12-20T19:00")).toBe(new Date(2026, 11, 20, 19, 0).getTime());
  });
});

describe("who a notice is for", () => {
  const n = (age: Notice["age"], gender: Notice["gender"]) =>
    parseNotice(raw({ age, gender })) as Notice;
  it("matches the age group and gender, and an unknown person only «همه»", () => {
    expect(noticeFor(n("over35", "all"), { age: 40, gender: null })).toBe(true);
    expect(noticeFor(n("over35", "all"), { age: 20, gender: null })).toBe(false);
    expect(noticeFor(n("under35", "female"), { age: 20, gender: "female" })).toBe(true);
    expect(noticeFor(n("under35", "female"), { age: 20, gender: "male" })).toBe(false);
    expect(noticeFor(n("over35", "all"), { age: null, gender: null })).toBe(false);
    expect(noticeFor(n("all", "all"), { age: null, gender: null })).toBe(true);
  });
});

describe("planNotices", () => {
  const now = new Date(2026, 11, 1, 12, 0).getTime();
  const who = { age: 30, gender: null } as const;
  const at = (d: number, h = 19) =>
    `2026-12-${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}:00`;
  const list = (...ns: Record<string, unknown>[]) => parseNotices(ns);

  it("arms only what is ahead, not shown before, and within the horizon", () => {
    const plan = planNotices(
      list(
        raw({ id: "past", at: "2026-11-30T19:00" }),
        raw({ id: "a", at: at(5) }),
        raw({ id: "seen", at: at(7) }),
        raw({ id: "far", at: "2027-03-01T19:00" }),
      ),
      now,
      who,
      { seen: now - 1000 },
    );
    expect(plan.map((p) => p.notice.id)).toEqual(["a"]);
  });

  it("never two on one day, and only a few in thirty days", () => {
    const plan = planNotices(
      list(
        raw({ id: "a", at: at(3, 10) }),
        raw({ id: "b", at: at(3, 20) }),
        raw({ id: "c", at: at(10) }),
        raw({ id: "d", at: at(15) }),
        raw({ id: "e", at: at(20) }),
      ),
      now,
      who,
      {},
    );
    expect(plan.map((p) => p.notice.id)).toEqual(["a", "c", "d"]);
    expect(plan).toHaveLength(NOTICES_PER_30_DAYS);
  });

  it("counts the ones shown lately against the few", () => {
    const shown = { x: now - 2 * 86_400_000, y: now - 5 * 86_400_000 };
    const plan = planNotices(
      list(raw({ id: "a", at: at(5) }), raw({ id: "b", at: at(9) })),
      now,
      who,
      shown,
    );
    expect(plan.map((p) => p.notice.id)).toEqual(["a"]);
  });
});
