"use client";

import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { Chip } from "@/components/ui/Chip";
import { CountUp } from "@/features/dashboard/widgets/CountUp";
import { usePlaces } from "@/features/location/usePlaces";
import { UsMap } from "@/features/maps/UsMap";
import { project } from "@/lib/map/usAlbers";
import {
  KIND,
  magnitude,
  milesBetween,
  type Report,
  type ReportKind,
} from "@/lib/warnings/reports";
import s from "./Warn.module.css";

const SEVERE: ReportKind[] = ["tornado", "funnel", "hail", "wind", "flood"];
const NEAR = 75;

const ago = (iso: string, now: number) => {
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};

/** Storm Reports: what people on the ground saw (IEM Local Storm Reports). */
export function ReportsView({
  colors,
}: {
  colors: Record<ReportKind, string>;
}) {
  const [hours, setHours] = useState(24);
  const [res, setRes] = useState<
    { hours: number; at: number; reports: Report[] } | "err" | null
  >(null);
  const [all, setAll] = useState(false);
  const [near, setNear] = useState(false);
  const [kind, setKind] = useState<ReportKind | "">("");
  const { active } = usePlaces();

  useEffect(() => {
    let live = true;
    fetch(`/api/reports?hours=${hours}`)
      .then((r) => (r.ok ? r.json() : "err"))
      .then((d) => live && setRes(d === "err" ? d : { ...d, at: Date.now() }))
      .catch(() => live && setRes("err"));
    return () => {
      live = false;
    };
  }, [hours]);

  const loading = !res || (res !== "err" && res.hours !== hours);
  const list =
    res && res !== "err"
      ? res.reports
          .map((r) => ({
            r,
            mi: active
              ? milesBetween(active.lat, active.lon, r.lat, r.lon)
              : null,
          }))
          .filter(({ r }) => all || SEVERE.includes(r.kind))
          .filter(({ mi }) => !near || (mi !== null && mi <= NEAR))
      : [];
  const counts = SEVERE.map(
    (k) => [k, list.filter((x) => x.r.kind === k).length] as const,
  );
  const shown = kind ? list.filter((x) => x.r.kind === kind) : list;
  const now = res && res !== "err" ? res.at : 0;

  return (
    <div className={s.wrap}>
      <div className={s.chips}>
        {[6, 12, 24, 48].map((h) => (
          <Chip key={h} pressed={hours === h} onClick={() => setHours(h)}>
            Last {h} h
          </Chip>
        ))}
      </div>
      <div className={s.chips}>
        <Chip pressed={!all} onClick={() => setAll(false)}>
          Severe only
        </Chip>
        <Chip pressed={all} onClick={() => setAll(true)}>
          All reports
        </Chip>
        {active && (
          <Chip pressed={near} onClick={() => setNear(!near)}>
            <MapPin className="mr-1 inline size-3.5" aria-hidden /> Within{" "}
            {NEAR} mi
          </Chip>
        )}
      </div>

      <section className={s.kinds}>
        {counts.map(([k, n], i) => (
          <button
            key={k}
            className={`${s.kind} ${n > 0 ? s.kindOn : ""}`}
            aria-pressed={kind === k}
            onClick={() => setKind(kind === k ? "" : k)}
            style={{ ["--c" as string]: colors[k], ["--i" as string]: i }}
          >
            <b>{loading ? "–" : <CountUp value={n} />}</b>
            <span>{KIND[k].label}</span>
          </button>
        ))}
      </section>

      <UsMap
        title={`Storm reports · last ${hours} hours`}
        sub={null}
        legend={SEVERE.map((k) => ({
          label: KIND[k].label,
          color: colors[k],
        }))}
        status={
          res === "err"
            ? "error"
            : loading
              ? "loading"
              : shown.length
                ? "ready"
                : "empty"
        }
        file={`sswx-reports-${hours}h`}
        zoomable
        overlay={
          <g>
            {shown.map(({ r }, i) => {
              const { x, y } = project(r.lon, r.lat);
              const big =
                r.kind === "tornado" ||
                (r.kind === "hail" && (r.mag ?? 0) >= 2);
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r={big ? 7 : 4.5}
                  fill={colors[r.kind]}
                  className={big ? s.dotBig : s.dot}
                />
              );
            })}
          </g>
        }
      />

      {res === "err" ? (
        <p className={s.empty}>
          The storm report feed isn&apos;t answering right now.
        </p>
      ) : loading ? null : shown.length === 0 ? (
        <p className={s.empty}>
          No {all ? "" : "severe "}reports {near ? `within ${NEAR} miles ` : ""}
          in the last {hours} hours.
        </p>
      ) : (
        <ol className={s.reports}>
          {shown.slice(0, 200).map(({ r, mi }, i) => (
            <li
              key={i}
              style={{
                ["--c" as string]: colors[r.kind],
                ["--i" as string]: Math.min(i, 12),
              }}
            >
              <span className={s.rKind}>{KIND[r.kind].label}</span>
              <span className={s.rMain}>
                <b>
                  {[r.city, r.st].filter(Boolean).join(", ")}
                  {magnitude(r) && <em>{magnitude(r)}</em>}
                </b>
                {r.remark && <span>{r.remark}</span>}
                <small>
                  {ago(r.valid, now)} · {r.source || "Report"}
                  {mi !== null && ` · ${Math.round(mi)} mi away`}
                </small>
              </span>
            </li>
          ))}
        </ol>
      )}
      <p className={s.muted}>
        Reports via the Iowa Environmental Mesonet, from NWS Local Storm
        Reports.
      </p>
    </div>
  );
}
