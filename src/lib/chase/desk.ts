import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CAT_NAMES, lclFt, type DeskNote } from "./score";
import type { ChaseDay } from "./engine";

/**
 * The SSWX Forecast Desk: once a day, Gemini writes the chase notes VIP shows (a one-line
 * summary of the day, then per target a forecast paragraph, tornado, hail and wind lines
 * and the way it busts), strictly from the numbers the engine computed. Never invents a
 * number; the prompt hands it every one it may use.
 */
export type Desk = { summary: string; targets: DeskNote[] };
const MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest"];

const PROMPT = (
  facts: string,
) => `You are the SSWX Forecast Desk writing a storm chasing briefing.
Use ONLY the numbers given below; do not invent values. Plain, confident, chaser language. Local times as given.
Return JSON: {"summary": one sentence (max 25 words) describing the day's best setup and where,
"targets": [for each target in order: {"desk": 3-4 sentences on initiation timing, storm mode, motion, daylight and evolution,
"tornado": 1 sentence, "hail": 1 sentence, "wind": 1 sentence, "bust": 2 sentences on how the day fails}]}.
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
  for (const model of MODELS) {
    let ok = false;
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "x-goog-api-key": key,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: PROMPT(facts) }] }],
            generationConfig: {
              temperature: 0.4,
              responseMimeType: "application/json",
              maxOutputTokens: 1800,
            },
          }),
          signal: AbortSignal.timeout(25000),
        },
      );
      const out = res.ok ? await res.json() : null;
      const text: string =
        out?.candidates?.[0]?.content?.parts
          ?.map((p: { text?: string }) => p.text ?? "")
          .join("") ?? "";
      const j = JSON.parse(text) as Desk;
      const clean = (x: unknown, n: number) =>
        typeof x === "string" ? x.trim().slice(0, n) : "";
      const desk: Desk = {
        summary: clean(j.summary, 220),
        targets: d.targets.map((_, i) => ({
          desk: clean(j.targets?.[i]?.desk, 700),
          tornado: clean(j.targets?.[i]?.tornado, 260),
          hail: clean(j.targets?.[i]?.hail, 260),
          wind: clean(j.targets?.[i]?.wind, 260),
          bust: clean(j.targets?.[i]?.bust, 400),
        })),
      };
      if (desk.summary && desk.targets.every((t) => t.desk)) {
        ok = true;
        return desk;
      }
    } catch {
      // overloaded, timed out or malformed: try the next model
    } finally {
      await db.rpc("count_ai_call", { p_feature: "chase", p_ok: ok });
    }
  }
  return undefined;
}
