import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin-guard";
import {
  getCenter,
  getRoster,
  getStats,
  getSubmissions,
} from "@/lib/sswx/store";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { SswxAdmin } from "./SswxAdmin";

export const metadata: Metadata = {
  title: "SSWX section · Admin · StormSync Media",
};
export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAdmin("members");
  const [roster, center, subs, stats, badges] = await Promise.all([
    getRoster(),
    getCenter(),
    getSubmissions(),
    getStats(),
    Promise.resolve()
      .then(() => supabaseAdmin().from("badges").select("id, name"))
      .then((r) => (r.data ?? []) as { id: string; name: string }[])
      .catch(() => []),
  ]);
  return (
    <SswxAdmin
      roster={roster}
      center={center}
      subs={subs}
      stats={stats}
      badges={badges}
    />
  );
}
