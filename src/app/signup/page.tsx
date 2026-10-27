import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/site";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";
import { SignupStart } from "./SignupStart";

export const metadata: Metadata = pageMeta(
  "/signup",
  "Sign up",
  "Create a free StormSync Weather account: live radar, SPC outlooks, alerts and storm chasing tools.",
  { noindex: true },
);

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
