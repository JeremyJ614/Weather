"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  Clapperboard,
  Download,
  Film,
  Image as Picture,
  Share2,
  X,
} from "lucide-react";
import type { Format, Reel } from "./motion";
import s from "./MotionShare.module.css";

const KINDS: [Format, string, typeof Film][] = [
  ["image", "Picture", Picture],
  ["gif", "GIF", Film],
  ["video", "Video", Clapperboard],
];

/**
 * Share for a looping map or a drawn card: pick a picture, a GIF or a video, watch it get made,
 * then share or save it. Loaded on its own, after the page. `formats` limits the choices
 * (picture-only shares); `label` names the button.
 */
export default function MotionShare({
  reel,
  file,
  frames,
  build,
  hints,
  heading = "Share this loop as",
  formats = ["image", "gif", "video"],
  label = "Share",
  controls,
  remake,
}: {
  /** Changes when a choice in `controls` changes the file: a picture is made again. */
  remake?: string;
  /** Extra choices shown in the sheet above the formats (a speed picker, say). */
  controls?: ReactNode;
  reel?: () => Promise<Reel>;
  file: string;
  frames: number;
  /** Makes the file itself (pages with their own frames, like the History Globe). */
  build?: (
    f: Format,
    progress: (done: number, total: number) => void,
  ) => Promise<Blob>;
  /** The line under each kind of file. */
  hints?: Partial<Record<Format, string>>;
  heading?: string;
  formats?: Format[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [job, setJob] = useState<{ f: Format; done: number; total: number }>();
  const [out, setOut] = useState<{ blob: Blob; url: string; f: Format }>();
  const [err, setErr] = useState("");
  useEffect(() => () => out && URL.revokeObjectURL(out.url), [out]);
  const kinds = KINDS.filter(([f]) => formats.includes(f));
  // The latest props and whether a file is being made: a choice changed mid-make waits for
  // that make to end, then the file is made again with the new choice.
  const latest = useRef({ build, reel });
  useEffect(() => {
    latest.current = { build, reel };
  });
  const busy = useRef(false);
  const again = useRef(false);
  const go = async (f: Format) => {
    if (busy.current) return;
    busy.current = true;
    const { build, reel } = latest.current;
    setErr("");
    setOut(undefined);
    setJob({ f, done: 0, total: 0 });
    try {
      const progress = (done: number, total: number) =>
        setJob({ f, done, total });
      const blob = build
        ? await build(f, progress)
        : await Promise.all([import("./motion"), reel!()]).then(
            ([{ make }, r]) => make(r, f, progress),
          );
      setOut({ blob, url: URL.createObjectURL(blob), f });
    } catch {
      setErr(
        f === "video"
          ? "This device couldn't make a video. Try the GIF."
          : "That didn't work this time. Try again in a moment.",
      );
    } finally {
      busy.current = false;
      setJob(undefined);
      if (again.current) {
        again.current = false;
        void go(f);
      }
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
  const only = kinds.length === 1 ? kinds[0][0] : null;
  // A choice changed (a graph picked, say): the file made before no longer matches it.
  const made = useRef(remake);
  useEffect(() => {
    if (made.current === remake) return;
    made.current = remake;
    if (!only || !open) return;
    if (busy.current) again.current = true;
    else void Promise.resolve().then(() => go(only));
  });
  return (
    <div className={s.wrap}>
      <button
        type="button"
        className={s.trigger}
        aria-expanded={open}
        onClick={() => {
          // A picture-only share makes its file on the first tap.
          if (!open && only && !out && !job) void go(only);
          setOpen(!open);
        }}
      >
        <span className={s.orb}>
          <Share2 aria-hidden />
        </span>
        <span className={s.words}>
          <b>{label}</b>
          <small>{kinds.map(([, n]) => n).join(" · ")}</small>
        </span>
      </button>
      {open && (
        <div className={s.sheet}>
          <div className={s.top}>
            <b>{heading}</b>
            <button
              type="button"
              className={s.close}
              aria-label="Close"
              onClick={() => setOpen(false)}
            >
              <X aria-hidden />
            </button>
          </div>
          {controls && <div className={s.controls}>{controls}</div>}
          {!only && (
            <div
              className={s.kinds}
              style={{ "--n": kinds.length } as CSSProperties}
            >
              {kinds.map(([f, name, Icon], i) => (
                <button
                  key={f}
                  type="button"
                  disabled={!!job}
                  aria-pressed={out?.f === f}
                  onClick={() => go(f)}
                  className={s.kind}
                  style={{ "--i": i } as CSSProperties}
                >
                  <span className={s.orb}>
                    <Icon aria-hidden />
                  </span>
                  <b>{name}</b>
                  <small>
                    {hints?.[f] ??
                      (f === "image"
                        ? "This frame"
                        : f === "gif"
                          ? `${Math.min(frames, 30)} frames`
                          : `MP4 · ${many} frames`)}
                  </small>
                </button>
              ))}
            </div>
          )}
          {job && (
            <div className={s.status} role="status">
              <span>
                {job.f === "image"
                  ? "Drawing the picture…"
                  : `Making the ${job.f === "gif" ? "GIF" : "video"}… frame ${Math.min(job.done + 1, job.total || 1)} of ${job.total || "…"}`}
              </span>
              <i className={s.bar}>
                <b
                  style={{
                    transform: `scaleX(${job.total ? job.done / job.total : 0.05})`,
                  }}
                />
              </i>
            </div>
          )}
          {err && (
            <p className="text-xs text-muted">
              {err}{" "}
              {only && (
                <button
                  type="button"
                  className="font-bold text-accent underline"
                  onClick={() => go(only)}
                >
                  Try again
                </button>
              )}
            </p>
          )}
          {out && (
            <div className={s.out}>
              <div className={s.frame}>
                {out.f === "video" ? (
                  <video src={out.url} autoPlay muted loop playsInline />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- a local preview of the file just made
                  <img src={out.url} alt="The file to share" />
                )}
              </div>
              <div className={s.acts}>
                <button
                  type="button"
                  className={s.act}
                  onClick={() => deliver(true)}
                >
                  <Share2 aria-hidden /> Share
                </button>
                <button
                  type="button"
                  className={s.act}
                  onClick={() => deliver(false)}
                >
                  <Download aria-hidden /> Save
                </button>
                {only && (
                  <button
                    type="button"
                    className={s.act}
                    onClick={() => go(only)}
                  >
                    <Picture aria-hidden /> Redraw
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
