/**
 * The Contact Us forms the owner edits (admin → Contact forms): one tab per form, each with
 * its own fields. Saved as app_config `contact_forms`. Every form needs a name, an email and
 * a message (those three can be renamed but not removed), so every submission can be read
 * and answered in admin → Contact inbox, tagged with its form's id.
 */
export type FieldKind =
  "text" | "email" | "phone" | "long" | "choice" | "yesno";
export type Locked = "name" | "email" | "body";
export type FormField = {
  id: string;
  label: string;
  kind: FieldKind;
  required: boolean;
  options: string[];
  placeholder: string;
  locked?: Locked;
};
export type ContactTab = {
  id: string;
  title: string;
  intro: string;
  on: boolean;
  fields: FormField[];
};
export type ContactForms = { tabs: ContactTab[] };

export const FIELD_KINDS: { id: FieldKind; label: string }[] = [
  { id: "text", label: "Short answer" },
  { id: "long", label: "Paragraph" },
  { id: "email", label: "Email" },
  { id: "phone", label: "Phone" },
  { id: "choice", label: "Pick one" },
  { id: "yesno", label: "Yes / no" },
];
const LOCKED_KIND: Record<Locked, FieldKind> = {
  name: "text",
  email: "email",
  body: "long",
};
export const FORM_LIMITS = { tabs: 8, fields: 16, options: 20 };

const F = (
  id: string,
  label: string,
  kind: FieldKind,
  required: boolean,
  placeholder = "",
  options: string[] = [],
): FormField => ({
  id,
  label,
  kind,
  required,
  options,
  placeholder,
  ...(id === "name" || id === "email" || id === "body"
    ? { locked: id as Locked }
    : {}),
});

export const DEFAULT_FORMS: ContactForms = {
  tabs: [
    {
      id: "general",
      title: "General",
      intro:
        "Questions, ideas, partnerships or press. We read every message and reply by email.",
      on: true,
      fields: [
        F("name", "Your name", "text", true),
        F("email", "Your email", "email", true),
        F("subject", "Subject", "text", false, "What's it about?"),
        F("body", "Your message", "long", true),
      ],
    },
    {
      id: "support",
      title: "Support",
      intro:
        "Something not working, or a question about your account or plan? Tell us what you see and we'll help.",
      on: true,
      fields: [
        F("name", "Your name", "text", true),
        F("email", "Your email", "email", true),
        F("topic", "What do you need help with?", "choice", true, "", [
          "Signing in or my PIN",
          "My plan or billing",
          "Alerts and notifications",
          "A page isn't working",
          "Something else",
        ]),
        F("device", "What are you using?", "choice", false, "", [
          "Android phone",
          "iPhone",
          "Tablet",
          "Computer",
        ]),
        F("page", "Which page?", "text", false, "For example, Radar"),
        F(
          "body",
          "What's happening?",
          "long",
          true,
          "What you tried and what you see",
        ),
      ],
    },
  ],
};

const str = (v: unknown, n: number) =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "";
const slug = (v: unknown) =>
  str(v, 32)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

function cleanOptions(v: unknown): string[] {
  return [
    ...new Set(
      (Array.isArray(v) ? v : [])
        .filter((x): x is string => typeof x === "string")
        .map((x) => x.trim().slice(0, 60))
        .filter(Boolean),
    ),
  ].slice(0, FORM_LIMITS.options);
}

