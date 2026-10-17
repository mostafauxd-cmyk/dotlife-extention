import { describe, expect, it } from "vitest";

import {
  categorize,
  coverage,
  forYou,
  hottest,
  mergeStories,
  NEWS_SOURCES,
  parseFeed,
  plain,
  type Story,
} from "../src/news";

const src = NEWS_SOURCES.find((x) => x.id === "isna") ?? NEWS_SOURCES[0];
if (src === undefined) throw new Error("no sources");

const FEED = `<?xml version="1.0"?><rss version="2.0"><channel><title>x</title>
<item>
  <title>حضور &amp; پژوهشگران</title>
  <link>https://www.isna.ir/news/1</link>
  <description>خلاصه‌ی خبر.</description>
  <enclosure url="https://cdn.isna.ir/a.jpg" length="1" type="image/jpeg" />
  <category>اقتصاد &gt; بانک</category>
  <pubDate>Sat, 17 Oct 2026 09:54:23 GMT</pubDate>
</item>
<item>
  <title><![CDATA[دیجیاتو: خبر دو]]></title>
  <link>https://digiato.com/two</link>
  <image><url>https://static.digiato.com/p.jpg.webp</url></image>
  <description><![CDATA[<p>متن اول.</p>
<p>The post <a href="https://digiato.com/two">x</a> appeared first on <a href="https://digiato.com">d</a>.</p>]]></description>
  <pubDate>Sat, 17 Oct 2026 09:48:37 +0000</pubDate>
</item>
<item><title>no link</title></item>
<item><title>insecure</title><link>http://example.com/a</link></item>
</channel></rss>`;

describe("parseFeed", () => {
  const stories = parseFeed(FEED, src);

  it("reads title, link, summary, picture and time, and leaves out items without an https link", () => {
    expect(stories).toHaveLength(2);
    expect(stories[0]).toMatchObject({
      title: "حضور & پژوهشگران",
      url: "https://www.isna.ir/news/1",
      summary: "خلاصه‌ی خبر.",
      image: "https://cdn.isna.ir/a.jpg",
      at: "2026-10-17T09:54:23.000Z",
    });
  });

  it("takes the category from the feed's tags when the feed has none of its own", () => {
    expect(stories[0]?.category).toBe("economy");
    expect(stories[1]?.category).toBe("general");
  });

  it("a section's feed gives every story its section", () => {
    expect(parseFeed(FEED, src, "health").map((s) => s.category)).toEqual(["health", "health"]);
  });

  it("opens CDATA, takes the item's own image, and drops a feed's «The post …» footer", () => {
    expect(stories[1]).toMatchObject({
      title: "دیجیاتو: خبر دو",
      image: "https://static.digiato.com/p.jpg.webp",
      summary: "متن اول.",
    });
  });
});

describe("plain", () => {
  it("strips tags and entities", () => {
    expect(plain("<p>a&nbsp;&amp;<b>b</b></p>")).toBe("a & b");
  });
});

describe("categorize", () => {
  it("keeps a feed's own category, then the tags' deepest section, then the headline's words", () => {
    expect(categorize("هر چیزی", "", "tech")).toBe("tech");
    expect(categorize("هر چیزی", "اجتماعی > سلامت", null)).toBe("health");
    expect(categorize("هر چیزی", "اجتماعی > حوادث", null)).toBe("society");
    expect(categorize("پرسپولیس برد", "", null)).toBe("sport");
    expect(categorize("قیمت دلار امروز", "", null)).toBe("economy");
    expect(categorize("دیدار وزیران خارجه", "سیاسی > دولت", null)).toBe("general");
  });
});

const story = (id: string, title: string, at: string, source = "isna"): Story => ({
  id,
  title,
  summary: "",
  image: null,
  source,
  category: "society",
  at,
  url: `https://x.test/${id}`,
});

describe("mergeStories", () => {
  it("sorts newest first and drops the same headline twice", () => {
    const a = [story("1", "یک", "2026-10-17T08:00:00Z"), story("2", "دو", "2026-10-17T10:00:00Z")];
    const b = [story("3", "دو", "2026-10-17T09:00:00Z"), story("4", "سه", "2026-10-17T09:30:00Z")];
    expect(mergeStories([a, b]).map((s) => s.id)).toEqual(["2", "4", "1"]);
  });

  it("keeps at most `perSource` from each list", () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      story(String(i), `t${String(i)}`, `2026-10-17T${String(i % 24).padStart(2, "0")}:00:00Z`),
    );
    expect(mergeStories([many], 5)).toHaveLength(5);
  });
});

describe("coverage", () => {
  const a = story(
    "a",
    "عرضه اولیه یکشنبه یک شرکت پتروشیمی در فرابورس",
    "2026-10-17T09:00:00Z",
    "isna",
  );
  const b = story(
    "b",
    "عرضه اولیه یکشنبه شرکت پتروشیمی در فرابورس انجام می‌شود",
    "2026-10-17T09:10:00Z",
    "donya",
  );
  const c = story("c", "هوا ابری است و باران می‌بارد", "2026-10-17T09:20:00Z", "yjc");

  it("pairs the same story in different outlets, and not different ones", () => {
    const m = coverage([a, b, c]);
    expect(m.get("a")?.map((s) => s.id)).toEqual(["b"]);
    expect(m.get("b")?.map((s) => s.id)).toEqual(["a"]);
    expect(m.has("c")).toBe(false);
  });

  it("never pairs two stories of one outlet", () => {
    expect(coverage([a, { ...b, source: "isna" }]).size).toBe(0);
  });
});

describe("forYou and hottest", () => {
  const now = Date.parse("2026-10-17T12:00:00Z");
  const fresh = story("f", "خبر تازه", "2026-10-17T11:30:00Z");
  const old = {
    ...story("o", "خبر ورزشی قدیمی", "2026-10-17T05:00:00Z"),
    category: "sport" as const,
  };

  it("puts a followed topic above a newer story, and a read one below", () => {
    const r = forYou([fresh, old], { topics: ["ورزش"], read: new Set(), covered: new Map(), now });
    expect(r.map((s) => s.id)).toEqual(["o", "f"]);
    const r2 = forYou([fresh, old], { topics: [], read: new Set(["f"]), covered: new Map(), now });
    expect(r2.map((s) => s.id)).toEqual(["o", "f"]);
  });

  it("ranks the last day's stories by how many outlets tell them (the newer of two twins), one line per story", () => {
    const x = story("x", "خبر مهم", "2026-10-17T10:00:00Z", "isna");
    const y = story("y", "خبر مهم است", "2026-10-17T10:05:00Z", "donya");
    const z = story("z", "خبر دیگر", "2026-10-17T11:00:00Z", "yjc");
    const gone = story("g", "خبر دیروز", "2026-10-15T11:00:00Z", "yjc");
    const covered = new Map([
      ["x", [y]],
      ["y", [x]],
    ]);
    expect(hottest([x, y, z, gone], covered, 6, now).map((s) => s.id)).toEqual(["y", "z"]);
  });
});
