import type { Metadata } from "next";
import { QUOTA, assess } from "@/lib/ops/watchdog";
import { requireAdmin } from "@/lib/auth/admin-guard";

export const metadata: Metadata = {
  title: "Storage watchdog · StormSync Media",
};

const mb = (n: number) => `${(n / 1024 ** 2).toFixed(1)} MB`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

function Meter({
  label,
  used,
  quota,
}: {
  label: string;
  used: number;
  quota: number;
}) {
  const f = Math.min(used / quota, 1);
  return (
    <div className="grid gap-1.5">
      <div className="flex justify-between text-sm">
        <span className="font-bold">{label}</span>
        <span className="text-muted">
          {mb(used)} of {mb(quota)} · {pct(used / quota)}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-bg">
        <div
          className="h-full origin-left rounded-full bg-accent"
          style={{ transform: `scaleX(${f})` }}
        />
      </div>
    </div>
  );
}

export default async function Storage() {
  const { supabase } = await requireAdmin("storage");
  const { data: rows } = await supabase
    .from("storage_snapshots")
    .select("day, db_bytes, storage_bytes")
    .order("day", { ascending: false })
    .limit(30);
  const latest = rows?.[0];
  const level = latest
    ? assess(latest.db_bytes, latest.storage_bytes).level
    : null;

  return (
    <main className="mx-auto grid max-w-3xl gap-6 px-4 pt-6 pb-24">
      <div>
        <h1 className="display text-3xl text-accent">Storage watchdog</h1>
        <p className="mt-1 text-sm text-muted">
          Measured daily. You get an email at 60% and 80% of the free plan.
        </p>
      </div>
      {!latest ? (
        <p className="text-muted">
          No readings yet. The first is taken by tomorrow&apos;s 6:20 UTC check.
        </p>
      ) : (
        <>
          <div className="grid gap-4 rounded-2xl border border-line bg-surface p-4">
            <p className="text-sm">
              Status:{" "}
              <b className="text-accent">
                {level === "ok"
                  ? "Healthy"
                  : level === "warn"
                    ? "Over 60%"
                    : "Over 80%"}
              </b>{" "}
              · {latest.day}
            </p>
            <Meter
              label="Database"
              used={latest.db_bytes}
              quota={QUOTA.dbBytes}
            />
            <Meter
              label="File storage"
              used={latest.storage_bytes}
              quota={QUOTA.storageBytes}
            />
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-muted">
              <tr>
                <th className="py-1 font-normal">Day</th>
                <th className="py-1 font-normal">Database</th>
                <th className="py-1 font-normal">Files</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.day} className="border-t border-line">
                  <td className="py-1.5">{r.day}</td>
                  <td>{mb(r.db_bytes)}</td>
                  <td>{mb(r.storage_bytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
