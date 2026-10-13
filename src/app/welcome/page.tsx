import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { supabaseServer } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";
import { SignupForm } from "./SignupForm";

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
    .maybeSingle();
  if (profile) redirect(next);

  return (
    <main className="mx-auto max-w-md px-4 pt-6 pb-24">
      <Card className="grid gap-5">
        <div>
          <h1 className="display text-3xl text-accent">Welcome to StormSync</h1>
          <p className="mt-1 text-sm text-muted">{user.email}</p>
        </div>
        <SignupForm next={next} />
      </Card>
    </main>
  );
}
