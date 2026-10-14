import type { Metadata } from "next";
import Link from "next/link";
import { History, Vote } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PageHero } from "@/components/ui/PageHero";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { HomeTabs } from "@/features/news/HomeTabs";
import { getViewer } from "@/lib/auth/viewer";
import { getSiteDefaults } from "@/lib/settings";
import { supabaseServer } from "@/lib/supabase/server";
import { PastPolls, ThisWeek, type Poll } from "./PollsView";
import s from "./Polls.module.css";

export const metadata: Metadata = { title: "Weekly Polls · StormSync Media" };

export default async function WeeklyPolls() {
  const [viewer, { disabled }] = await Promise.all([
    getViewer(),
    getSiteDefaults(),
  ]);
  const hero = (
    <PageHero
      icon={<Vote aria-hidden />}
      eyebrow={["Community", "A new question every Monday"]}
      title="Weekly Polls"
      subtitle="One question a week from the StormSync team. Cast your vote, then see how everyone else called it."
    />
  );
  let body;
  if (disabled.includes("polls")) body = <ModuleOff label="Weekly Polls" />;
  else if (!viewer.signedIn)
    body = (
      <section className={s.signin}>
        <p>Sign in to vote and see the results.</p>
        <Link href="/login?next=/weekly-polls">
          <Button variant="primary">Sign in</Button>
        </Link>
      </section>
    );
  else {
    const sb = await supabaseServer();
    const { data } = viewer.lens
      ? await sb.rpc("lens_poll_list", { p_user: viewer.id! })
      : await sb.rpc("poll_list");
    const polls = (data ?? []) as Poll[];
    body = (
      <HomeTabs
        variant="arcade"
        label="Polls"
        tabs={[
          {
            id: "poll-now",
            label: "This Week",
            sub: "Vote, then see results",
            icon: <Vote aria-hidden />,
            panel: <ThisWeek polls={polls} />,
          },
          {
            id: "poll-past",
            label: "Past Polls",
            sub: "How everyone called it",
            icon: <History aria-hidden />,
            panel: <PastPolls polls={polls} />,
          },
        ]}
      />
    );
  }
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      {hero}
      {body}
    </main>
  );
}
