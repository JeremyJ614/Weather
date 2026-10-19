import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import { getViewer } from "@/lib/auth/viewer";
import { getContactForms } from "@/lib/help/forms";
import { supabaseServer } from "@/lib/supabase/server";
import { ContactView } from "./ContactView";

export const metadata: Metadata = { title: "Contact Us · StormSync Weather" };

/** The owner's Contact Us forms (admin → Contact forms); messages land in admin → Contact inbox. */
export default async function Contact({
  searchParams,
}: {
  searchParams: Promise<{ about?: string; tab?: string }>;
}) {
  const [{ about, tab }, viewer, forms] = await Promise.all([
    searchParams,
    getViewer(),
    getContactForms(),
  ]);
  const { data } = viewer.signedIn
    ? await (await supabaseServer()).auth.getClaims()
    : { data: null };
  const email = data?.claims?.email;
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <PageHero
        icon={<Mail aria-hidden />}
        eyebrow={["Help"]}
        title="Contact Us"
        subtitle="Questions, ideas or a problem with your account. We read every message and reply by email."
      />
      <ContactView
        tabs={forms.tabs.filter((t) => t.on)}
        initial={tab}
        prefill={{
          name: viewer.signedIn ? (viewer.name ?? "") : "",
          email: typeof email === "string" ? email : "",
          subject: about?.slice(0, 120) ?? "",
        }}
      />
    </main>
  );
}
