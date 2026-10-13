/**
 * SSWXCon v2: the national storm score, 0–250 (owner approved, docs/04-DECISIONS.md).
 * VIP's warning buckets, weights, caps and bands, plus a Setup bucket (SPC Day 1
 * risk and watches) so the score rises before storms fire, and extra weight for
 * the most dangerous warning tags. Pure: the same inputs give the same score.
 */

export type Alert = {
  event: string;
  params?: {
    tornadoDetection?: string;
    tornadoDamageThreat?: string;
    thunderstormDamageThreat?: string;
    flashFloodDamageThreat?: string;
  };
  /** Watch text says "PARTICULARLY DANGEROUS SITUATION" for PDS watches. */
  pds?: boolean;
};

export type SpcRisk = "TSTM" | "MRGL" | "SLGT" | "ENH" | "MDT" | "HIGH" | null;

export const GAUGE_MAX = 250;

export const SPC_POINTS: Record<string, number> = {
  MRGL: 2,
  SLGT: 5,
  ENH: 10,
  MDT: 18,
  HIGH: 30,
};

export type Component = {
  key: string;
  label: string;
  cap: number;
  score: number;
  color: string;
  desc: string;
};

const r1 = (v: number) => Math.round(v * 10) / 10;
const up = (v?: string) => (v ?? "").toUpperCase();

export function computeScore(alerts: Alert[], spc: SpcRisk) {
  const n = {
    tornado: 0,
    tornadoObserved: 0,
    tornadoPds: 0,
    tornadoEmergency: 0,
    severe: 0,
    severeConsiderable: 0,
    severeDestructive: 0,
    flash: 0,
    flashEmergency: 0,
    river: 0,
    tropical: 0,
    blizzard: 0,
    winterStorm: 0,
    redFlag: 0,
    tornadoWatch: 0,
    tornadoWatchPds: 0,
    severeWatch: 0,
  };
  for (const a of alerts) {
    const e = a.event.toLowerCase();
    const p = a.params ?? {};
    if (e === "tornado warning") {
      n.tornado++;
      if (up(p.tornadoDamageThreat) === "CATASTROPHIC") n.tornadoEmergency++;
      else if (up(p.tornadoDamageThreat) === "CONSIDERABLE") n.tornadoPds++;
      else if (up(p.tornadoDetection) === "OBSERVED") n.tornadoObserved++;
    } else if (e === "severe thunderstorm warning") {
      n.severe++;
      if (up(p.thunderstormDamageThreat) === "DESTRUCTIVE")
        n.severeDestructive++;
      else if (up(p.thunderstormDamageThreat) === "CONSIDERABLE")
        n.severeConsiderable++;
    } else if (e === "flash flood warning") {
      n.flash++;
      if (up(p.flashFloodDamageThreat) === "CATASTROPHIC") n.flashEmergency++;
    } else if (e === "flood warning") n.river++;
    else if (
      [
        "hurricane warning",
        "tropical storm warning",
        "storm surge warning",
        "extreme wind warning",
        "hurricane watch",
        "tropical storm watch",
        "storm surge watch",
        "typhoon warning",
        "typhoon watch",
      ].includes(e)
    )
      n.tropical++;
    else if (e === "blizzard warning") n.blizzard++;
    else if (e === "winter storm warning" || e === "ice storm warning")
      n.winterStorm++;
    else if (e === "red flag warning") n.redFlag++;
    else if (e === "tornado watch") {
      n.tornadoWatch++;
      if (a.pds) n.tornadoWatchPds++;
    } else if (e === "severe thunderstorm watch") n.severeWatch++;
  }

  // Warning buckets: VIP's weights, plus extra for the dangerous tags.
  const tornado = r1(
    Math.min(
      120,
      n.tornado * 4 +
        n.tornadoObserved * 4 +
        n.tornadoPds * 8 +
        n.tornadoEmergency * 36,
    ),
  );
  const severe = r1(
    Math.min(70, n.severe + n.severeConsiderable * 1 + n.severeDestructive * 2),
  );
  const flood = r1(
    Math.min(40, n.flash + n.flashEmergency * 4 + n.river * 0.25),
  );
  const tropical = r1(Math.min(90, n.tropical * 6));
  const winter = r1(Math.min(40, n.blizzard * 4 + n.winterStorm * 0.5));
  const fire = r1(Math.min(15, n.redFlag * 0.5));
  // Setup: the day's SPC risk and the watches out ahead of the storms.
  const outlook = spc ? (SPC_POINTS[spc] ?? 0) : 0;
  const setup = r1(
    Math.min(
      30,
      outlook +
        (n.tornadoWatch - n.tornadoWatchPds) * 2 +
        n.tornadoWatchPds * 5 +
        n.severeWatch,
    ),
  );

  const tags = (list: [number, string][]) =>
    list
      .filter(([k]) => k > 0)
      .map(([k, w]) => `${k} ${w}`)
      .join(" · ");
  const components: Component[] = [
    {
      key: "tornado",
      label: "Tornado warnings",
      cap: 120,
      score: tornado,
      color: "#ef4444",
      desc:
        tags([
          [n.tornado, "active"],
          [n.tornadoEmergency, "emergency"],
          [n.tornadoPds, "PDS"],
          [n.tornadoObserved, "observed"],
        ]) || "None active",
    },
    {
      key: "severe",
      label: "Severe thunderstorm",
      cap: 70,
      score: severe,
      color: "#f97316",
      desc:
        tags([
          [n.severe, "active"],
          [n.severeDestructive, "destructive"],
          [n.severeConsiderable, "considerable"],
        ]) || "None active",
    },
    {
      key: "tropical",
      label: "Tropical",
      cap: 90,
      score: tropical,
      color: "#a855f7",
      desc: n.tropical ? `${n.tropical} watches and warnings` : "None active",
    },
    {
      key: "flood",
      label: "Flood",
      cap: 40,
      score: flood,
      color: "#38bdf8",
      desc:
        tags([
          [n.flash, "flash"],
          [n.flashEmergency, "emergency"],
          [n.river, "river"],
        ]) || "None active",
    },
    {
      key: "winter",
      label: "Winter",
      cap: 40,
      score: winter,
      color: "#67e8f9",
      desc:
        tags([
          [n.blizzard, "blizzard"],
          [n.winterStorm, "winter/ice storm"],
        ]) || "None active",
    },
    {
      key: "setup",
      label: "Setup",
      cap: 30,
      score: setup,
      color: "#4ade80",
      desc: [
        spc && spc !== "TSTM" ? `SPC ${spc} risk` : "No SPC severe risk",
        tags([
          [n.tornadoWatch, "tornado watches"],
          [n.tornadoWatchPds, "PDS"],
          [n.severeWatch, "severe watches"],
        ]),
      ]
        .filter(Boolean)
        .join(" · "),
    },
    {
      key: "fire",
      label: "Fire",
      cap: 15,
      score: fire,
      color: "#fbbf24",
      desc: n.redFlag ? `${n.redFlag} red flag warnings` : "None active",
    },
  ];
  const total = r1(components.reduce((a, c) => a + c.score, 0));
  return { total, components, counts: n };
}

