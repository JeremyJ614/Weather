/** SPC Mesoscale Discussion text: VIP's parser and plain-language read, ported. */

export type MdParts = {
  areas: string | null;
  prob: number | null;
  summary: string | null;
  discussion: string | null;
  hazards: ("tornado" | "hail" | "wind")[];
};

const clean = (s?: string) => s?.replace(/\s+/g, " ").trim() || null;

export function parseMd(raw: string): MdParts {
  const areas = clean(raw.match(/Areas affected\.{2,}([\s\S]*?)\n\s*\n/i)?.[1]);
  const probM = raw.match(
    /Probability of Watch Issuance\.{2,}\s*(\d+)\s*percent/i,
  );
  const summary = clean(
    raw.match(/SUMMARY\.{2,}([\s\S]*?)(?:\n\s*\n|DISCUSSION)/i)?.[1],
  );
  const discussion = clean(
    raw.match(
      /DISCUSSION\.{2,}([\s\S]*?)(?:\n\s*\n\.{2,}|\n\s*\n[A-Z][a-z]+\.{2,}|$)/i,
    )?.[1],
  );
  const lower = raw.toLowerCase();
  const hazards: MdParts["hazards"] = [];
  if (/tornad/.test(lower)) hazards.push("tornado");
  if (/hail/.test(lower)) hazards.push("hail");
  if (/(damaging|severe).{0,12}(wind|gust)|wind gust|gusts/.test(lower))
    hazards.push("wind");
  return {
    areas,
    prob: probM ? Number(probM[1]) : null,
    summary,
    discussion,
    hazards,
  };
}

/** A deterministic plain-language read of what an MD means (VIP's wording). */
export function plainRead(md: MdParts & { concerning: string }): string {
  const where = md.areas ? md.areas.replace(/\.$/, "") : "the highlighted area";
  const hz =
    md.hazards.length === 0
      ? "severe storms"
      : md.hazards.length === 1
        ? `${md.hazards[0] === "wind" ? "damaging winds" : md.hazards[0] === "hail" ? "large hail" : "tornadoes"}`
        : md.hazards
            .map((h) =>
              h === "wind"
                ? "damaging winds"
                : h === "hail"
                  ? "large hail"
                  : "tornadoes",
            )
            .join(", ")
            .replace(/, ([^,]*)$/, " and $1");
  const Hz = hz.charAt(0).toUpperCase() + hz.slice(1);
  const watch = md.concerning.match(
    /(tornado|severe thunderstorm) watch\s*(\d+)/i,
  );
  if (watch) {
    const kind = /tornado/i.test(watch[1]) ? "Tornado" : "Severe Thunderstorm";
    return `Forecasters are tracking an ongoing threat tied to ${kind} Watch ${watch[2]} across ${where}. ${Hz} are the main concern over the next 1–2 hours. If you're in the area, stay weather-aware and be ready to act if a warning is issued.`;
  }
  if (md.prob !== null) {
    const urgency =
      md.prob >= 80
        ? "very likely"
        : md.prob >= 60
          ? "likely"
          : md.prob >= 40
            ? "possible"
            : md.prob >= 20
              ? "uncertain but watched"
              : "low but non-zero";
    return `There's a ${md.prob}% chance a severe-weather watch is issued for ${where} in the next few hours (${urgency}). ${Hz} are the primary threats. Now is a good time to review your safety plan and keep notifications on.`;
  }
  return `Forecasters are highlighting a developing severe-weather concern across ${where}, with ${hz} the main threats over the next few hours. No watch is mentioned yet, but conditions are being monitored closely — keep an eye on alerts.`;
}
