import "server-only";
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/**
 * A self-hosted "prove you're human" check (the ALTCHA idea): the server hands out a signed
 * puzzle, the browser spends about a second finding the number that solves it, and the server
 * checks the answer. No third party, no tracking, no account to set up. Puzzles expire in ten
 * minutes. The signing key is derived from PIN_PEPPER (server-only).
 */
export const CAPTCHA_MAX = 60_000;
const TTL = 600;

function key() {
  const p = process.env.PIN_PEPPER;
  if (!p || p.length < 32)
    throw new Error("PIN_PEPPER is not set on the server");
  return createHmac("sha256", p).update("captcha:v1").digest();
}
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const sign = (s: string) => createHmac("sha256", key()).update(s).digest("hex");

export type Challenge = {
  salt: string;
  challenge: string;
  signature: string;
  max: number;
};
export type Solution = Challenge & { number: number };

export function issueChallenge(now = Date.now()): Challenge {
  const salt = `${randomBytes(12).toString("hex")}.${Math.floor(now / 1000) + TTL}`;
  const number = randomBytes(4).readUInt32BE() % CAPTCHA_MAX;
  const challenge = sha(salt + number);
  return { salt, challenge, signature: sign(challenge), max: CAPTCHA_MAX };
}

/** True when the puzzle is ours, unexpired and solved. */
export function verifySolution(raw: unknown, now = Date.now()): boolean {
  const s = raw as Partial<Solution> | null;
  if (
    !s ||
    typeof s.salt !== "string" ||
    typeof s.challenge !== "string" ||
    typeof s.signature !== "string" ||
    !Number.isInteger(s.number)
  )
    return false;
  const expires = Number(s.salt.split(".")[1]);
  if (!expires || expires < now / 1000) return false;
  const want = Buffer.from(sign(s.challenge));
  const got = Buffer.from(s.signature);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return false;
  return sha(s.salt + s.number) === s.challenge;
}
