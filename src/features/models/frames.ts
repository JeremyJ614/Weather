import type { FrameJob, FrameOut } from "./frame.worker";

/**
 * A couple of workers that draw model frames on the device (frame.worker.ts). A field and its
 * zoomed redraws go to the same worker, which keeps the field it just read.
 */
let pool: Worker[] | null = null;
let seq = 0;
const waiting = new Map<
  number,
  { ok: (o: Extract<FrameOut, { png: Blob }>) => void; no: (e: Error) => void }
>();

/** Can this browser draw frames itself? */
export const canDraw = () =>
  typeof window !== "undefined" && typeof Worker === "function";

function workers() {
  if (!pool) {
    const n = Math.max(
      1,
      Math.min(2, (navigator.hardwareConcurrency || 2) - 1),
    );
    pool = Array.from({ length: n }, () => {
      const w = new Worker(new URL("./frame.worker.ts", import.meta.url), {
        type: "module",
      });
      w.onmessage = (e: MessageEvent<FrameOut>) => {
        const d = e.data;
        const p = waiting.get(d.id);
        if (!p) return;
        waiting.delete(d.id);
        if ("error" in d) p.no(new Error(d.error));
        else p.ok(d);
      };
      return w;
    });
  }
  return pool;
}

export function drawFrame(job: Omit<FrameJob, "id">) {
  const id = ++seq;
  const ws = workers();
  let h = 0;
  for (const ch of job.url + job.recipe.key)
    h = (h * 31 + ch.charCodeAt(0)) | 0;
  return new Promise<Extract<FrameOut, { png: Blob }>>((ok, no) => {
    waiting.set(id, { ok, no });
    ws[Math.abs(h) % ws.length].postMessage({ ...job, id } satisfies FrameJob);
  });
}
