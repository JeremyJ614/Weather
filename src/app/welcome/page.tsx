import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/site";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";
import { InteractiveForm } from "./InteractiveForm";
import { getSignupForm } from "@/lib/auth/signup-form";

export const metadata: Metadata = pageMeta(
  "/welcome",
  "Welcome",
  "Welcome to StormSync Weather.",
  { noindex: true },
);

/** First sign-in: the signup form. Anyone who already has a profile goes on. */
export default async function Welcome({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const raw = (await searchParams).next;
  // A new account always lands on Plans & Pricing next (keeping a plan picked there).
  const next = raw?.startsWith("/join") ? safeNext(raw) : "/join";
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/welcome")}`);
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (profile) redirect(safeNext(raw));

  return (
    <main>
      <InteractiveForm
        form={await getSignupForm()}
        next={next}
        email={user.email ?? ""}
      />
    </main>
  );
}
