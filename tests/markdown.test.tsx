import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  NewsBody,
  parseBlocks,
  safeHref,
  safeImage,
} from "@/lib/news/markdown";

describe("news markdown", () => {
  it("parses blocks", () => {
    expect(
      parseBlocks("# Title\n\nline one\nline two\n\n- a\n- b\n\n1. x\n> q"),
    ).toEqual([
      { t: "h", level: 1, text: "Title" },
      { t: "p", text: "line one line two" },
      { t: "ul", items: ["a", "b"] },
      { t: "ol", items: ["x"] },
      { t: "quote", text: "q" },
    ]);
  });

  it("never renders HTML or scripts", () => {
    const { container } = render(
      <NewsBody
        source={
          "<img src=x onerror=alert(1)> **bold** [x](javascript:alert(1))"
        }
      />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("strong")?.textContent).toBe("bold");
    expect(container.textContent).toContain("<img src=x onerror=alert(1)>");
  });

  it("allows only http(s) links and our own images", () => {
    expect(safeHref("https://spc.noaa.gov")).toBe("https://spc.noaa.gov/");
    expect(safeHref("javascript:alert(1)")).toBeNull();
    const base = "https://abc.supabase.co";
    expect(
      safeImage(`${base}/storage/v1/object/public/news/a/b.webp`, base),
    ).toBeTruthy();
    expect(safeImage("https://evil.example/x.png", base)).toBeNull();
  });
});
