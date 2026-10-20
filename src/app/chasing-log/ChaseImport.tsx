"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { supabaseBrowser } from "@/lib/supabase/browser";
import {
  parseTrack,
  SUPPORTED_FORMATS,
} from "@/features/replay/import/parsers";
import {
  discoverForRoute,
  type DiscoveryBundle,
} from "@/features/replay/import/sources";
import {
  summarise,
  suggestTitle,
  type TrackSummary,
} from "@/features/replay/import/build";
import { ImportError, type ParsedTrack } from "@/features/replay/import/types";
import { strongestOf } from "@/features/replay/core/chase";
import { packChase } from "@/features/replay/chaselog/codec";
import type { ChaseRow } from "./ChaseLogView";
import s from "./ChaseLog.module.css";

// The map and road routing load only when someone chooses to draw a route.
const RouteBuilder = dynamic(
  () => import("./RouteBuilder").then((m) => m.RouteBuilder),
  { ssr: false },
);

type Stage = "drop" | "draw" | "read" | "finding" | "review" | "saving";

const clock = (epoch: number, tz: string) =>
  new Date(epoch * 1000).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  });

/**
 * Add a chase (ported from the Log repo's import page): read a recorded track, or draw the
 * route by hand with the times remembered along it, find every tornado the NWS surveyed near
 * it, let the member choose which to keep, then save it to their account.
 */
