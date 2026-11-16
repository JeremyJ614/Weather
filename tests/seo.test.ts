// @vitest-environment node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { default: sitemap } = await import("@/app/sitemap");
const { default: robots } = await import("@/app/robots");
const { FRONT_DOOR, GUEST_PAGES, GUEST_PATHS } =
  await import("@/lib/nav/registry");
const { pageMeta, SITE } = await import("@/lib/seo/site");

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });

describe("search and sharing", () => {
  it("gives every public route a title, description, canonical and share card", () => {
    const pages = files("src/app").filter(
      (f) =>
        f.endsWith("page.tsx") &&
        !f.includes("/admin/") &&
        // The SSWX section is private (Members and Recruits only, noindex).
        !f.includes("/sswx/") &&
        !f.includes("/api/"),
    );
    for (const f of pages) {
      const src = readFileSync(f, "utf8");
      expect(
        src.includes("pageMeta(") || src.includes("generateMetadata"),
        f,
      ).toBe(true);
    }
    const m = pageMeta("/x", "X", "About X");
    expect(m.alternates?.canonical).toBe("/x");
    expect(m.openGraph).toMatchObject({ url: "/x", siteName: SITE.name });
    expect(m.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("lists only pages a crawler can open without being sent to the sign-up gate", async () => {
    const list = await sitemap();
    expect(list.length).toBeGreaterThan(FRONT_DOOR.length);
    for (const { url } of list) {
      const path = new URL(url).pathname;
      expect(GUEST_PATHS.test(path), path).toBe(true);
    }
  });

  it("opens the front door to guests, in the menus and past the proxy", () => {
    for (const s of FRONT_DOOR) {
      expect(GUEST_PAGES).toContain(s);
      expect(GUEST_PATHS.test(`/${s}`)).toBe(true);
    }
    for (const p of [
      "/sitemap.xml",
      "/robots.txt",
      "/llms.txt",
      "/feed.xml",
      "/news-sitemap.xml",
      "/widgets",
      "/embed/sswxcon",
    ])
      expect(GUEST_PATHS.test(p), p).toBe(true);
  });

  it("points crawlers at the sitemap and keeps them out of private pages", () => {
    const r = robots();
    expect(r.sitemap).toEqual([
      `${SITE.url}/sitemap.xml`,
      `${SITE.url}/news-sitemap.xml`,
    ]);
    const rules = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rules.disallow).toEqual(expect.arrayContaining(["/admin", "/api/"]));
  });

  it("describes every image", () => {
    for (const f of files("src").filter((f) => f.endsWith(".tsx"))) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/<img\b([\s\S]*?)\/>/g))
        expect(/\balt=/.test(m[1]), `${f}: <img${m[1].slice(0, 60)}`).toBe(
          true,
        );
    }
  });
});
