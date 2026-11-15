import {
  Bars,
  Card,
  Meter,
  Note,
  Tile,
  Tiles,
  TONE,
} from "@/components/admin/Dash";
import { HOBBY, usageReport } from "@/lib/ops/usage";

const tone = (pct: number) =>
  pct >= 90 ? TONE.bad : pct >= 70 ? TONE.warn : TONE.good;

/**
 * Post-launch A1 "cost-guard": how much server work the app does, projected over a month and
 * held against the free Hobby plan, with a warning from 70%. Counts the data routes and the
 * scheduled jobs (nearly all server work); pages the CDN answers cost nothing.
 */
export async function UsageCard({
  maps,
}: {
  maps: { loads: number; provider: string | null };
}) {
  const u = await usageReport().catch(() => null);
  if (!u)
    return (
      <Card title="Vercel usage">
        <Note>The usage meter couldn&apos;t be read right now.</Note>
      </Card>
    );
  const worst = Math.max(u.callsPct, u.cpuPct);
  return (
    <Card
      title="Vercel usage (estimate)"
      meta={
        u.measuredDays ? `from the last ${u.measuredDays} days` : "starting"
      }
    >
      {worst >= 70 && (
        <Note>
          Heads up: at this pace the app passes {Math.round(worst)}% of the free
          plan&apos;s monthly allowance. Turning on GitHub Actions jobs
          (JOBS_ON_ACTIONS) moves the heaviest work off Vercel.
        </Note>
      )}
      <Tiles>
        <Tile
          label="Server calls / month"
          value={u.callsMonth.toLocaleString()}
          sub={`${Math.round(u.callsPct)}% of ${HOBBY.calls.toLocaleString()}`}
          color={tone(u.callsPct)}
        />
        <Tile
          label="CPU hours / month"
          value={u.cpuMonthH.toFixed(2)}
          sub={`${Math.round(u.cpuPct)}% of ${HOBBY.cpuHours} h`}
          color={tone(u.cpuPct)}
        />
        <Tile
          label="Mapbox map loads"
          value={maps.loads.toLocaleString()}
          sub={`of 45,000 a month · now on ${maps.provider ?? "–"}; MapLibre takes over at the limit`}
          color={tone((100 * maps.loads) / 45000)}
        />
      </Tiles>
      <Meter f={worst / 100} color={tone(worst)} />
      {u.top.length > 0 && (
        <Bars
          rows={u.top.map(([k, v]) => ({
            label: k,
            value: v,
            text: `${v.toLocaleString()} in 7 days`,
          }))}
        />
      )}
      <Note>
        {u.measuredDays
          ? "Counted by each server instance and saved every few minutes; Vercel → Usage has the exact figures."
          : "The meter fills in as the app runs (the first day appears tomorrow)."}
      </Note>
    </Card>
  );
}
