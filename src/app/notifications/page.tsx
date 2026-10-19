import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import { getViewer } from "@/lib/auth/viewer";
import { supabaseServer } from "@/lib/supabase/server";
import { NotifyView, type NotifyData } from "./NotifyView";

export const metadata: Metadata = { title: "Notifications · StormSync Media" };
export const dynamic = "force-dynamic";

/** Notifications: every alert type as a switch, quiet hours, devices, and recent alerts. */
export default async function Notifications() {
  const viewer = await getViewer();
  const hero = (
    <PageHero
      icon={<Bell aria-hidden />}
      eyebrow={["Account"]}
      title="Notifications"
      subtitle="Choose every alert you want, where it's for, and when it may buzz."
    />
  );
  if (!viewer.signedIn)
    return (
      <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
        {hero}
        <Link href="/login" className="text-accent underline">
          Log in or sign up
        </Link>
      </main>
    );
  const supabase = await supabaseServer();
  const [prefs, sent, brief] = await Promise.all([
    supabase
      .from("notify_prefs")
      .select("topics, label, lat, lon, quiet_from, quiet_to")
      .eq("user_id", viewer.id!)
      .maybeSingle(),
    supabase
      .from("notify_sent")
      .select("topic, key, title, body, url, pushed, sent_at")
      .eq("user_id", viewer.id!)
      .order("sent_at", { ascending: false })
      .limit(40),
    supabase
      .from("brief_subscriptions")
      .select("label, send_hour, by_email, by_push")
      .eq("user_id", viewer.id!)
      .maybeSingle(),
  ]);
  const data: NotifyData = {
    prefs: prefs.data ?? null,
    inbox: sent.data ?? [],
    brief: brief.data ?? null,
  };
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      {hero}
      <NotifyView data={data} />
    </main>
  );
}
