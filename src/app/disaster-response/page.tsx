import type { Metadata } from "next";
import { HeartHandshake } from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import { getViewer } from "@/lib/auth/viewer";
import { supabaseServer } from "@/lib/supabase/server";
import { ORG_COLUMNS, type Org } from "@/lib/disaster/data";
import { Directory } from "@/features/disaster/Directory";

export const metadata: Metadata = {
  title: "Disaster Response · StormSync Weather",
};

/**
 * Disaster Response (Phase 61, open to guests): organizations that help after storms and a
 * form to list an organization. Sign-ups wait in admin → Contact inbox until approved.
 */
export default async function DisasterResponse({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ tab }, viewer, sb] = await Promise.all([
    searchParams,
    getViewer(),
    supabaseServer(),
  ]);
  const [{ data }, claims] = await Promise.all([
    sb
      .from("disaster_orgs")
      .select(ORG_COLUMNS)
      .eq("status", "approved")
      .order("sort")
      .order("name"),
    viewer.signedIn ? sb.auth.getClaims() : Promise.resolve(null),
  ]);
  const email = claims?.data?.claims?.email;
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <PageHero
        icon={<HeartHandshake aria-hidden />}
        eyebrow={["Community"]}
        title="Disaster Response"
        subtitle="Groups that help after storms, and how to give to them or help with them."
      />
      <Directory
        orgs={(data ?? []) as Org[]}
        initial={tab}
        prefill={{
          name: viewer.signedIn ? (viewer.name ?? "") : "",
          email: typeof email === "string" ? email : "",
        }}
      />
    </main>
  );
}
