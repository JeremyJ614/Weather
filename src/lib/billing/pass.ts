/**
 * The Storm Day Pass as a signed cookie (post-launch A4): `<user>.<until ms>.<signature>`,
 * HMAC-SHA256 with a server secret. The proxy checks it without a database round trip, so a
 * pass holder walks past plan locks until it runs out. Web Crypto only, so it runs anywhere.
 */
export const PASS_COOKIE = "sswx-pass";

function secret() {
  return (
    process.env.DAY_PASS_SECRET ||
    process.env.PIN_PEPPER ||
    process.env.CRON_SECRET ||
    ""
  );
}

async function hmac(text: string, key: string) {
  const k = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    k,
    new TextEncoder().encode(text),
  );
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** A cookie value for this user until `until`, or null when no secret is set. */
export async function signPass(user: string, until: number, key = secret()) {
  if (!key) return null;
  const body = `${user}.${Math.round(until)}`;
  return `${body}.${await hmac(body, key)}`;
}

/** True while the cookie is genuine, this user's, and not yet expired. */
export async function passValid(
  value: string | undefined,
  user: string,
  now = Date.now(),
  key = secret(),
) {
  if (!value || !key) return false;
  const [u, until, sig] = value.split(".");
  if (u !== user || !until || !sig || Number(until) <= now) return false;
  return (await hmac(`${u}.${until}`, key)) === sig;
}
