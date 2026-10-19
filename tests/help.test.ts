import { describe, expect, it } from "vitest";
import { answerParts, cleanFaq, DEFAULT_FAQ } from "@/lib/help/faq";
import { checkSubmission, cleanForms, DEFAULT_FORMS } from "@/lib/help/forms";

describe("FAQ", () => {
  it("falls back to the built-in FAQ until the owner saves one", () => {
    expect(cleanFaq({})).toBe(DEFAULT_FAQ);
    expect(cleanFaq(null)).toBe(DEFAULT_FAQ);
  });
  it("drops untitled tabs and sections and unanswered questions", () => {
    const f = cleanFaq({
      intro: "Hi",
      tabs: [
        { id: "a", title: "", sections: [] },
        {
          id: "b",
          title: "Billing",
          sections: [
            { id: "s", title: "", items: [] },
            {
              id: "s2",
              title: "Paying",
              items: [
                { id: "q1", q: "How?", a: "With a card." },
                { id: "q2", q: "Empty?", a: "  " },
              ],
            },
          ],
        },
      ],
    });
    expect(f.tabs).toHaveLength(1);
    expect(f.tabs[0].sections).toHaveLength(1);
    expect(f.tabs[0].sections[0].items.map((i) => i.q)).toEqual(["How?"]);
  });
  it("gives repeated ids new ones so every question stays distinct", () => {
    const f = cleanFaq({
      tabs: [
        {
          id: "t",
          title: "T",
          sections: [
            {
              id: "s",
              title: "S",
              items: [
                { id: "x", q: "1", a: "a" },
                { id: "x", q: "2", a: "b" },
              ],
            },
          ],
        },
      ],
    });
    const ids = f.tabs[0].sections[0].items.map((i) => i.id);
    expect(new Set(ids).size).toBe(2);
  });
  it("splits answers into paragraphs and keeps only safe links", () => {
    const p = answerParts(
      "See [plans](/join) or [docs](https://example.com).\n\nNot [this](javascript:alert(1)).",
    );
    expect(p).toHaveLength(2);
    expect(p[0]).toContainEqual({ text: "plans", href: "/join" });
    expect(p[0]).toContainEqual({ text: "docs", href: "https://example.com" });
    expect(p[1].some((x) => "href" in x)).toBe(false);
  });
});

describe("Contact forms", () => {
  it("ships General and Support", () => {
    expect(DEFAULT_FORMS.tabs.map((t) => t.id)).toEqual(["general", "support"]);
  });
  it("always keeps name, email and message, and keeps them required", () => {
    const f = cleanForms({
      tabs: [
        {
          id: "Volunteer Sign-up",
          title: "Volunteers",
          fields: [
            { id: "name", label: "Name", kind: "long", required: false },
            { id: "skills", label: "Skills", kind: "choice", options: [] },
          ],
        },
      ],
    });
    const t = f.tabs[0];
    expect(t.id).toBe("volunteer-sign-up");
    expect(t.fields.map((x) => x.id)).toEqual(["name", "email", "body"]);
    expect(t.fields.every((x) => x.required)).toBe(true);
    expect(t.fields[0].kind).toBe("text");
  });
  it("checks answers and writes the extra ones above the message", () => {
    const tab = DEFAULT_FORMS.tabs[1];
    const ok = checkSubmission(
      tab,
      (id) =>
        ({
          name: "Jay",
          email: "jay@example.com",
          topic: "My plan or billing",
          device: "",
          page: "Radar",
          body: "It won't load.",
        })[id] ?? "",
    );
    expect(ok).toEqual({
      name: "Jay",
      email: "jay@example.com",
      subject: "My plan or billing",
      body: "What do you need help with?: My plan or billing\nWhich page?: Radar\n\nIt won't load.",
    });
    const bad = checkSubmission(tab, (id) =>
      id === "topic" ? "Not a choice" : id === "email" ? "a@b.co" : "x",
    );
    expect(bad).toEqual({
      error: "Pick an answer for “What do you need help with?”.",
    });
    const noMail = checkSubmission(DEFAULT_FORMS.tabs[0], (id) =>
      id === "email" ? "nope" : "x",
    );
    expect("error" in noMail).toBe(true);
  });
});
