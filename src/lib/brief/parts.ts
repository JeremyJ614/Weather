import type { Hour } from "@/lib/weather/types";

export type PartName = "Morning" | "Afternoon" | "Evening" | "Overnight";
export type Part = {
  name: PartName;
  hi: number;
  lo: number;
  pop: number;
  short: string;
  isDay: boolean;
};

const bucket = (h: number): PartName =>
  h < 6 ? "Overnight" : h < 12 ? "Morning" : h < 18 ? "Afternoon" : "Evening";

/** The next 24 hours as day parts (in the order they come), from the place's local clock. */
export function dayParts24(hours: Hour[], timeZone: string): Part[] {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hourCycle: "h23",
  });
  const out: (Part & { hours: Hour[] })[] = [];
  for (const h of hours.slice(0, 24)) {
    const name = bucket(Number(fmt.format(new Date(h.start))));
    let p = out.at(-1);
    if (!p || p.name !== name) {
      p = {
        name,
        hi: h.temp,
        lo: h.temp,
        pop: 0,
        short: h.short,
        isDay: h.isDay,
        hours: [],
      };
      out.push(p);
    }
    p.hours.push(h);
    p.hi = Math.max(p.hi, h.temp);
    p.lo = Math.min(p.lo, h.temp);
    p.pop = Math.max(p.pop, h.pop ?? 0);
  }
  return out
    .filter((p) => p.hours.length >= 2)
    .slice(0, 4)
    .map(({ hours: hs, ...p }) => {
      const mid = hs[Math.floor(hs.length / 2)];
      return { ...p, short: mid.short, isDay: mid.isDay };
    });
}
