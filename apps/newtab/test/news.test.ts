import { describe, expect, it } from "vitest";

import { mergeStories, NEWS_SOURCES, parseFeed, plain, type Story } from "../src/news";

const src = NEWS_SOURCES.find((x) => x.id === "isna") ?? NEWS_SOURCES[0];
if (src === undefined) throw new Error("no sources");

const FEED = `<?xml version="1.0"?><rss version="2.0"><channel><title>x</title>
<item>
  <title>حضور &amp; پژوهشگران</title>
  <link>https://www.isna.ir/news/1</link>
  <description>خلاصه‌ی خبر.</description>
  <enclosure url="https://cdn.isna.ir/a.jpg" length="1" type="image/jpeg" />
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

describe("mergeStories", () => {
  const story = (id: string, title: string, at: string): Story => ({
    id,
    title,
    summary: "",
    image: null,
    source: "isna",
    category: "general",
    at,
    url: `https://x.test/${id}`,
  });

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
