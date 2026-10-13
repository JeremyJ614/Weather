import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { supabaseServer } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";
import { SignupForm } from "./SignupForm";
import { getSignupForm } from "@/lib/auth/signup-form";

export const metadata: Metadata = { title: "Welcome · StormSync Media" };

/** First sign-in: the signup form. Anyone who already has a profile goes on. */
export default async function Welcome({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNext((await searchParams).next);
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
  if (profile) redirect(next);

  return (
    <main className="mx-auto max-w-md px-4 pt-6 pb-24">
      <Card className="grid gap-5">
        <div>
          <p className="eyebrow">Create your account</p>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold">
            Welcome to StormSync
          </h1>
          <p className="mt-1 text-sm text-muted">{user.email}</p>
        </div>
        <SignupForm next={next} form={await getSignupForm()} />
      </Card>
    </main>
  );
}
