import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { ContactForm } from "@/features/contact/ContactForm";
import { getViewer } from "@/lib/auth/viewer";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Contact · StormSync Media" };

/** Write to the team; messages land in admin → Contact inbox. */
export default async function Contact({
  searchParams,
}: {
  searchParams: Promise<{ about?: string }>;
}) {
  const { about } = await searchParams;
  const viewer = await getViewer();
  const {
    data: { user },
  } = await (await supabaseServer()).auth.getUser();
  return (
    <main className="mx-auto max-w-md px-4 pt-6 pb-24">
      <Card className="grid gap-4">
        <div>
          <p className="eyebrow">StormSync Weather</p>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold">
            Contact us
          </h1>
          <p className="mt-1 text-sm text-muted">
            Questions, ideas or a problem with your account. We read every
            message.
          </p>
        </div>
        <ContactForm
          form="contact"
          name={viewer.signedIn ? (viewer.name ?? "") : ""}
          email={user?.email ?? ""}
          subject={about?.slice(0, 120) ?? ""}
        />
      </Card>
    </main>
  );
}
