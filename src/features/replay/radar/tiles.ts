import { decodeBlob, type Decoded } from "./tileDecode";

export type TileResult = Decoded | { empty: true } | { error: string };

async function inline(url: string): Promise<TileResult> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return { empty: true };
    return (await decodeBlob(await res.blob())) ?? { error: "no 2D canvas" };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Tiles fetched and decoded off the main thread (review round, speed pick "workers"): a
 * frame of the replay is a dozen or more tiles of 65,536 pixels each, and reading them back
 * on the thread that draws the map stalled pans and the play button on mid-tier phones.
 * One worker, made on first use and let go after a minute of nothing; browsers without a
 * worker canvas (iOS before 16.4) decode here as before.
 */
let worker: Worker | null = null;
let unsupported = false;
let seq = 0;
let idle: ReturnType<typeof setTimeout> | null = null;
const jobs = new Map<number, (r: TileResult) => void>();

function stop() {
  worker?.terminate();
  worker = null;
  for (const [id, done] of jobs) {
    jobs.delete(id);
    done({ error: "The tile decoder stopped." });
  }
}

function start(): Worker | null {
  if (worker || unsupported) return worker;
  if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") {
    unsupported = true;
    return null;
  }
  try {
    worker = new Worker(new URL("./tile.worker.ts", import.meta.url), {
      type: "module",
    });
  } catch {
    unsupported = true;
    return null;
  }
  worker.onmessage = (e: MessageEvent<TileResult & { id: number }>) => {
    const { id, ...r } = e.data;
    const done = jobs.get(id);
    if (!done) return;
    jobs.delete(id);
    done(r as TileResult);
    if (idle) clearTimeout(idle);
    idle = setTimeout(() => {
      if (jobs.size === 0) stop();
    }, 60_000);
  };
  worker.onerror = (e) => {
    e.preventDefault();
    unsupported = true;
    stop();
  };
  return worker;
}

export function loadTile(url: string): Promise<TileResult> {
  const w = start();
  if (!w) return inline(url);
  const id = (seq += 1);
  return new Promise((resolve) => {
    jobs.set(id, resolve);
    w.postMessage({ id, url });
  });
}
