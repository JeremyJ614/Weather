import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const sign = (userId: string) =>
  createHmac("sha256", `${process.env.CRON_SECRET ?? ""}:brief-unsubscribe`)
    .update(userId)
    .digest("base64url");

/** One-click unsubscribe link for a member's brief email (RFC 8058). */
export function unsubUrl(site: string, userId: string) {
  return `${site}/api/brief/unsubscribe?u=${userId}&s=${sign(userId)}`;
}

export function unsubValid(userId: string, sig: string) {
  if (!process.env.CRON_SECRET || !/^[0-9a-f-]{36}$/.test(userId)) return false;
  const a = Buffer.from(sign(userId));
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}
