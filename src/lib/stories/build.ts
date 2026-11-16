import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SITE } from "@/lib/seo/site";

/**
 * Web Stories (post-launch A9, B8): tap-through stories in Google's Web Stories format for each
 * Tornado Archive event (evergreen) and, on big severe days, today's outlook. Built from data the
 * app already has; rendered as AMP by app/web-stories/[id]/route.ts.
 */
export type Slide =
  | { kind: "cover"; eyebrow: string; title: string; sub: string; img: string }
  | {
      kind: "image";
      title: string;
      text: string;
      img: string;
      w: number;
      h: number;
    }
  | { kind: "text"; title: string; text: string }
  | {
      kind: "facts";
      title: string;
      facts: { label: string; value: string; note?: string }[];
    }
  | { kind: "cta"; title: string; text: string; href: string; label: string };
export type Story = {
  id: string;
  title: string;
  description: string;
  published: string;
  poster: string;
  slides: Slide[];
};

type Event = {
  id: string;
  name: string;
  region: string;
  blurb: string;
  strongest?: string;
  count?: number;
  fatalities?: number;
  surveyed?: boolean;
};
type EventFile = {
  name: string;
  region: string;
  blurb: string;
  story?: string[];
  facts?: { label: string; value: string; note?: string }[];
  torn?: { ef: string; lengthMi?: number; coords: [number, number][] }[];
};

const root = join(process.cwd(), "public", "archive");
export async function archiveIndex(): Promise<Event[]> {
  return JSON.parse(await readFile(join(root, "index.json"), "utf8"));
}
export async function archiveEvent(id: string): Promise<EventFile | null> {
  if (!/^[\w-]+$/.test(id)) return null;
  return readFile(join(root, `${id}.json`), "utf8")
    .then((t) => JSON.parse(t) as EventFile)
    .catch(() => null);
}

