import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { getViewer } from "@/lib/auth/viewer";
import { StepUp } from "./StepUp";

export const metadata: Metadata = {
  title: "Confirm it's you · StormSync Media",
};

/** Admins signed in with only a PIN confirm with Google or an email link first. */
export default async function Verify() {
  const viewer = await getViewer();
  if (!viewer.isAdmin) notFound();
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-md flex-col justify-center px-4">
      <Card className="grid gap-4">
        <h1 className="display text-3xl text-accent">Confirm it&apos;s you</h1>
        <p className="text-sm text-muted">
          A PIN alone can&apos;t open the admin panel. Sign in again with Google
          or an email link to continue.
        </p>
        <StepUp />
      </Card>
    </main>
  );
}
