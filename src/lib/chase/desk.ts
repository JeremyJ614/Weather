import "server-only";
import { gemini, parseJson } from "@/lib/ai/gemini";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CAT_NAMES, lclFt, type DeskNote } from "./score";
import type { ChaseDay } from "./engine";

/**
 * The SSWX Forecast Desk: once a day, Gemini writes the chase notes VIP shows (a one-line
 * summary of the day, then per target a forecast paragraph, tornado, hail and wind lines
 * and the way it busts), strictly from the numbers the engine computed. Never invents a
 * number; the prompt hands it every one it may use.
 */
export type Desk = {
  summary: string;
  targets: DeskNote[];
  /** "If you're going": practical notes, and one safety line. */
  tips?: string[];
  safety?: string;
};

const PROMPT = (
  facts: string,
) => `You are the SSWX Forecast Desk writing a storm chasing briefing.
Use ONLY the numbers given below; do not invent values. Plain, confident, chaser language. Local times as given.
Return JSON: {"summary": one sentence (max 25 words) describing the day's best setup and where,
"targets": [for each target in order: {"desk": 3-4 sentences on initiation timing, storm mode, motion, daylight and evolution,
"tornado": 1 sentence, "hail": 1 sentence, "wind": 1 sentence, "bust": 2 sentences on how the day fails}],
"tips": 3 short practical tips for someone heading out today (where to sit relative to storm motion, timing, daylight), "safety": 1 sentence on the day's biggest safety concern}.
FACTS:
${facts}`;

export async function deskNotes(d: ChaseDay): Promise<Desk | undefined> {
  const key = process.env.GEMINI_API_KEY;
  if (!key || !d.targets.length) return undefined;
  const facts = d.targets
    .map((t) => {
      const h = t.hour;
      const local = (iso: string | null) =>
        iso
          ? new Date(iso).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              timeZone: "America/Chicago",
            }) + " CT"
          : "unknown";
      return `Target ${t.rank}: ${t.place}. SPC ${CAT_NAMES[t.spc.cat]} risk, tornado ${t.spc.torn}%, hail ${t.spc.hail}%, wind ${t.spc.wind}%.
Peak hour ${local(t.peak)}, sunset ${local(t.sunset)} (${t.hoursToSunset} h of light after peak).
CAPE ${h.cape} J/kg, CIN ${h.cin} J/kg, lifted index ${h.li}, temp ${h.temp}F, dew point ${h.dew}F, LCL ${lclFt(h.temp, h.dew)} ft,
0-6 km shear ${h.shear} kt, 0-3 km SRH ${h.srh} m2/s2, STP ${h.stp}, storm motion ${h.motionMph} mph toward ${h.motionTo} degrees,
precip chance ${h.pop}%, low cloud ${h.lowCloud}%, freezing level ${h.freezingFt} ft${h.rh700 != null ? `, 700mb RH ${h.rh700}%` : ""}${h.w700 != null ? `, 700mb vertical motion ${h.w700} m/s (positive = rising)` : ""}.
Mode: ${t.mode.mode} (${t.mode.flavor}), hail estimate ${t.mode.hailIn} in. Bust chance ${t.bust.pct}%: ${t.bust.reasons.join(" ") || "no flagged failure modes"}.`;
    })
    .join("\n\n");
  const db = supabaseAdmin();
  const desk = await gemini<Desk>({
    key,
    prompt: PROMPT(facts),
    temperature: 0.4,
    maxOutputTokens: 2200,
    json: true,
    accept: (text) => {
      const j = parseJson<Desk>(text);
      if (!j) return null;
      const clean = (x: unknown, n: number) =>
        typeof x === "string" ? x.trim().slice(0, n) : "";
      const out: Desk = {
        summary: clean(j.summary, 220),
        targets: d.targets.map((_, i) => ({
          desk: clean(j.targets?.[i]?.desk, 700),
          tornado: clean(j.targets?.[i]?.tornado, 260),
          hail: clean(j.targets?.[i]?.hail, 260),
          wind: clean(j.targets?.[i]?.wind, 260),
          bust: clean(j.targets?.[i]?.bust, 400),
        })),
        tips: (Array.isArray(j.tips) ? j.tips : [])
          .map((x) => clean(x, 240))
          .filter(Boolean)
          .slice(0, 4),
        safety: clean(j.safety, 260) || undefined,
      };
      return out.summary && out.targets.every((t) => t.desk) ? out : null;
    },
    budget: 50,
    counted: (ok) => db.rpc("count_ai_call", { p_feature: "chase", p_ok: ok }),
  });
  return desk ?? undefined;
}
