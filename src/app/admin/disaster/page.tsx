import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { ORG_COLUMNS, type Org, type Volunteer } from "@/lib/disaster/data";
import { DisasterAdmin } from "./DisasterAdmin";

export const metadata: Metadata = {
  title: "Disaster Response · Admin · StormSync Media",
};

/** Listings on /disaster-response and the volunteer roster (Phase 61). */
export default async function DisasterAdminPage() {
  const { supabase } = await requireAdmin("disaster");
  const [{ data: orgs }, { data: vols }] = await Promise.all([
    supabase
      .from("disaster_orgs")
      .select(ORG_COLUMNS)
      .order("status")
      .order("sort")
      .order("name"),
    supabase
      .from("disaster_volunteers")
      .select(
        "id, status, name, email, phone, base, travel, availability, skills, org_id, note, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  return (
    <main className="mx-auto grid max-w-2xl gap-4 px-4 pt-6 pb-24">
      <h1 className="display text-3xl text-accent">Disaster Response</h1>
      <p className="text-sm text-muted">
        Organizations on the Disaster Response page and the volunteer roster.
        New sign-ups arrive in the Contact inbox, where they can be approved
        too; the person who signed up is emailed when they&apos;re approved.
        Declined sign-ups are deleted after 30 days.
      </p>
      <DisasterAdmin
        orgs={(orgs ?? []) as Org[]}
        volunteers={(vols ?? []) as Volunteer[]}
      />
    </main>
  );
}
