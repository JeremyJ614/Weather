import { card, type Card } from "@/features/share/card";
import type { Period } from "@/lib/patterns/data";
import type { Season } from "@/lib/patterns/season";

/**
 * Weather Patterns' two share cards (owner, 2026-11-13): what has already happened in the
 * period on screen, and the season so far. Loaded when someone taps Download or Share.
 */
const TITLE = "Weather Patterns";
const KINDS = [
  ["torn", "Tornado"],
  ["hail", "Hail"],
  ["wind", "Wind"],
] as const;
const day = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

/** Stacked report bars, per day or (past 60 days) per week, with a light axis. */
function bars(c: Card, p: Period, color: (k: string) => string) {
  const bin = p.series.length > 60 ? 7 : 1;
  const sums: { from: string; v: Record<string, number> }[] = [];
  for (let i = 0; i < p.series.length; i += bin) {
    const x = p.series.slice(i, i + bin);
    sums.push({
      from: x[0].day,
      v: Object.fromEntries(
        KINDS.map(([k]) => [k, x.reduce((a, d) => a + d[k], 0)]),
      ),
    });
  }
  const max = Math.max(1, ...sums.map((b) => b.v.torn + b.v.hail + b.v.wind));
  const g = c.g;
  const L = c.x + 56;
  const R = c.x + c.w;
  const T = c.y + 10;
  const B = c.y + 300;
  const w = (R - L) / sums.length;
  g.fillStyle = c.t.line;
  for (const f of [0, 0.5, 1]) g.fillRect(L, B - (B - T) * f, R - L, 1.5);
  c.font(600, 15);
  g.fillStyle = c.t.muted;
  g.textAlign = "right";
  for (const f of [0, 0.5, 1])
    g.fillText(String(Math.round(max * f)), L - 12, B - (B - T) * f + 5);
  g.textAlign = "left";
  sums.forEach((b, i) => {
    let y = B;
    for (const k of ["wind", "hail", "torn"] as const) {
      const h = (b.v[k] / max) * (B - T);
      y -= h;
      if (h <= 0) continue;
      g.fillStyle = color(k);
      if (k === "torn") c.glow(10, color(k));
      g.fillRect(L + i * w + w * 0.12, y, Math.max(1.5, w * 0.76), h);
      c.reset();
    }
    const prev = sums[i - 1];
    const d = new Date(`${b.from}T12:00:00Z`);
    const lab =
      p.id === "week"
        ? d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })
        : p.id === "month"
          ? i % 5 === 0
            ? day(b.from)
            : null
          : !prev || prev.from.slice(5, 7) !== b.from.slice(5, 7)
            ? d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })
            : null;
    if (lab) {
      c.font(600, 15);
      g.fillStyle = c.t.muted;
      g.textAlign = p.id === "week" ? "center" : "left";
      g.fillText(lab, L + i * w + (p.id === "week" ? w / 2 : 0), B + 26);
      g.textAlign = "left";
    }
  });
  c.y = B + 50;
  c.legend([...KINDS.map(([k, l]) => [l, color(k)] as [string, string])]);
  c.text(`Storm reports per ${bin > 1 ? "week" : "day"}`, {
    size: 16,
    color: c.t.muted,
    align: "center",
  });
}

export async function periodCard(o: {
  p: Period;
  range: string;
  color: (k: string) => string;
}) {
  const { p, color } = o;
  const c = await card(
    TITLE,
    `What has already happened · ${p.label} · ${o.range}`,
  );
  c.tiles(
    KINDS.map(([k, l]) => ({
      k: l,
      v: p[k].toLocaleString("en-US"),
      sub: "reports",
      color: color(k),
    })),
  );
  if (p.summary) {
    c.glow(22);
    c.text(p.summary.headline, {
      size: 40,
      weight: 800,
      disp: true,
      lh: 1.18,
      max: 3,
    });
    c.gap(8);
    c.text(p.summary.story, { size: 22, alpha: 0.88, max: 9 });
    c.gap(18);
    if (p.summary.highlights.length)
      c.panel("Highlights", "SSWX FORECAST DESK", () =>
        c.bullets(p.summary!.highlights, c.t.accent, 5),
      );
  }
  if (p.series.length > 1) c.panel("Day by day", null, () => bars(c, p, color));
  const facts: [string, string][] = [];
  if (p.busiest)
    facts.push([
      "Busiest day",
      `${day(p.busiest.day)} · ${p.busiest.total} reports`,
    ]);
  if (p.strongest)
    facts.push([
      "Strongest tornado",
      `${p.strongest.ef}${p.strongest.where ? ` · near ${p.strongest.where}` : ""}, ${day(p.strongest.day)}`,
    ]);
  if (p.bigHail)
    facts.push([
      "Largest hail",
      `${p.bigHail.in}″ · ${p.bigHail.where}, ${day(p.bigHail.day)}`,
    ]);
  if (p.bigGust)
    facts.push([
      "Strongest gust",
      `${p.bigGust.mph} mph · ${p.bigGust.where}, ${day(p.bigGust.day)}`,
    ]);
  if (p.id !== "yesterday")
    facts.push(["Tornado days", `${p.tornadoDays} of ${p.days} days`]);
  if (facts.length || p.topStates.length)
    c.panel("The record", null, () => {
      facts.forEach(([k, v], i) => {
        if (i) c.divider();
        c.label(k, c.t.muted);
        c.text(v, { size: 24, weight: 700, max: 2 });
      });
      if (p.topStates.length) {
        if (facts.length) c.divider();
        c.label("Where it happened", c.t.muted);
        c.chips(p.topStates.map(([st, n]) => [st, String(n)]));
      }
    });
  return c.finish(
    "Preliminary SPC storm reports, with tornadoes confirmed by NWS damage surveys added. One storm can make several reports, and counts change as offices review them.",
  );
}

export async function seasonCard(o: {
  season: Season;
  range: string;
  color: (k: string) => string;
}) {
  const { season } = o;
  const c = await card(TITLE, `Season so far · ${o.range}`);
  c.tiles(
    season.tiles.map((t) => ({
      k: t.label,
      v: t.value,
      sub: t.sub,
      color:
        t.tone === "hot"
          ? o.color("torn")
          : t.tone === "up"
            ? c.t.accent
            : undefined,
    })),
    2,
  );
  c.panel("How it's counted", null, () =>
    c.text(
      `Counted from SPC's daily storm reports (${season.days} days this year); the strongest tornado, EF3+ days, deaths and pace come from NWS damage surveys. Updated twice a day.`,
      { size: 21, alpha: 0.88 },
    ),
  );
  return c.finish(
    "Sources: SPC daily storm reports and NWS damage surveys. The forecast desk never supplies a number.",
  );
}
