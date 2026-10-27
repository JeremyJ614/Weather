import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/site";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { supabaseServer } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";
import { getViewer } from "@/lib/auth/viewer";
import { ShieldCheck } from "lucide-react";
import { LoginForm } from "./LoginForm";
import { ChangePin } from "./ChangePin";
import { BadgePlate } from "@/components/BadgeIcon";
import { getColors } from "@/lib/colors/server";

export const metadata: Metadata = pageMeta(
  "/login",
  "Sign in",
  "Log in to StormSync Weather.",
  { noindex: true },
);

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const viewer = await getViewer();
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile) redirect("/welcome");
  }
  const [{ data: earned }, colors] = user
    ? await Promise.all([
        supabase
          .from("member_badges")
          .select("badges(name, icon, rarity)")
          .eq("user_id", user.id),
        getColors(),
      ])
    : [{ data: null }, {}];
  const badges = (earned ?? []).flatMap((e) =>
    e.badges
      ? [e.badges as unknown as { name: string; icon: string; rarity: string }]
      : [],
  );

  return (
    <main className="mx-auto flex min-h-[75dvh] max-w-md flex-col justify-center px-4 py-10">
      <Card className="grid gap-5">
        {user ? (
          <>
            <div>
              <p className="eyebrow">Your account</p>
              <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold">
                You&apos;re signed in
              </h1>
            </div>
            <p className="text-muted">{user.email}</p>
            {badges.length > 0 && (
              <div className="grid gap-2">
                <b className="text-sm">Your badges</b>
                <ul className="flex flex-wrap gap-2">
                  {badges.map((b) => (
                    <li key={b.name}>
                      <BadgePlate badge={b} colors={colors} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {viewer.isAdmin && (
              <Link href="/admin">
                <Button variant="primary" className="w-full">
                  <ShieldCheck className="size-4" aria-hidden /> Open the Admin
                  Panel
                </Button>
              </Link>
            )}
            <ChangePin />
            <form action="/auth/signout" method="post">
              <Button type="submit" className="w-full">
                Sign out
              </Button>
            </form>
          </>
        ) : (
          <>
            <div>
              <p className="eyebrow">SSWX Weather Center</p>
              <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold">
                Sign in
              </h1>
            </div>
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
      <p className="mt-4 text-center text-sm text-muted">
        Need help?{" "}
        <Link href="/contact" className="text-accent underline">
          Contact us
        </Link>
      </p>
    </main>
  );
}
