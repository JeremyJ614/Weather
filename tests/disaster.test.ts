import { describe, expect, it } from "vitest";
import {
  checkContact,
  checkOrg,
  cleanUrl,
  orgMessage,
} from "@/lib/disaster/data";

const form = (v: Record<string, string | string[]>) => ({
  get: (k: string) => {
    const x = v[k];
    return typeof x === "string" ? x : "";
  },
  all: (k: string) => {
    const x = v[k];
    return Array.isArray(x) ? x : typeof x === "string" ? [x] : [];
  },
});

const ORG = {
  name: "  Prairie   Relief  ",
  mission: "Hot meals and tarps for families after tornadoes.",
  areas: "Oklahoma and southern Kansas",
  services: ["Food & water", "Roof tarping", "Made up"],
  website: "prairierelief.org",
};

describe("cleanUrl", () => {
  it("adds https and refuses what is not a web address", () => {
    expect(cleanUrl("example.org/give")).toBe("https://example.org/give");
    expect(cleanUrl("http://example.org")).toBe("http://example.org/");
    expect(cleanUrl("javascript:alert(1)")).toBeNull();
    expect(cleanUrl("not a url")).toBeNull();
    expect(cleanUrl("")).toBeNull();
  });
});

describe("checkOrg", () => {
  it("cleans a good sign-up and keeps only known services", () => {
    const { get, all } = form(ORG);
    const o = checkOrg(get, all);
    expect("error" in o).toBe(false);
    if ("error" in o) return;
    expect(o.name).toBe("Prairie Relief");
    expect(o.services).toEqual(["Food & water", "Roof tarping"]);
    expect(o.website).toBe("https://prairierelief.org/");
    expect(o.donate_url).toBeNull();
    expect(o.socials).toEqual({});
  });

  it("names the field that is wrong", () => {
    const bad = (extra: Record<string, string | string[]>) => {
      const { get, all } = form({ ...ORG, ...extra });
      const r = checkOrg(get, all);
      return "error" in r ? r.error : null;
    };
    expect(bad({ services: [] })).toMatch(/at least one/);
    expect(bad({ website: "" })).toMatch(/website/);
    expect(bad({ donate_url: "nope" })).toMatch(/Donation link/);
    expect(bad({ logo_url: "http://x.org/a.png" })).toMatch(/Logo/);
    expect(bad({ phone: "call us" })).toMatch(/Public phone/);
    expect(bad({ social_facebook: "https://example.org/me" })).toMatch(
      /Facebook/,
    );
    expect(bad({ social_x: "twitter.com/prairie" })).toBeNull();
  });
});

describe("messages", () => {
  it("checks the contact and writes the inbox message", () => {
    expect(
      checkContact(form({ contact_name: "Al", contact_email: "x" }).get),
    ).toEqual({ error: "Your email needs to be real." });
    const { get, all } = form(ORG);
    const o = checkOrg(get, all);
    if ("error" in o) throw new Error(o.error);
    const m = orgMessage(o);
    expect(m.subject).toBe("Organization sign-up: Prairie Relief");
    expect(m.body).toContain("Areas served: Oklahoma and southern Kansas");
    expect(m.body).not.toContain("null");
  });
});
