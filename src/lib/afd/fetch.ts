import "server-only";
import { gemini } from "@/lib/ai/gemini";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { parseAfd, type AfdSection } from "./parse";

const UA = {
  "User-Agent": "StormSync Weather (https://weather.sswx.space)",
  Accept: "application/ld+json",
};
export type Afd = {
  id: string;
  office: string;
  issued: string;
  sections: AfdSection[];
  text: string;
};

export async function getLatestAfd(office: string): Promise<Afd | null> {
  const list = await fetch(
    `https://api.weather.gov/products/types/AFD/locations/${office}`,
    {
      headers: UA,
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(8000),
    },
  )
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  const id = list?.["@graph"]?.[0]?.id as string | undefined;
  if (!id) return null;
  const p = await fetch(`https://api.weather.gov/products/${id}`, {
    headers: UA,
    next: { revalidate: 86400 },
    signal: AbortSignal.timeout(8000),
  })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  if (!p?.productText) return null;
  return {
    id,
    office,
    issued: p.issuanceTime,
    text: p.productText,
    sections: parseAfd(p.productText),
  };
}

const PROMPT = `You rewrite National Weather Service forecast discussions for everyday people.
Rules: use only facts in the discussion; never add or guess; keep times, temperatures and hazards exact;
no jargon (explain terms like "shortwave" or "CAPE" in plain words or leave them out); friendly, calm, clear.
Write Markdown using only "## " headings, "- " bullets and **bold**. Sections, in order:
## The big picture (2-3 sentences)
## Today and tonight
## The next few days
## Anything to watch (hazards; say "Nothing notable." if none)
Under 300 words. The discussion:
`;

/** Plain-language version of the latest discussion; generated once per issuance and cached. */
export async function getSimplified(
  office: string,
): Promise<{ id: string; simplified: string } | null> {
  const afd = await getLatestAfd(office);
  if (!afd) return null;
  const db = supabaseAdmin();
  const { data: hit } = await db
    .from("afd_simplified")
    .select("simplified")
    .eq("product_id", afd.id)
    .maybeSingle();
  if (hit) return { id: afd.id, simplified: hit.simplified };

  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const body = afd.sections
    .filter((s) => !/Point forecasts|Watches/.test(s.title))
    .map((s) => `${s.title.toUpperCase()}\n${s.paragraphs.join("\n")}`)
    .join("\n\n")
    .slice(0, 12000);
  const text = await gemini({
    key,
    prompt: PROMPT + body,
    temperature: 0.3,
    maxOutputTokens: 1200,
    accept: (t) => (t.trim() ? t.trim() : null),
    budget: 45,
    counted: (ok) =>
      db.rpc("count_ai_call", { p_feature: "forecast-discussion", p_ok: ok }),
  });
  if (!text) throw new Error("Gemini didn't answer");
  const simplified = text.slice(0, 8000);
  await db
    .from("afd_simplified")
    .upsert({ product_id: afd.id, office, issued: afd.issued, simplified });
  return { id: afd.id, simplified };
}