export function ChaseImport({
  ef,
  route,
  onSaved,
  onCancel,
}: {
  ef: (k: string) => string;
  /** The chaser's track color, for the route drawn by hand. */
  route: string;
  onSaved: (row: ChaseRow) => void;
  onCancel: () => void;
}) {
  const [stage, setStage] = useState<Stage>("drop");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(
    null,
  );
  const [parsed, setParsed] = useState<ParsedTrack | null>(null);
  const [summary, setSummary] = useState<TrackSummary | null>(null);
  const [found, setFound] = useState<DiscoveryBundle | null>(null);
  const [progress, setProgress] = useState({ fraction: 0, label: "" });
  const [keep, setKeep] = useState<Set<number>>(new Set());
  const [title, setTitle] = useState("");
  const input = useRef<HTMLInputElement | null>(null);

  const fail = (err: unknown) =>
    setError(
      err instanceof ImportError
        ? { message: err.message, hint: err.hint }
        : {
            message:
              (err as Error)?.message ||
              "Something went wrong reading that file.",
          },
    );

  const take = async (file: File) => {
    setError(null);
    if (file.size > 40 * 1024 ** 2) {
      setError({ message: "That file is over 40 MB, too big for one chase." });
      return;
    }
    setStage("read");
    try {
      await find(parseTrack(file.name, await file.text()));
    } catch (err) {
      fail(err);
      setStage("drop");
    }
  };

  /** Looks up the day for a track, from a file or drawn by hand. */
  const find = async (track: ParsedTrack, back: Stage = "drop") => {
    setError(null);
    let sum: TrackSummary;
    try {
      sum = summarise(track);
      setParsed(track);
      setSummary(sum);
      setStage("finding");
    } catch (err) {
      fail(err);
      setStage(back);
      return;
    }
    const empty: DiscoveryBundle = {
      tornadoes: [],
      contours: [],
      damage: [],
      hail: [],
      warnings: [],
      notes: [],
    };
    let bundle = empty;
    try {
      bundle = await discoverForRoute(track.fixes, sum.tz, {
        onProgress: (fraction, label) => setProgress({ fraction, label }),
      });
    } catch (err) {
      // The chase still saves without them; tornadoes are looked up again on every open.
      fail(err);
    }
    setFound(bundle);
    setKeep(new Set(bundle.tornadoes.map((_, i) => i)));
    setTitle(suggestTitle(bundle, sum));
    setStage("review");
  };

  const save = async () => {
    if (!parsed || !summary || !found) return;
    setStage("saving");
    setError(null);
    const torn = found.tornadoes.filter((_, i) => keep.has(i));
    const name = (title.trim() || summary.day).slice(0, 80);
    const payload = packChase(name, summary.tz, parsed.fixes, torn);
    const { data, error: e } = await supabaseBrowser()
      .from("chases")
      .insert({
        title: name,
        day: summary.day,
        tz: summary.tz,
        miles: Math.round(summary.miles * 10) / 10,
        tornadoes: torn.length,
        strongest: torn.length ? strongestOf(torn) : null,
        payload,
      })
      .select("id,title,day,miles,tornadoes,strongest")
      .single();
    if (e || !data) {
      setStage("review");
      setError({
        message: e?.message.includes("chase_limit")
          ? "Your log holds 30 chases. Delete one to add this one."
          : "The chase could not be saved. Check your connection and try again.",
      });
      return;
    }
    onSaved(data as ChaseRow);
  };

  return (
    <section className={s.panel} aria-label="Add a chase">
      <div className={s.panelHead}>
        <h2>Add a chase</h2>
        <button type="button" className={s.quiet} onClick={onCancel}>
          Cancel
        </button>
      </div>

      {error && (
        <div className={s.error} role="alert">
          <strong>{error.message}</strong>
          {error.hint && <span>{error.hint}</span>}
        </div>
      )}

      {stage === "drop" && (
        <>
          <div
            className={s.drop}
            data-drag={dragging || undefined}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files[0];
              if (file) void take(file);
            }}
          >
            <p className={s.dropBig}>Drop your track here</p>
            <button
              type="button"
              className={s.primary}
              onClick={() => input.current?.click()}
            >
              Choose a file
            </button>
            <input
              ref={input}
              type="file"
              accept={SUPPORTED_FORMATS}
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void take(file);
                e.target.value = "";
              }}
            />
            <p className={s.small}>
              GPX, KML, TCX, GeoJSON, CSV, or the JSON from Google Timeline.
            </p>
          </div>
          <button
            type="button"
            className={s.add}
            onClick={() => setStage("draw")}
          >
            No track? Draw your route on the map
          </button>
          <ol className={s.how}>
            <li>
              <b>Your track is read on this phone.</b> It is thinned to the
              points that matter and saved to your account, visible only to you.
            </li>
            <li>
              <b>The day is looked up.</b> Your route&rsquo;s dates and area go
              to the National Weather Service&rsquo;s survey archive and the
              Iowa Environmental Mesonet, the public sources the surveys are
              published on.
            </li>
            <li>
              <b>You choose what to keep.</b> Anything surveyed near your route
              comes back, and some of it may be a storm you never saw.
            </li>
          </ol>
        </>
      )}

      {stage === "draw" && (
        <>
          <RouteBuilder color={route} onDone={(t) => void find(t, "draw")} />
          <button
            type="button"
            className={s.quiet}
            onClick={() => {
              setError(null);
              setStage("drop");
            }}
          >
            Use a track file instead
          </button>
        </>
      )}

      {(stage === "read" || stage === "finding") && (
        <div className={s.working}>
          <div
            className={s.bar}
            role="progressbar"
            aria-valuenow={Math.round(progress.fraction * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span
              style={{
                transform: `scaleX(${Math.max(0.04, progress.fraction)})`,
              }}
            />
          </div>
          <p>
            {stage === "read"
              ? "Reading the file"
              : progress.label || "Looking up the day"}
          </p>
          {summary && (
            <p className={s.small}>
              {summary.fixes.toLocaleString()} fixes ·{" "}
              {summary.miles.toFixed(0)} miles · {summary.day}
            </p>
          )}
        </div>
      )}

      {(stage === "review" || stage === "saving") && summary && found && (
        <>
          <dl className={s.facts}>
            <div>
              <dt>Date</dt>
              <dd>{summary.day}</dd>
            </div>
            <div>
              <dt>Drive</dt>
              <dd>{summary.miles.toFixed(0)} mi</dd>
            </div>
            <div>
              <dt>From</dt>
              <dd>{clock(summary.from, summary.tz)}</dd>
            </div>
            <div>
              <dt>To</dt>
              <dd>{clock(summary.to, summary.tz)}</dd>
            </div>
          </dl>
          {summary.warnings.length > 0 && (
            <ul className={s.warns}>
              {summary.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          <label className={s.field}>
            <span>What to call it</span>
            <input
              value={title}
              maxLength={80}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={summary.day}
            />
          </label>

          <h3 className={s.h3}>
            {found.tornadoes.length === 0
              ? "No tornadoes found"
              : `${found.tornadoes.length} tornado${found.tornadoes.length === 1 ? "" : "es"} near your route`}
          </h3>
          {found.tornadoes.length === 0 ? (
            <p className={s.small}>
              Nothing was surveyed near this route on this date. The chase still
              saves: the track, the clock, hail and warnings are all there, and
              new surveys are picked up each time you open it.
            </p>
          ) : (
            <ul className={s.pickList}>
              {found.tornadoes.map((t, i) => {
                const on = keep.has(i);
                const dmg = found.damage.filter((d) => d[6] === i).length;
                return (
                  <li key={`${t.name}-${t.start}`}>
                    <label className={s.pick} data-on={on || undefined}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() =>
                          setKeep((prev) => {
                            const next = new Set(prev);
                            if (next.has(i)) next.delete(i);
                            else next.add(i);
                            return next;
                          })
                        }
                      />
                      <span
                        className={s.rating}
                        style={{ borderColor: ef(t.ef), color: ef(t.ef) }}
                      >
                        {t.ef}
                      </span>
                      <span className={s.pickText}>
                        <b>{t.name}</b>
                        <small>
                          {clock(summary.from + t.start, summary.tz)}
                          {t.widthYd
                            ? ` · ${Math.round(t.widthYd).toLocaleString()} yd wide`
                            : ""}
                          {dmg
                            ? ` · ${dmg} damage point${dmg === 1 ? "" : "s"}`
                            : ""}
                        </small>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          <p className={s.small}>
            {found.hail.length} hail reports and {found.warnings.length} warning
            polygons near your route will be on the map.
          </p>
          <div className={s.actions}>
            <button
              type="button"
              className={s.primary}
              disabled={stage === "saving"}
              onClick={() => void save()}
            >
              {stage === "saving" ? "Saving…" : "Save and open"}
            </button>
            <button
              type="button"
              className={s.quiet}
              disabled={stage === "saving"}
              onClick={() => {
                setStage("drop");
                setParsed(null);
                setSummary(null);
                setFound(null);
                setError(null);
              }}
            >
              Start over
            </button>
          </div>
        </>
      )}
    </section>
  );
}
