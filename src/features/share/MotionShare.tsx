"use client";

import { useEffect, useState } from "react";
import {
  Clapperboard,
  Download,
  Film,
  Image as Picture,
  Share2,
  X,
} from "lucide-react";
import type { Format, Reel } from "./motion";

const KINDS: [Format, string, typeof Film][] = [
  ["image", "Picture", Picture],
  ["gif", "GIF", Film],
  ["video", "Video", Clapperboard],
];
const btn =
  "inline-flex min-h-10 items-center gap-2 rounded-xl border border-line px-3 text-sm font-bold text-text disabled:opacity-60";

/**
 * Share for a looping map (Radar, Model Runs): pick a picture of this frame, a GIF or a video
 * of the loop, watch it get made, then share or save it. Loaded on its own, after the page.
 */
export default function MotionShare({
  reel,
  file,
  frames,
}: {
  reel: () => Promise<Reel>;
  file: string;
  frames: number;
}) {
  const [open, setOpen] = useState(false);
  const [job, setJob] = useState<{ f: Format; done: number; total: number }>();
  const [out, setOut] = useState<{ blob: Blob; url: string; f: Format }>();
  const [err, setErr] = useState("");
  useEffect(() => () => out && URL.revokeObjectURL(out.url), [out]);
  const go = async (f: Format) => {
    if (job) return;
    setErr("");
    setOut(undefined);
    setJob({ f, done: 0, total: 0 });
    try {
      const [{ make }, r] = await Promise.all([import("./motion"), reel()]);
      const blob = await make(r, f, (done, total) =>
        setJob({ f, done, total }),
      );
      setOut({ blob, url: URL.createObjectURL(blob), f });
    } catch {
      setErr(
        f === "video"
          ? "This device couldn't make a video. Try the GIF."
          : "That didn't work this time. Try again in a moment.",
      );
    } finally {
      setJob(undefined);
    }
  };
  const ext = out?.blob.type.split("/")[1] ?? "";
  const deliver = async (share: boolean) => {
    if (!out) return;
    const f = new File([out.blob], `${file}.${ext}`, { type: out.blob.type });
    try {
      if (share && navigator.canShare?.({ files: [f] }))
        return await navigator.share({
          files: [f],
          title: "SSWX Weather Center",
        });
    } catch {
      return;
    }
    const a = document.createElement("a");
    a.href = out.url;
    a.download = f.name;
    a.click();
  };
  const many = Math.min(frames, 48);
  return (
    <div className="grid justify-items-start gap-2">
      <button
        type="button"
        className={btn}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Share2 className="size-4 text-accent" aria-hidden />
        Share
      </button>
      {open && (
        <div className="grid w-full gap-3 rounded-2xl border border-line p-3">
          <div className="flex items-center justify-between">
            <b className="text-sm">Share this loop as</b>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {KINDS.map(([f, name, Icon]) => (
              <button
                key={f}
                type="button"
                disabled={!!job}
                aria-pressed={out?.f === f}
                onClick={() => go(f)}
                className="grid justify-items-center gap-1 rounded-xl border border-line px-2 py-3 text-center disabled:opacity-60 aria-pressed:border-accent"
              >
                <Icon className="size-5 text-accent" aria-hidden />
                <b className="text-sm">{name}</b>
                <small className="text-xs text-muted">
                  {f === "image"
                    ? "This frame"
                    : f === "gif"
                      ? `${Math.min(frames, 30)} frames`
                      : `MP4 · ${many} frames`}
                </small>
              </button>
            ))}
          </div>
          {job && (
            <div className="grid gap-1" role="status">
              <small className="text-xs text-muted">
                {job.f === "image"
                  ? "Making the picture…"
                  : `Making the ${job.f === "gif" ? "GIF" : "video"}… frame ${Math.min(job.done + 1, job.total || 1)} of ${job.total || "…"}`}
              </small>
              <i className="block h-1.5 overflow-hidden rounded-full bg-line">
                <b
                  className="block h-full origin-left bg-accent transition-transform"
                  style={{
                    transform: `scaleX(${job.total ? job.done / job.total : 0.05})`,
                  }}
                />
              </i>
            </div>
          )}
          {err && <p className="text-xs text-muted">{err}</p>}
          {out && (
            <div className="grid justify-items-start gap-2">
              {out.f === "video" ? (
                <video
                  src={out.url}
                  className="max-h-80 w-auto rounded-xl"
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- a local preview of the file just made
                <img
                  src={out.url}
                  alt="The picture to share"
                  className="max-h-80 w-auto rounded-xl"
                />
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={btn}
                  onClick={() => deliver(true)}
                >
                  <Share2 className="size-4 text-accent" aria-hidden /> Share
                </button>
                <button
                  type="button"
                  className={btn}
                  onClick={() => deliver(false)}
                >
                  <Download className="size-4 text-accent" aria-hidden /> Save
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
