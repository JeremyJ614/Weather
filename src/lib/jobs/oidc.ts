import "server-only";

/**
 * GitHub Actions OIDC (post-launch A1 "cost-guard"): the scheduled jobs workflow proves who it
 * is with a short-lived token GitHub signs, so the database relay needs no shared secret.
 * Only this repository's `jobs.yml` on `main` or the default branch is accepted.
 */
const ISSUER = "https://token.actions.githubusercontent.com";
export const JOBS_AUDIENCE = "weather.sswx.space";
const REPO = "JeremyJ614/Weather";
// main (manual runs) and the default branch, which GitHub runs schedules from and is kept in
// step with main.
const REFS = ["refs/heads/main", "refs/heads/ccr-f5e0b71a-4vr2wk"];

type Jwk = JsonWebKey & { kid: string };
let keys: { at: number; list: Jwk[] } | null = null;

async function jwks(force = false) {
  if (!force && keys && Date.now() - keys.at < 3600_000) return keys.list;
  const r = await fetch(`${ISSUER}/.well-known/jwks`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`jwks ${r.status}`);
  keys = { at: Date.now(), list: ((await r.json()) as { keys: Jwk[] }).keys };
  return keys.list;
}

const b64 = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
    c.charCodeAt(0),
  );

/** True only for a valid, unexpired token from this repository's jobs workflow on main. */
export async function isJobsToken(token: string | null | undefined) {
  if (!token) return false;
  const [h, p, sig] = token.split(".");
  if (!h || !p || !sig) return false;
  try {
    const head = JSON.parse(new TextDecoder().decode(b64(h)));
    const claims = JSON.parse(new TextDecoder().decode(b64(p)));
    if (head.alg !== "RS256") return false;
    let jwk = (await jwks()).find((k) => k.kid === head.kid);
    if (!jwk) jwk = (await jwks(true)).find((k) => k.kid === head.kid);
    if (!jwk) return false;
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const ok = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      b64(sig),
      new TextEncoder().encode(`${h}.${p}`),
    );
    const now = Date.now() / 1000;
    return (
      ok &&
      claims.iss === ISSUER &&
      claims.aud === JOBS_AUDIENCE &&
      claims.repository === REPO &&
      REFS.includes(claims.ref) &&
      claims.job_workflow_ref ===
        `${REPO}/.github/workflows/jobs.yml@${claims.ref}` &&
      claims.exp > now &&
      claims.nbf <= now + 60
    );
  } catch {
    return false;
  }
}

let cached: { token: string; at: number } | null = null;
/** On Actions: a fresh OIDC token for the relay (GitHub's are short-lived; renewed every 4 min). */
export async function actionsToken() {
  if (cached && Date.now() - cached.at < 240_000) return cached.token;
  const url = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const bearer = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!url || !bearer)
    throw new Error("No GitHub OIDC token here (id-token: write?)");
  const r = await fetch(`${url}&audience=${JOBS_AUDIENCE}`, {
    headers: { Authorization: `Bearer ${bearer}` },
  });
  if (!r.ok) throw new Error(`oidc ${r.status}`);
  cached = {
    token: ((await r.json()) as { value: string }).value,
    at: Date.now(),
  };
  return cached.token;
}
