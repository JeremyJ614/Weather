import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { supabaseServer } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";
import { LoginForm } from "./LoginForm";
import { ChangePin } from "./ChangePin";

export const metadata: Metadata = { title: "Sign in · StormSync Media" };

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .maybeSingle();
    if (!profile) redirect("/welcome");
  }

  return (
    <main className="mx-auto flex min-h-[75dvh] max-w-md flex-col justify-center px-4 py-10">
      <Card className="grid gap-5">
        {user ? (
          <>
            <h1 className="display text-3xl text-accent">
              You&apos;re signed in
            </h1>
            <p className="text-muted">{user.email}</p>
            <ChangePin />
            <form action="/auth/signout" method="post">
              <Button type="submit" className="w-full">
                Sign out
              </Button>
            </form>
          </>
        ) : (
          <>
            <h1 className="display text-3xl text-accent">Sign in</h1>
            {error === "link" && (
              <p className="text-sm text-accent" role="alert">
                That sign-in link expired or was already used. Send a new one.
              </p>
            )}
            <LoginForm next={safeNext(next)} />
            <p className="text-xs text-muted">
              By continuing you agree to our{" "}
              <Link href="/privacy" className="text-accent underline">
                Privacy Policy
              </Link>
              .
            </p>
          </>
        )}
      </Card>
    </main>
  );
}
