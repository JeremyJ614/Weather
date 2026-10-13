import { timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { pinPassword, validPin } from "@/lib/auth/pin";

/**
 * One-time creation of the founder's account (email from app_config.founder_email) with a PIN.
 * Exists only while BOOTSTRAP_TOKEN is set; refuses once the account exists.
 */
export async function POST(req: Request) {
  const token = process.env.BOOTSTRAP_TOKEN ?? "";
  const given = req.headers.get("x-bootstrap-token") ?? "";
  if (
    token.length < 32 ||
    given.length !== token.length ||
    !timingSafeEqual(Buffer.from(given), Buffer.from(token))
  )
    return new Response(null, { status: 404 });
  const { pin } = (await req.json().catch(() => ({}))) as { pin?: string };
  if (!pin || !validPin(pin))
    return Response.json({ error: "pin" }, { status: 400 });
  const admin = supabaseAdmin();
  const { data: cfg } = await admin
    .from("app_config")
    .select("value")
    .eq("key", "founder_email")
    .single();
  const email = String(cfg?.value ?? "");
  if (!email)
    return Response.json({ error: "no founder_email" }, { status: 500 });
  const { error } = await admin.auth.admin.createUser({
    email,
    password: pinPassword(email, pin),
    email_confirm: true,
  });
  return error
    ? Response.json({ error: error.message }, { status: 409 })
    : Response.json({ ok: true });
}
