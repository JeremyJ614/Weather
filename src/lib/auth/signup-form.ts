/**
 * The signup form the owner edits (admin → Signup form): which questions are asked, in
 * what order, which are required, plus the owner's own questions. Built-in questions map
 * to profile columns; custom answers are saved in `profiles.custom_answers`.
 */
export type QKind =
  "text" | "long" | "choice" | "multi" | "yesno" | "number" | "date";
export type Builtin =
  | "name"
  | "nickname"
  | "phone"
  | "location"
  | "birthday"
  | "foundUs"
  | "referral"
  | "pin";
export type Question = {
  id: string;
  label: string;
  help: string;
  kind: QKind;
  options: string[];
  required: boolean;
  on: boolean;
  builtin?: Builtin;
};
export type SignupForm = { questions: Question[]; intro: string };

/** Always asked and always required (identity, the 18+ check and the PIN). */
export const LOCKED: Builtin[] = ["name", "location", "birthday", "pin"];
export const KINDS: { id: QKind; label: string }[] = [
  { id: "text", label: "Short answer" },
  { id: "long", label: "Paragraph" },
  { id: "choice", label: "Pick one" },
  { id: "multi", label: "Pick any" },
  { id: "yesno", label: "Yes / no" },
  { id: "number", label: "Number" },
  { id: "date", label: "Date" },
];

const B = (
  builtin: Builtin,
  label: string,
  help = "",
  required = false,
  kind: QKind = "text",
): Question => ({
  id: builtin,
  builtin,
  label,
  help,
  kind,
  options: [],
  required,
  on: true,
});

export const DEFAULT_QUESTIONS: Question[] = [
  B("name", "What's your name?", "", true),
  B(
    "nickname",
    "Got a nickname?",
    "Use it as your name across the app if you like.",
  ),
  B(
    "location",
    "Where do you live?",
    "Your city and state set your local weather.",
    true,
  ),
  B(
    "birthday",
    "When's your birthday?",
    "You must be 18 or older to join.",
    true,
    "date",
  ),
  B("phone", "Your phone number", "Only for the texts you ask for."),
  B("foundUs", "How did you find us?"),
  B(
    "referral",
    "Referred by an SSWX Member?",
    "Enter their 6-digit referral code.",
  ),
  B(
    "pin",
    "Choose a 4-digit PIN",
    "You'll sign in with your email and this PIN.",
    true,
  ),
];
export const DEFAULT_FORM: SignupForm = {
  questions: DEFAULT_QUESTIONS,
  intro: "",
};

const str = (v: unknown, n: number) =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "";

/** Rebuilds a saved form, keeping only valid questions; locked ones can't be turned off. */
export function cleanForm(v: unknown): SignupForm {
  const o = (v ?? {}) as Record<string, unknown>;
  const intro = typeof o.intro === "string" ? o.intro.slice(0, 300) : "";
  // The first version stored on/off flags and the "found us" choices only.
  if (!Array.isArray(o.questions)) {
    const show = (o.show ?? {}) as Record<string, unknown>;
    const opts = Array.isArray(o.foundUsOptions) ? o.foundUsOptions : [];
    return {
      intro,
      questions: DEFAULT_QUESTIONS.map((q) => ({
        ...q,
        on: show[q.id] === false ? false : true,
        ...(q.id === "foundUs" && opts.length
          ? { kind: "choice" as const, options: cleanOptions(opts) }
          : {}),
      })),
    };
  }
  const seen = new Set<string>();
  const questions: Question[] = [];
  for (const raw of o.questions.slice(0, 40)) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const builtin = DEFAULT_QUESTIONS.find((d) => d.id === r.builtin)?.builtin;
    const id = builtin ?? str(r.id, 24).replace(/[^\w-]/g, "");
    if (!id || seen.has(id)) continue;
    const def = DEFAULT_QUESTIONS.find((d) => d.id === builtin);
    const kind = KINDS.some((k) => k.id === r.kind)
      ? (r.kind as QKind)
      : "text";
    const label = str(r.label, 120) || def?.label || "";
    if (!label) continue;
    const locked = builtin && LOCKED.includes(builtin);
    seen.add(id);
    questions.push({
      id,
      ...(builtin ? { builtin } : {}),
      label,
      help: str(r.help, 200),
      // Built-ins keep their own input; only "found us" may become a list.
      kind: builtin
        ? builtin === "foundUs" && (kind === "choice" || kind === "text")
          ? kind
          : def!.kind
        : kind,
      options:
        (builtin && builtin !== "foundUs") ||
        !["choice", "multi"].includes(kind)
          ? []
          : cleanOptions(r.options),
      required: locked ? true : r.required === true,
      on: locked ? true : r.on !== false,
    });
  }
  // Built-ins missing from a saved form come back at the end (optional ones switched off).
  for (const d of DEFAULT_QUESTIONS)
    if (!seen.has(d.id))
      questions.push({ ...d, on: LOCKED.includes(d.builtin!) });
  // The PIN is always the last question.
  const pin = questions.findIndex((q) => q.id === "pin");
  questions.push(...questions.splice(pin, 1));
  return { questions, intro };
}

function cleanOptions(v: unknown): string[] {
  return [
    ...new Set(
      (Array.isArray(v) ? v : [])
        .filter((x): x is string => typeof x === "string")
        .map((x) => x.trim().slice(0, 60))
        .filter(Boolean),
    ),
  ].slice(0, 20);
}

/** Checks the answers to the owner's own questions; returns them cleaned, or an error. */
export function checkCustom(
  form: SignupForm,
  get: (id: string) => string[],
): { answers: Record<string, string | string[]> } | { error: string } {
  const answers: Record<string, string | string[]> = {};
  for (const q of form.questions) {
    if (q.builtin || !q.on) continue;
    const v = get(q.id)
      .map((x) => x.trim())
      .filter(Boolean);
    if (!v.length) {
      if (q.required) return { error: `Answer “${q.label}”.` };
      continue;
    }
    if (q.kind === "multi") {
      const picked = v.filter((x) => q.options.includes(x));
      if (q.required && !picked.length)
        return { error: `Pick at least one for “${q.label}”.` };
      answers[q.id] = picked;
      continue;
    }
    const x = v[0];
    if (q.kind === "choice" && !q.options.includes(x))
      return { error: `Pick an answer for “${q.label}”.` };
    if (q.kind === "yesno" && x !== "Yes" && x !== "No")
      return { error: `Answer yes or no for “${q.label}”.` };
    if (q.kind === "number" && !Number.isFinite(Number(x)))
      return { error: `“${q.label}” needs a number.` };
    if (q.kind === "date" && Number.isNaN(Date.parse(x)))
      return { error: `“${q.label}” needs a date.` };
    answers[q.id] = x.slice(0, q.kind === "long" ? 1000 : 200);
  }
  return { answers };
}

export async function getSignupForm(): Promise<SignupForm> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return DEFAULT_FORM;
  try {
    const res = await fetch(
      `${url}/rest/v1/app_config?select=value&key=eq.signup_form`,
      {
        headers: { apikey: key },
        next: { revalidate: 3600, tags: ["signup-form"] },
      },
    );
    const rows = res.ok ? ((await res.json()) as { value: unknown }[]) : [];
    return cleanForm(rows[0]?.value);
  } catch {
    return DEFAULT_FORM;
  }
}
