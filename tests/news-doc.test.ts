import { describe, expect, it } from "vitest";
import {
  cleanDoc,
  fromMarkdown,
  plainText,
  safeLink,
  youtubeId,
  type Doc,
} from "@/lib/news/doc";
import { docToHtml, domToDoc, toHex } from "@/lib/news/html";

const BUCKET = "https://x.supabase.co/storage/v1/object/public/news/";
const ok = (src: string) => src.startsWith(BUCKET);
const html = (h: string) => {
  const d = document.createElement("div");
  d.innerHTML = h;
  return domToDoc(d);
};

const sample: Doc = {
  v: 2,
  blocks: [
    { t: "h1", c: [{ x: "Storm day" }] },
    {
      t: "p",
      align: "center",
      c: [
        { x: "Bold", b: 1 },
        { x: " and " },
        { x: "red", color: "#ef4444", size: "lg" },
        { x: " link", href: "https://spc.noaa.gov/" },
      ],
    },
    {
      t: "check",
      items: [
        { c: [{ x: "Charge radios" }], done: 1 },
        { c: [{ x: "Fuel" }], lvl: 1 },
      ],
    },
    { t: "callout", tone: "warn", c: [{ x: "Shelter early" }] },
    {
      t: "img",
      src: `${BUCKET}p/a.webp`,
      alt: "Logo",
      cap: "Team logo",
      size: "half",
    },
    {
      t: "table",
      head: 1,
      rows: [
        [[{ x: "Time" }], [{ x: "Risk" }]],
        [[{ x: "4 PM" }], [{ x: "High" }]],
      ],
    },
    { t: "video", id: "dQw4w9WgXcQ" },
    { t: "hr" },
  ],
};

describe("news documents", () => {
  it("round-trips through the editor's HTML unchanged", () => {
    expect(cleanDoc(html(docToHtml(sample)), ok)).toEqual(sample);
  });
  it("keeps only safe values", () => {
    const bad = cleanDoc(
      {
        blocks: [
          {
            t: "p",
            c: [
              {
                x: "hi",
                href: "javascript:alert(1)",
                color: "red;x:1",
                onclick: "x",
              },
            ],
          },
          { t: "img", src: "https://evil.example/a.png", alt: "" },
          { t: "video", id: "<script>" },
          { t: "script", c: [] },
        ],
      },
      ok,
    );
    expect(bad).toEqual({ v: 2, blocks: [{ t: "p", c: [{ x: "hi" }] }] });
  });
  it("reads pasted Google Docs text without its black color or fake bold wrapper", () => {
    const d = html(
      '<b style="font-weight:normal" id="docs-internal-guid-1"><p><span style="color:#000000;font-weight:700">Watch</span><span style="color:#000000"> issued</span></p></b>',
    );
    expect(d.blocks).toEqual([
      { t: "p", c: [{ x: "Watch", b: 1 }, { x: " issued" }] },
    ]);
  });
  it("turns older Markdown posts into documents", () => {
    const d = fromMarkdown(
      "## Hi\n\nSome **bold** [link](https://a.b/)\n\n- one\n- two",
    );
    expect(plainText(d)).toBe("Hi\n\nSome bold link\n\none\ntwo");
    expect(d.blocks[1]).toEqual({
      t: "p",
      c: [
        { x: "Some " },
        { x: "bold", b: 1 },
        { x: " " },
        { x: "link", href: "https://a.b/" },
      ],
    });
  });
  it("parses links, video ids and colors", () => {
    expect(safeLink("/leaderboard")).toBe("/leaderboard");
    expect(safeLink("//evil.com")).toBeNull();
    expect(safeLink("mailto:a@b.co")).toBe("mailto:a@b.co");
    expect(youtubeId("https://youtu.be/dQw4w9WgXcQ?t=3")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
    expect(toHex("rgb(239, 68, 68)")).toBe("#ef4444");
    expect(toHex("rgba(0, 0, 0, 0)")).toBeNull();
  });
});
