import { toPng } from "@/features/maps/UsMap";
import { bitmap, card as base, type Card } from "@/features/share/card";
import type { ChaseDay, Target } from "@/lib/chase/engine";
import { PARAM_GROUPS, fillFor, valueOf } from "@/lib/chase/params";
import {
  BANDS,
  BUST_STEPS,
  CAT_NAMES,
  bandIndex,
  bustStep,
  derive,
  hailName,
  modeBlurb,
  type DeskNote,
} from "@/lib/chase/score";
import { ct, fmt, ten, toward } from "./ChaseParts";

/**
 * The Storm Chasing Outlook's three share cards (owner, 2026-11-13): the day (score, map and
 * briefing), the parameters behind the score, and storm mode with the bust odds. Loaded when
 * someone taps Share, never with the page.
 */
type Tone = (t: Target) => string;
const TITLE = "Storm Chasing Outlook";
const FOOT =
  "Decision support, not a substitute for SPC outlooks, watches and warnings. Chase safe, and never let a forecast talk you into a road you can't see the end of.";
// The page's own bust meter colors (Chase.module.css .bustCard).
const BUST = ["#4ade80", "#4ade80", "#facc15", "#fb923c", "#f87171"];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const dateOf = (day: ChaseDay) =>
  new Date(`${day.day}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
const light = (t: Target) =>
  t.hoursToSunset > 0 ? `${t.hoursToSunset} h of light after` : "after dark";

/** Target rank, place and score: the line every target section opens with. */
function targetHead(c: Card, t: Target, color: string, right?: string) {
  const g = c.g;
  const y = c.y;
  g.strokeStyle = color;
  g.lineWidth = 3;
  c.glow(14, color);
  g.beginPath();
  g.arc(c.x + 26, y + 30, 24, 0, Math.PI * 2);
  g.stroke();
  c.reset();
  c.font(800, 24, true);
  g.textAlign = "center";
  g.fillStyle = c.t.text;
  g.fillText(String(t.rank), c.x + 26, y + 39);
  c.reset();
  c.font(700, 14);
  c.track(3);
  g.fillStyle = c.t.muted;
  g.fillText(`TARGET ${t.rank}`, c.x + 68, y + 20);
  c.reset();
  c.font(800, 30);
  g.fillStyle = c.t.text;
  g.fillText(t.place, c.x + 68, y + 54, c.w - 220);
  g.textAlign = "right";
  c.font(800, 46, true);
  c.glow(18, color);
  g.fillStyle = color;
  g.fillText(right ?? ten(t.score), c.x + c.w, y + 46);
  c.reset();
  if (!right) {
    g.textAlign = "right";
    c.font(700, 13);
    c.track(3);
    g.fillStyle = c.t.muted;
    g.fillText("SCORE", c.x + c.w, y + 68);
    c.reset();
  }
  c.y = y + 90;
}

/** Score, targets map and the briefing. */
export async function overviewCard(o: {
  day: ChaseDay;
  tone: Tone;
  color: string;
  summary: string;
  rank: number;
}) {
  const { day, tone } = o;
  const svg = document.querySelector<SVGSVGElement>("[data-chase-map] svg");
  const map = svg ? await toPng(svg, "", "", [], true) : null;
  const t1 = day.targets[0];
  const c = await base(
    TITLE,
    `${dateOf(day)} · SPC ${CAT_NAMES[day.spcTop]}`,
    o.color,
  );
  c.hero({
    frac: t1.score / 100,
    color: o.color,
    big: ten(t1.score),
    small: "out of 10",
    kicker: "Today's chase potential",
    name: BANDS[bandIndex(t1.score)].label,
    body: o.summary,
  });
  c.tiles([
    { k: "Best target", v: t1.place.replace(/^near /, "") },
    {
      k: "Bust risk",
      v: `${t1.bust.pct}%`,
      sub: cap(BUST_STEPS[bustStep(t1.bust.pct)]),
      color: BUST[bustStep(t1.bust.pct)],
    },
    { k: "This year", v: `${o.rank} of 5`, sub: "among this year's days" },
  ]);
  if (map) {
    c.label("Today's targets", c.t.muted, "center");
    c.frame(await bitmap(map), 700);
    c.legend([
      ...day.targets.map(
        (t) =>
          [
            `${t.rank === 1 ? "Best target" : "Alternative"} · ${t.place}`,
            tone(t),
          ] as [string, string],
      ),
    ]);
  }
  c.panel("The briefing", day.desk ? "SSWX FORECAST DESK" : null, () => {
    day.targets.forEach((t, i) => {
      if (i) c.divider();
      const col = tone(t);
      targetHead(c, t, col);
      c.text(`SPC ${CAT_NAMES[t.spc.cat]} · peak ${ct(t.peak)} · ${light(t)}`, {
        size: 19,
        color: c.t.muted,
        weight: 500,
      });
      c.gap(8);
      c.bullets(t.why, col, 4);
      c.gap(4);
      c.chips(
        [
          ["CAPE", `${t.hour.cape.toLocaleString("en-US")} J/kg`],
          ["Shear", `${t.hour.shear} kt`],
          ["Helicity", `${t.hour.srh} m²/s²`],
          ["STP", String(t.hour.stp)],
          ["Tornado", `${t.spc.torn}%`],
        ],
        col,
      );
    });
    if (day.desk?.tips?.length) {
      c.divider();
      c.label("If you're going");
      c.bullets(day.desk.tips, c.t.accent, 3);
    }
    if (day.desk?.safety) {
      c.divider();
      c.label("Safety", "#f87171");
      c.text(day.desk.safety, { size: 21, alpha: 0.9, max: 4 });
    }
  });
  return c.finish(FOOT);
}

/** The rows the score is built from, in the order it weighs them. */
const KEY = [
  "cape",
  "cin",
  "shear",
  "srh",
  "srh01",
  "lcl",
  "stp",
  "scp",
  "lapse75",
];

/** The parameters behind the score, side by side for both targets. */
export async function paramsCard(o: {
  day: ChaseDay;
  tone: Tone;
  color: string;
}) {
  const { day, tone } = o;
  const [a, b] = day.targets;
  const c = await base(TITLE, "The ingredients behind today's score", o.color);
  c.tiles([
    {
      k: "Chase score",
      v: ten(a.score),
      sub: BANDS[bandIndex(a.score)].label,
      color: o.color,
    },
    {
      k: "SPC tornado odds",
      v: `${a.spc.torn}%`,
      sub: `at ${a.place.replace(/^near /, "")}`,
    },
    {
      k: "Peak hour",
      v: ct(a.peak).replace(" CT", ""),
      sub: `CT · ${light(a)}`,
    },
  ]);
  c.legend(
    day.targets.map(
      (t) => [`Target ${t.rank} · ${t.place}`, tone(t)] as [string, string],
    ),
  );
  const rows = PARAM_GROUPS.flatMap((g) => g.rows)
    .filter((r) => KEY.includes(r.id))
    .sort((x, y) => KEY.indexOf(x.id) - KEY.indexOf(y.id));
  const da = derive(a.hour);
  const db = b ? derive(b.hour) : null;
  c.panel("What drives the score", "AT THE PEAK HOUR", () => {
    let first = true;
    for (const r of rows) {
      const va = valueOf(r, a.hour, da);
      const vb = b && db ? valueOf(r, b.hour, db) : null;
      if (va == null && vb == null) continue;
      if (c.room < 260) break;
      if (!first) c.divider();
      first = false;
      const g = c.g;
      const y = c.y;
      c.font(800, 25);
      g.fillStyle = c.t.text;
      g.fillText(r.label, c.x, y + 24, c.w * 0.5);
      const lw = Math.min(c.w * 0.5, g.measureText(r.label).width);
      if (r.unit) {
        c.font(500, 17);
        g.fillStyle = c.t.muted;
        g.fillText(r.unit, c.x + lw + 10, y + 24);
      }
      // Values, right-aligned: target 2 outermost.
      let rx = c.x + c.w;
      g.textAlign = "right";
      for (const [v, t] of [
        [vb, b],
        [va, a],
      ] as const) {
        if (!t) continue;
        const col = tone(t);
        c.font(800, 32, true);
        c.glow(12, col);
        g.fillStyle = col;
        const txt = v == null ? "–" : fmt(v);
        g.fillText(txt, rx, y + 28);
        c.reset();
        g.textAlign = "right";
        if (v != null && r.read(v)) {
          c.font(600, 14);
          g.fillStyle = c.t.muted;
          g.fillText(r.read(v), rx, y + 50);
        }
        rx -= 150;
      }
      c.reset();
      c.y = y + 66;
      for (const [v, t] of [
        [va, a],
        [vb, b],
      ] as const) {
        if (!t || v == null) continue;
        c.meter(fillFor(r, v), tone(t), [], 10);
        c.gap(8);
      }
      c.gap(6);
      if (va != null && r.effect(va))
        c.text(r.effect(va), { size: 19, color: c.t.muted, max: 3 });
    }
  });
  c.panel("How the score works", null, () => {
    c.text(
      "Every afternoon hour at each candidate point is scored on instability, shear, spin, SPC's own odds, the cap, cloud bases and daylight. These are the numbers at each target's peak hour; a longer bar is better for chasing.",
      { size: 21, alpha: 0.88 },
    );
  });
  return c.finish(FOOT);
}

/** Storm mode and the bust odds for each target, with what both mean. */
export async function modeCard(o: {
  day: ChaseDay;
  tone: Tone;
  notes: DeskNote[];
  color: string;
}) {
  const { day, tone, notes } = o;
  const c = await base(TITLE, "Storm mode and bust probability", o.color);
  day.targets.forEach((t, i) => {
    const col = tone(t);
    const h = t.hour;
    const step = bustStep(t.bust.pct);
    const d = derive(h);
    c.panel(
      "Storm mode and bust risk",
      t.mode.flavor !== "n/a"
        ? `${t.mode.flavor.toUpperCase()} SUPERCELLS`
        : null,
      () => {
        targetHead(c, t, col);
        c.glow(18, col);
        c.text(t.mode.mode, {
          size: 44,
          weight: 800,
          disp: true,
          color: col,
          lh: 1.1,
          max: 2,
        });
        c.gap(4);
        c.text(modeBlurb(t.mode), { size: 20, color: c.t.muted, max: 4 });
        c.gap(6);
        c.tiles([
          {
            k: "Motion",
            v: `${h.motionMph} mph`,
            sub: `toward ${toward(h.motionTo)}`,
          },
          {
            k: "Hail",
            v: t.mode.hailIn ? `${t.mode.hailIn}″` : "–",
            sub: t.mode.hailIn ? hailName(t.mode.hailIn) : "little",
          },
          {
            k: "Peak",
            v: ct(t.peak).replace(":00", "").replace(" CT", ""),
            sub: `CT · ${t.hoursToSunset > 0 ? `${t.hoursToSunset} h light` : "after dark"}`,
          },
        ]);
        for (const [k, text] of [
          ["Tornado", notes[i].tornado],
          ["Hail", notes[i].hail],
          ["Wind", notes[i].wind],
        ] as const) {
          if (!text) continue;
          c.label(k, col);
          c.text(text, { size: 20, alpha: 0.9, max: 3 });
          c.gap(10);
        }
        c.chips(
          [
            ["Freezing level", `${h.freezingFt.toLocaleString("en-US")} ft`],
            ["Cloud base", `${d.lcl.toLocaleString("en-US")} ft`],
            ...(d.ship != null
              ? [["SHIP", d.ship.toFixed(2)] as [string, string]]
              : []),
          ],
          col,
        );
        c.divider();
        // Bust odds: the number, the meter with its steps, why.
        const g = c.g;
        const bc = BUST[step];
        const y = c.y;
        c.font(800, 72, true);
        c.glow(22, bc);
        g.fillStyle = bc;
        g.fillText(`${t.bust.pct}%`, c.x, y + 64);
        const nw = g.measureText(`${t.bust.pct}%`).width;
        c.reset();
        c.font(700, 15);
        c.track(3);
        g.fillStyle = c.t.muted;
        g.fillText("CHANCE OF A BUST", c.x + nw + 22, y + 34);
        c.reset();
        c.font(800, 26);
        g.fillStyle = c.t.text;
        g.fillText(cap(BUST_STEPS[step]), c.x + nw + 22, y + 64);
        c.y = y + 92;
        c.meter(t.bust.pct / 100, bc, [0.15, 0.3, 0.5, 0.7], 16);
        c.gap(14);
        c.font(600, 15);
        BUST_STEPS.forEach((s, k) => {
          const x = c.x + c.w * [0, 0.15, 0.3, 0.5, 0.7][k] + 4;
          g.fillStyle = k === step ? bc : c.t.muted;
          g.fillText(s.toUpperCase(), x, c.y + 14);
        });
        c.y += 40;
        if (notes[i].bust) {
          c.text(notes[i].bust, { size: 20, alpha: 0.9, max: 4 });
          c.gap(6);
        }
        const cin = Math.abs(h.cin);
        c.tiles(
          [
            {
              k: "Cap strength",
              v: `${cin} J/kg`,
              sub:
                cin >= 250
                  ? "Hard cap"
                  : cin >= 150
                    ? "Strong"
                    : cin >= 50
                      ? "In place"
                      : "Weak",
              color: cin >= 150 ? BUST[4] : undefined,
            },
            {
              k: "Large-scale lift",
              v: h.w700 != null ? `${h.w700} m/s` : "–",
              sub:
                h.w700 == null
                  ? "not in this run"
                  : h.w700 > 0.15
                    ? "Strong"
                    : h.w700 > 0.02
                      ? "Rising air"
                      : h.w700 < -0.02
                        ? "Sinking air"
                        : "Weak",
              color: (h.w700 ?? 0) < 0.02 ? BUST[4] : undefined,
            },
            {
              k: "Precip chance",
              v: `${h.pop}%`,
              sub:
                h.pop >= 60
                  ? "Good"
                  : h.pop >= 30
                    ? "Scattered"
                    : h.pop >= 20
                      ? "Low"
                      : "Very low",
              color: h.pop < 30 ? BUST[4] : undefined,
            },
            {
              k: "Daylight after peak",
              v: t.hoursToSunset > 0 ? `${t.hoursToSunset} h` : "none",
              sub:
                t.hoursToSunset >= 3
                  ? "Comfortable"
                  : t.hoursToSunset >= 1.5
                    ? "Tight"
                    : t.hoursToSunset > 0
                      ? "Racing dark"
                      : "Night chase",
              color: t.hoursToSunset < 1.5 ? BUST[4] : undefined,
            },
          ],
          2,
        );
        if (t.bust.reasons.length) c.bullets(t.bust.reasons, bc, 4);
      },
    );
  });
  c.panel("How to read this", null, () => {
    c.label("Storm mode", c.t.text);
    c.text(
      "How storms organize once they go: lone supercells, clusters or a line. It decides what they can do (tornadoes need a storm that can spin on its own) and how chaseable they are; motion, hail size and the peak hour come from the same peak-hour numbers.",
      { size: 20, alpha: 0.86 },
    );
    c.gap(12);
    c.label("Bust probability", c.t.text);
    c.text(
      "The chance you drive all that way and nothing worth seeing happens. It comes from the three ways a chase day dies: the cap never breaks, nothing lifts the air, or the storms are junk when they finally go. A high number is not hidden.",
      { size: 20, alpha: 0.86 },
    );
  });
  return c.finish(FOOT);
}

/** The card for the tab the button sits on. */
export function card(
  kind: "overview" | "params" | "mode",
  o: {
    day: ChaseDay;
    tone: Tone;
    color: string;
    notes: DeskNote[];
    summary: string;
    rank: number;
  },
) {
  return kind === "params"
    ? paramsCard(o)
    : kind === "mode"
      ? modeCard(o)
      : overviewCard(o);
}
