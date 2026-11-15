/**
 * A small per-visitor speed limit for the public data routes (post-launch A1, "rate-limit"):
 * a fixed one-minute window per IP and bucket, kept in the function instance's memory. Fluid
 * compute reuses instances, so a script hammering a route meets the same counter; the CDN
 * answers repeat requests before they reach us, so only cache misses count. Free, no service.
 */
import { track } from "@/lib/ops/usage";

type Window = { n: number; t: number };

const hits = new Map<string, Window>();
const MINUTE = 60_000;
const MAX_KEYS = 20_000;

/** Requests a visitor may make per minute, by kind of route. */
export const LIMITS = {
  /** Map and image frames (a loop or a scrub asks for many at once). */
  frames: 300,
  /** Routes that compute on our server (engines, soundings, history, archive). */
  heavy: 90,
  /** Everything else. */
  normal: 180,
} as const;

function ipOf(req: Request) {
  const fwd = req.headers.get("x-forwarded-for");
  return (
    fwd ? fwd.split(",")[0] : (req.headers.get("x-real-ip") ?? "")
  ).trim();
}

function prune(now: number) {
  if (hits.size < MAX_KEYS) return;
  for (const [k, w] of hits) if (now - w.t > MINUTE) hits.delete(k);
  // Still full (a flood of distinct addresses): start over rather than grow without bound.
  if (hits.size >= MAX_KEYS) hits.clear();
}

/**
 * Counts this request. Returns a friendly 429 when the visitor is over the limit, else null.
 * Call it first in a route: `const slow = limited(req, "engines"); if (slow) return slow;`.
 */
export function limited(
  req: Request,
  bucket: string,
  perMinute: number = LIMITS.normal,
  now = Date.now(),
): Response | null {
  track(bucket, now);
  const ip = ipOf(req);
  if (!ip) return null;
  const key = `${bucket}|${ip}`;
  const w = hits.get(key);
  if (!w || now - w.t >= MINUTE) {
    hits.set(key, { n: 1, t: now });
    prune(now);
    return null;
  }
  w.n += 1;
  if (w.n <= perMinute) return null;
  const wait = Math.max(1, Math.ceil((MINUTE - (now - w.t)) / 1000));
  return Response.json(
    {
      error:
        "Slow down a little: lots of requests came from your connection in the last minute. Try again shortly.",
      retryAfter: wait,
    },
    {
      status: 429,
      headers: { "Retry-After": String(wait), "Cache-Control": "no-store" },
    },
  );
}

/** For tests. */
export function resetLimits() {
  hits.clear();
}
