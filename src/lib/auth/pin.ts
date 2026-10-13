import "server-only";
import { createHmac } from "node:crypto";

/**
 * Supabase needs long passwords, so a 4-digit PIN is never used or stored directly: the server
 * turns it into a long secret with a keyed hash (PIN_PEPPER, server-only).
 */
function pepper(): string {
  const p = process.env.PIN_PEPPER;
  if (!p || p.length < 32)
    throw new Error("PIN_PEPPER is not set on the server");
  return p;
}

export const normEmail = (email: string) => email.trim().toLowerCase();
export const validPin = (pin: string) => /^\d{4}$/.test(pin);

export function pinPassword(email: string, pin: string): string {
  return createHmac("sha256", pepper())
    .update(`pin:${normEmail(email)}:${pin}`)
    .digest("base64url");
}

export function emailHash(email: string): string {
  return createHmac("sha256", pepper())
    .update(`lockout:${normEmail(email)}`)
    .digest("base64url");
}
