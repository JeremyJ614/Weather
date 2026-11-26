/// <reference lib="webworker" />
import { buildFrames, buildTotal, type Built, type BuildJob } from "./build";

/** Builds the 7-day map's pictures off the page's thread (build.ts). */
export type WorkerOut = Built | { error: string };

self.onmessage = async (e: MessageEvent<BuildJob>) => {
  try {
    if (e.data.kind === "total") {
      const t = await buildTotal(e.data);
      self.postMessage(t satisfies WorkerOut, t.codes ? [t.codes.buffer] : []);
      return;
    }
    for await (const f of buildFrames(e.data))
      self.postMessage(f satisfies WorkerOut, f.codes ? [f.codes.buffer] : []);
  } catch (err) {
    self.postMessage({ error: String(err) } satisfies WorkerOut);
  }
};
