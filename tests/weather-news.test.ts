import { describe, expect, it } from "vitest";
import {
  curate,
  parseFeed,
  rank,
  severityOf,
  snippet,
  type Story,
} from "@/lib/news/feed";

const rss = `<rss><channel><title>X</title>
<item><title>Hurricane Simon Public Advisory Number 23a</title><link>https://www.nhc.noaa.gov/a</link>
<pubDate>Tue, 13 Oct 2026 06:00:00 GMT</pubDate><description><![CDATA[<p>Simon &amp; friends</p>]]></description></item>
<item><title>Summary for Hurricane Simon</title><link>https://www.nhc.noaa.gov/s</link></item>
</channel></rss>`;
const atom = `<feed><entry><title>Story</title><link href="https://n.example/1"/><updated>2026-10-12T10:00:00Z</updated><summary>Hi</summary></entry></feed>`;

const s = (
  url: string,
  severity: number,
  source = "NOAA",
  d = "2026-10-12T00:00:00Z",
): Story => ({
  url,
  title: url,
  source,
  snippet: null,
  severity,
  published_at: d,
});

describe("weather news", () => {
  it("reads RSS and Atom", () => {
    expect(parseFeed(rss)[0]).toEqual({
      title: "Hurricane Simon Public Advisory Number 23a",
      link: "https://www.nhc.noaa.gov/a",
      date: "2026-10-13T06:00:00.000Z",
      text: "Simon & friends",
    });
    expect(parseFeed(atom)[0].link).toBe("https://n.example/1");
  });
  it("ranks hazards above general news and skips noise", () => {
    expect(severityOf("SPC", "SPC Tornado Watch 345")).toBe(90);
    expect(
      severityOf("SPC", "SPC - No watches are valid as of now"),
    ).toBeNull();
    expect(severityOf("NHC", "Summary for Hurricane Simon")).toBeNull();
    expect(
      severityOf("NHC", "There are no tropical cyclones at this time."),
    ).toBeNull();
    expect(
      severityOf("NHC", "Hurricane Simon Public Advisory Number 23a"),
    ).toBe(92);
    expect(severityOf("NPR Climate", "Anything")).toBe(25);
  });
  it("sorts by severity then date, dedupes and caps per source", () => {
    const out = rank(
      [
        s("a", 25),
        s("b", 90, "SPC"),
        s("c", 25, "NOAA", "2026-10-13T00:00:00Z"),
        s("a", 25),
      ],
      40,
      1,
    );
    expect(out.map((x) => x.url)).toEqual(["b", "c"]);
  });
  it("applies pins in order and hides", () => {
    const list = [s("a", 90), s("b", 50), s("c", 25)];
    const out = curate(list, [
      { url: "c", action: "pin", position: 1 },
      { url: "a", action: "hide", position: 0 },
    ]);
    expect(out.map((x) => [x.url, x.pinned])).toEqual([
      ["c", true],
      ["b", false],
    ]);
  });
  it("trims snippets on a word boundary", () => {
    expect(snippet("one two three", 7)).toBe("one two…");
  });
});
