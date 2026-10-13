/**
 * Device tier: how much visual effect this phone can afford.
 * Static hints give a first answer; a frame-rate probe may only lower it.
 */
export type Tier = "high" | "mid" | "low";

export interface Hints {
  memoryGb?: number;
  cores?: number;
  saveData?: boolean;
  reducedMotion?: boolean;
}

export function tierFromHints(h: Hints): Tier {
  if (h.reducedMotion || h.saveData) return "low";
  const mem = h.memoryGb ?? 4;
  const cores = h.cores ?? 4;
  if (mem <= 2 || cores <= 2) return "low";
  if (mem <= 4 || cores <= 4) return "mid";
  return "high";
}

/** Lower the tier when measured frame rate is poor. Never raises it. */
export function demote(tier: Tier, fps: number): Tier {
  const order: Tier[] = ["low", "mid", "high"];
  const measured: Tier = fps < 30 ? "low" : fps < 50 ? "mid" : "high";
  return order[Math.min(order.indexOf(tier), order.indexOf(measured))];
}
