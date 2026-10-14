import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";
import { SignupStart } from "./SignupStart";

export const metadata: Metadata = { title: "Sign up · StormSync Media" };

/** Step one of signup: verify an email (link or Google), then the question-by-question form. */
export default async function Signup({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const raw = (await searchParams).next;
  const next = raw?.startsWith("/join") ? safeNext(raw) : "/join";
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(`/welcome?next=${encodeURIComponent(next)}`);
  return <SignupStart next={`/welcome?next=${encodeURIComponent(next)}`} />;
}