/** Rebuilds saved forms, keeping only valid tabs and fields; every form keeps name, email and message. */
export function cleanForms(v: unknown): ContactForms {
  const o = (v ?? {}) as Record<string, unknown>;
  if (!Array.isArray(o.tabs)) return DEFAULT_FORMS;
  const tabIds = new Set<string>();
  const tabs: ContactTab[] = [];
  for (const raw of o.tabs.slice(0, FORM_LIMITS.tabs)) {
    const r = (raw ?? {}) as Record<string, unknown>;
    const title = str(r.title, 30);
    const tid = slug(r.id) || slug(title);
    if (!title || !tid || tabIds.has(tid)) continue;
    tabIds.add(tid);
    const ids = new Set<string>();
    const fields: FormField[] = [];
    for (const fr of (Array.isArray(r.fields) ? r.fields : []).slice(
      0,
      FORM_LIMITS.fields,
    )) {
      const f = (fr ?? {}) as Record<string, unknown>;
      const locked = (["name", "email", "body"] as Locked[]).find(
        (k) => k === f.locked || k === f.id,
      );
      const fid = locked ?? slug(f.id);
      if (!fid || ids.has(fid)) continue;
      const label = str(f.label, 80);
      if (!label) continue;
      const kind = locked
        ? LOCKED_KIND[locked]
        : FIELD_KINDS.some((k) => k.id === f.kind)
          ? (f.kind as FieldKind)
          : "text";
      const options = kind === "choice" ? cleanOptions(f.options) : [];
      if (kind === "choice" && !options.length) continue;
      ids.add(fid);
      fields.push({
        id: fid,
        label,
        kind,
        required: locked ? true : f.required === true,
        options,
        placeholder: str(f.placeholder, 80),
        ...(locked ? { locked } : {}),
      });
    }
    // Name, email and message come back if a saved form lost them.
    for (const k of ["name", "email", "body"] as Locked[])
      if (!ids.has(k)) {
        const d = F(
          k,
          k === "body" ? "Your message" : `Your ${k}`,
          LOCKED_KIND[k],
          true,
        );
        if (k === "body") fields.push(d);
        else fields.splice(k === "name" ? 0 : 1, 0, d);
      }
    tabs.push({
      id: tid,
      title,
      intro: str(r.intro, 300),
      on: r.on !== false,
      fields,
    });
  }
  return tabs.length ? { tabs } : DEFAULT_FORMS;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^[+()\-.\s\d]{7,20}$/;

/**
 * Checks one submission against its form and turns it into an inbox message: the name,
 * email and message, a subject, and every other answer written above the message.
 */
export function checkSubmission(
  tab: ContactTab,
  get: (id: string) => string,
):
  | { name: string; email: string; subject: string; body: string }
  | { error: string } {
  const lines: string[] = [];
  const v: Record<string, string> = {};
  for (const f of tab.fields) {
    const x = get(f.id)
      .trim()
      .slice(0, f.kind === "long" ? 3000 : 200);
    if (!x) {
      if (f.required)
        return {
          error:
            f.kind === "choice"
              ? `Pick an answer for “${f.label}”.`
              : `Fill in “${f.label}”.`,
        };
      continue;
    }
    if (f.kind === "email" && !EMAIL.test(x))
      return { error: `“${f.label}” needs a real email address.` };
    if (f.kind === "phone" && !PHONE.test(x))
      return { error: `“${f.label}” needs a phone number.` };
    if (f.kind === "choice" && !f.options.includes(x))
      return { error: `Pick an answer for “${f.label}”.` };
    if (f.kind === "yesno" && x !== "Yes" && x !== "No")
      return { error: `Answer yes or no for “${f.label}”.` };
    v[f.id] = x;
    if (!f.locked && f.id !== "subject") lines.push(`${f.label}: ${x}`);
  }
  const subject = (v.subject ?? v.topic ?? tab.title).slice(0, 120);
  const body = [...lines, ...(lines.length ? [""] : []), v.body]
    .join("\n")
    .slice(0, 4000);
  return { name: v.name.slice(0, 80), email: v.email, subject, body };
}

export async function getContactForms(): Promise<ContactForms> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return DEFAULT_FORMS;
  try {
    const res = await fetch(
      `${url}/rest/v1/app_config?select=value&key=eq.contact_forms`,
      {
        headers: { apikey: key },
        next: { revalidate: 3600, tags: ["contact-forms"] },
      },
    );
    const rows = res.ok ? ((await res.json()) as { value: unknown }[]) : [];
    return rows.length ? cleanForms(rows[0].value) : DEFAULT_FORMS;
  } catch {
    return DEFAULT_FORMS;
  }
}
