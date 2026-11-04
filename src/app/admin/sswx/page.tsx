import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { getCenter, getRoster, getSubmissions } from "@/lib/sswx/store";
import { SswxAdmin } from "./SswxAdmin";

export const metadata: Metadata = {
  title: "SSWX section · Admin · StormSync Media",
};
export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAdmin("members");
  const [roster, center, subs] = await Promise.all([
    getRoster(),
    getCenter(),
    getSubmissions(),
  ]);
  return <SswxAdmin roster={roster} center={center} subs={subs} />;
}
