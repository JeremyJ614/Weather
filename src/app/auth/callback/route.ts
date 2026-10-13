import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

/** Google and email-link sign-ins land here with a one-time code. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .maybeSingle();
      const to = profile ? next : `/welcome?next=${encodeURIComponent(next)}`;
      return NextResponse.redirect(new URL(to, url.origin));
    }
  }
  return NextResponse.redirect(new URL("/login?error=link", url.origin));
}
