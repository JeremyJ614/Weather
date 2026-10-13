/** The admin-editable parts of the signup form. Required fields are always shown. */
export type SignupForm = {
  show: {
    nickname: boolean;
    phone: boolean;
    foundUs: boolean;
    referral: boolean;
  };
  /** Choices for "How did you find us?"; empty means a free-text answer. */
  foundUsOptions: string[];
  intro: string;
};

export const DEFAULT_FORM: SignupForm = {
  show: { nickname: true, phone: true, foundUs: true, referral: true },
  foundUsOptions: [],
  intro: "",
};

export function cleanForm(v: unknown): SignupForm {
  const o = (v ?? {}) as Record<string, unknown>;
  const s = (o.show ?? {}) as Record<string, unknown>;
  const flag = (k: keyof SignupForm["show"]) =>
    typeof s[k] === "boolean" ? (s[k] as boolean) : true;
  const opts = Array.isArray(o.foundUsOptions) ? o.foundUsOptions : [];
  return {
    show: {
      nickname: flag("nickname"),
      phone: flag("phone"),
      foundUs: flag("foundUs"),
      referral: flag("referral"),
    },
    foundUsOptions: [
      ...new Set(
        opts
          .filter((x): x is string => typeof x === "string")
          .map((x) => x.trim().slice(0, 60))
          .filter(Boolean),
      ),
    ].slice(0, 20),
    intro: typeof o.intro === "string" ? o.intro.slice(0, 300) : "",
  };
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
