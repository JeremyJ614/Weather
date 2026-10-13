import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { unsubValid } from "@/lib/brief/unsub";

/** Mail apps' one-click unsubscribe (List-Unsubscribe-Post): stops brief emails. */
export async function POST(request: Request) {
  const q = new URL(request.url).searchParams;
  const u = q.get("u") ?? "";
  if (!unsubValid(u, q.get("s") ?? ""))
    return new Response("Invalid link", { status: 400 });
  const { error } = await supabaseAdmin()
    .from("brief_subscriptions")
    .update({ by_email: false })
    .eq("user_id", u);
  if (error) return new Response("Try again later", { status: 500 });
  return new Response("Unsubscribed from brief emails.");
}

/** A plain visit (or a link scanner) changes nothing: it opens the settings. */
export function GET(request: Request) {
  return NextResponse.redirect(new URL("/daily-brief#settings", request.url));
}