const dateOf = (id: string) =>
  new Date(`${id.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
const trim = (s: string, n = 300) =>
  s.length <= n ? s : `${s.slice(0, s.lastIndexOf(" ", n))}…`;

async function eventStory(e: Event): Promise<Story | null> {
  const f = await archiveEvent(e.id);
  if (!f) return null;
  const torn = f.torn ?? [];
  const longest = torn.reduce((a, t) => Math.max(a, t.lengthMi ?? 0), 0);
  const img = (k: string) => `${SITE.url}/web-stories/${e.id}/image?k=${k}`;
  const slides: Slide[] = [
    {
      kind: "cover",
      eyebrow: `${dateOf(e.id)} · ${f.region}`,
      title: f.name,
      sub: [
        e.strongest ? `${e.strongest}` : null,
        torn.length > 1 ? `${torn.length} tornadoes` : null,
        e.fatalities ? `${e.fatalities} killed` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      img: img("cover"),
    },
    {
      kind: "image",
      title: torn.length > 1 ? "Every track" : "The track",
      text:
        torn.length > 1
          ? `${torn.length} tornadoes${longest ? `; the longest ran ${Math.round(longest)} miles` : ""}.`
          : longest
            ? `${Math.round(longest)} miles on the ground.`
            : f.blurb,
      img: img("map"),
      w: 720,
      h: 1280,
    },
    ...(f.story ?? []).slice(0, 3).map((p, i): Slide => ({
      kind: "text",
      title: i ? "" : "What happened",
      text: trim(p),
    })),
  ];
  if (f.facts?.length)
    slides.push({
      kind: "facts",
      title: "By the numbers",
      facts: f.facts.slice(0, 4),
    });
  slides.push({
    kind: "cta",
    title: "Relive it",
    text: "Replay the day minute by minute: radar, warnings and every surveyed track, in 3D.",
    href: `${SITE.url}/tornado-archive?e=${encodeURIComponent(e.id)}`,
    label: "Open the replay",
  });
  return {
    id: e.id,
    title: `${f.name}, ${dateOf(e.id)}`,
    description: trim(f.blurb, 160),
    published: `${e.id.slice(0, 10)}T12:00:00Z`,
    poster: img("poster"),
    slides,
  };
}

const RISK: Record<string, string> = {
  ENH: "Enhanced risk",
  MDT: "Moderate risk",
  HIGH: "High risk",
};
/** Today's big severe day (SPC Day 1 Enhanced or higher), or null on a quiet day. */
export async function severeToday(): Promise<Story | null> {
  const r = await fetch(
    "https://www.spc.noaa.gov/products/outlook/day1otlk_cat.nolyr.geojson",
    { next: { revalidate: 900 }, signal: AbortSignal.timeout(15000) },
  ).catch(() => null);
  if (!r?.ok) return null;
  const d = (await r.json()) as {
    features: { properties: { LABEL?: string } }[];
  };
  const order = ["TSTM", "MRGL", "SLGT", "ENH", "MDT", "HIGH"];
  const top = d.features
    .map((f) => order.indexOf(String(f.properties.LABEL)))
    .reduce((a, b) => Math.max(a, b), -1);
  if (top < 3) return null;
  const label = RISK[order[top]];
  const html = await fetch(
    "https://www.spc.noaa.gov/products/outlook/day1otlk.html",
    {
      next: { revalidate: 900 },
      signal: AbortSignal.timeout(15000),
    },
  )
    .then((x) => (x.ok ? x.text() : ""))
    .catch(() => "");
  const summary =
    html
      .match(/\.\.\.SUMMARY\.\.\.\s*([\s\S]*?)\n\s*\n/)?.[1]
      ?.replace(/\s+/g, " ")
      .trim() ?? "";
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/Chicago",
  });
  const spc = "https://www.spc.noaa.gov/products/outlook";
  return {
    id: "severe-today",
    title: `Severe storms today: ${label}`,
    description: summary
      ? trim(summary, 160)
      : `The Storm Prediction Center has an ${label} out for ${today}.`,
    published: new Date().toISOString(),
    poster: `${SITE.url}/web-stories/severe-today/image?k=poster`,
    slides: [
      {
        kind: "cover",
        eyebrow: today,
        title: `Severe storms today`,
        sub: `SPC ${label}`,
        img: `${SITE.url}/web-stories/severe-today/image?k=cover`,
      },
      {
        kind: "image",
        title: "The outlook",
        text: summary ? trim(summary, 240) : label,
        img: `${spc}/day1otlk.png`,
        w: 815,
        h: 555,
      },
      {
        kind: "image",
        title: "Tornado chances",
        text: "The chance of a tornado within 25 miles of a point.",
        img: `${spc}/day1probotlk_torn.png`,
        w: 815,
        h: 555,
      },
      {
        kind: "image",
        title: "Damaging wind",
        text: "The chance of 58 mph or stronger gusts within 25 miles.",
        img: `${spc}/day1probotlk_wind.png`,
        w: 815,
        h: 555,
      },
      {
        kind: "image",
        title: "Large hail",
        text: "The chance of hail an inch or larger within 25 miles.",
        img: `${spc}/day1probotlk_hail.png`,
        w: 815,
        h: 555,
      },
      {
        kind: "text",
        title: "Be ready",
        text: "Know where you'll shelter: the lowest floor, an interior room, away from windows. Keep two ways to get warnings, and charge your phone before storms arrive.",
      },
      {
        kind: "cta",
        title: "Follow it live",
        text: "Live radar, warnings, the SSWXCon Score and the storm chasing outlook, free.",
        href: `${SITE.url}/spc-probability`,
        label: "Open StormSync Weather",
      },
    ],
  };
}

/** Every story there is right now: today's (if any) first, then the archive's, newest first. */
export async function allStories(): Promise<Story[]> {
  const [today, list] = await Promise.all([severeToday(), archiveIndex()]);
  const events = (
    await Promise.all(
      [...list]
        .sort((a, b) => b.id.localeCompare(a.id))
        .map((e) => eventStory(e)),
    )
  ).filter((s): s is Story => !!s);
  return today ? [today, ...events] : events;
}

export async function storyById(id: string): Promise<Story | null> {
  if (id === "severe-today") return severeToday();
  const e = (await archiveIndex()).find((x) => x.id === id);
  return e ? eventStory(e) : null;
}
