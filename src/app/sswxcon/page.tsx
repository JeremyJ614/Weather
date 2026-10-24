import type { Metadata } from "next";
import { BookOpen, Gauge, LineChart } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { PageHero } from "@/components/ui/PageHero";
import { HomeTabs } from "@/features/news/HomeTabs";
import { getSiteDefaults } from "@/lib/settings";
import { nationalScore, recentSnaps } from "@/lib/sswxcon/live";
import { BANDS, SPC_POINTS } from "@/lib/sswxcon/score";
import { supabaseServer } from "@/lib/supabase/server";
import { ConView } from "./ConView";
import { LocalCard } from "./Local";
import { Ladder, Trend } from "./Trend";
import s from "./Con.module.css";

export const metadata: Metadata = { title: "SSWXCon Score · StormSync Media" };

const WEIGHTS: [string, string, number][] = [
  [
    "Tornado warning",
    "4 each · observed 8 · PDS 12 · Tornado Emergency 40",
    120,
  ],
  [
    "Severe thunderstorm warning",
    "1 each · considerable 2 · destructive 3",
    70,
  ],
  [
    "Tropical watch or warning",
    "6 each (hurricane, tropical storm, storm surge, extreme wind)",
    90,
  ],
  ["Flood", "flash 1 · Flash Flood Emergency 5 · river 0.25", 40],
  ["Winter", "blizzard warning 4 · winter or ice storm warning 0.5", 40],
  [
    "Setup",
    `SPC Day 1: ${Object.entries(SPC_POINTS)
      .map(([k, v]) => `${k} ${v}`)
      .join(" · ")}; tornado watch 2 (PDS 5); severe watch 1`,
    30,
  ],
  ["Fire", "red flag warning 0.5", 15],
];

// Performance #5: served from the edge, rebuilt at most every two minutes and right after the
// hourly snapshot (api/cron/sswxcon); ConView catches up on load when its copy is older.
export const dynamic = "force-static";
export const revalidate = 120;

export default async function SswxCon() {
  const { disabled } = await getSiteDefaults();
  if (disabled.includes("sswxcon"))
    return (
      <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
        <ModuleOff label="SSWXCon" />
      </main>
    );
  const [national, snaps] = await Promise.all([
    nationalScore().catch(() => null),
    // A build without the database (CI) renders an empty trend; the next rebuild fills it.
    supabaseServer()
      .then(recentSnaps)
      .catch(() => []),
  ]);
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <PageHero
        icon={<Gauge aria-hidden />}
        eyebrow={["NWS alerts", "SPC outlook & watches"]}
        title="SSWXCon Score"
        subtitle="How stormy the whole country is right now, on one 0–250 scale: every active warning, weighted by danger, plus the setup SPC sees coming."
      />
      {!national ? (
        <p className={s.empty}>
          The National Weather Service alert feed isn&apos;t answering right
          now, so there is no honest score to show. Try again in a minute.
        </p>
      ) : (
        <HomeTabs
          variant="segment"
          label="SSWXCon"
          tabs={[
            {
              id: "con-now",
              label: "Now",
              icon: <Gauge aria-hidden />,
              panel: (
                <div className="grid gap-5">
                  <ConView initial={national} />
                  <LocalCard />
                </div>
              ),
            },
            {
              id: "con-trend",
              label: "Trend",
              icon: <LineChart aria-hidden />,
              panel: (
                <div className="grid gap-5">
                  <Trend
                    snaps={snaps}
                    now={national.total}
                    bands={national.bands}
                  />
                  <Ladder total={national.total} bands={national.bands} />
                </div>
              ),
            },
            {
              id: "con-how",
              label: "How",
              icon: <BookOpen aria-hidden />,
              panel: (
                <div className={s.how}>
                  <p>
                    SSWXCon counts every active, actual NWS alert in the country
                    and weighs it by danger. Each category is capped so routine
                    background warnings can&apos;t dominate; only a genuine
                    outbreak reaches the top bands.
                  </p>
                  <table>
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th>Points</th>
                        <th>Cap</th>
                      </tr>
                    </thead>
                    <tbody>
                      {WEIGHTS.map(([k, v, cap]) => (
                        <tr key={k}>
                          <td>{k}</td>
                          <td>{v}</td>
                          <td>{cap}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p>
                    Bands:{" "}
                    {BANDS.map((b) => `${b.label} ${b.min}+`).join(" · ")}.
                  </p>
                  <p>
                    What changed from the original formula: the Setup bucket
                    lifts the score on a dangerous day before storms fire;
                    emergencies and PDS warnings weigh more; marine
                    hurricane-force and coastal or lakeshore flood warnings no
                    longer count; winter counts warnings only; and every alert
                    is read, with no cap on how many.
                  </p>
                </div>
              ),
            },
          ]}
        />
      )}
    </main>
  );
}
