import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

const TYPES = new Set([
  "signup",
  "magiclink",
  "email",
  "invite",
  "recovery",
  "email_change",
]);

/**
 * Email links land here on our own domain (a link to a different domain than
 * the sender is a spam signal), then the one-time token is verified.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") ?? "";
  const next = safeNext(url.searchParams.get("next"));
  if (token_hash && TYPES.has(type)) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as EmailOtpType,
    });
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user?.id ?? "")
        .maybeSingle();
      const to = profile ? next : `/welcome?next=${encodeURIComponent(next)}`;
      return NextResponse.redirect(new URL(to, url.origin));
    }
  }
  return NextResponse.redirect(new URL("/login?error=link", url.origin));
}
