/// <reference lib="webworker" />
import { buildFrames, type Built, type BuildJob } from "./build";

/** Builds the 7-day map's frames off the page's thread (build.ts). */
export type WorkerOut = (Built & { done?: false }) | { error: string };

self.onmessage = async (e: MessageEvent<BuildJob>) => {
  try {
    for await (const f of buildFrames(e.data))
      self.postMessage(f satisfies WorkerOut, f.codes ? [f.codes.buffer] : []);
  } catch (err) {
    self.postMessage({ error: String(err) } satisfies WorkerOut);
  }
};
