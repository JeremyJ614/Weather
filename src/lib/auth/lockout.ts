/** PIN lockout rules: 5 wrong PINs locks sign-in for 15 minutes, doubling each time (max 24 h). */
export const MAX_FAILURES = 5;
const BASE_MS = 15 * 60_000;
const CAP_MS = 24 * 3_600_000;

export type Attempts = {
  failures: number;
  locks: number;
  locked_until: string | null;
};
export const FRESH: Attempts = { failures: 0, locks: 0, locked_until: null };

export function lockedUntil(
  a: Attempts | null,
  now = Date.now(),
): number | null {
  const t = a?.locked_until ? Date.parse(a.locked_until) : 0;
  return t > now ? t : null;
}

export function afterFailure(a: Attempts | null, now = Date.now()): Attempts {
  const cur = a ?? FRESH;
  const failures = cur.failures + 1;
  if (failures < MAX_FAILURES) return { ...cur, failures, locked_until: null };
  const locks = cur.locks + 1;
  const ms = Math.min(BASE_MS * 2 ** (locks - 1), CAP_MS);
  return { failures: 0, locks, locked_until: new Date(now + ms).toISOString() };
}