export type Band = { min: number; label: string; color: string };

/** VIP's bands, unchanged. */
export const BANDS: Band[] = [
  { min: 0, label: "Quiet / Low", color: "#4ade80" },
  { min: 30, label: "Notable", color: "#fbbf24" },
  { min: 50, label: "Elevated", color: "#f97316" },
  { min: 70, label: "Significant", color: "#ef4444" },
  { min: 90, label: "Severe Outbreak", color: "#cc2222" },
  { min: 120, label: "Major Event", color: "#e03030" },
  { min: 150, label: "Extreme", color: "#ff3333" },
  { min: 250, label: "Historic", color: "#ff0000" },
];

export const bandFor = (score: number) =>
  [...BANDS].reverse().find((b) => score >= b.min) ?? BANDS[0];

/** One sentence on what is driving the score, from the components that fired. */
export function describe(components: Component[], total: number): string {
  const live = components
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!live.length)
    return "No warning-level weather and no organized severe setup anywhere in the country right now.";
  const share = (c: Component) => Math.round((c.score / total) * 100);
  const parts = [
    `${live[0].label.toLowerCase()} carries ${share(live[0])}% of it (${live[0].desc})`,
  ];
  if (live[1])
    parts.push(`${live[1].label.toLowerCase()} adds ${share(live[1])}%`);
  const rest = live.length - Math.min(2, live.length);
  return `${parts.join(", and ")}${rest > 0 ? `, with ${rest} smaller ${rest === 1 ? "bucket" : "buckets"} behind them` : ""}.`;
}
