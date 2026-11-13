/// <reference lib="webworker" />
import { drawJob, type FrameJob } from "./draw";

/**
 * Draws HRRR and GFS frames on the viewer's own device (owner, 2026-11-02, after Vercel paused
 * the project for going over its free usage): the GRIB record comes straight from NOAA's open
 * data on AWS (which allows it) and is drawn with exactly the code the server used.
 */
export type { FrameJob };
export type FrameOut =
  | { id: number; png: Blob; cities: (number | null)[] | null }
  | { id: number; error: string };

self.onmessage = async (e: MessageEvent<FrameJob>) => {
  const { id, ...job } = e.data;
  try {
    self.postMessage({ id, ...(await drawJob(job)) } satisfies FrameOut);
  } catch (err) {
    self.postMessage({ id, error: String(err) } satisfies FrameOut);
  }
};
