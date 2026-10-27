import { decodeBlob } from "./tileDecode";

/** Fetches and decodes one archive radar tile off the main thread (see `tiles.ts`). */
self.onmessage = async (e: MessageEvent<{ id: number; url: string }>) => {
  const { id, url } = e.data;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) {
      self.postMessage({ id, empty: true });
      return;
    }
    const d = await decodeBlob(await res.blob());
    if (!d) {
      self.postMessage({ id, error: "no 2D canvas" });
      return;
    }
    self.postMessage(
      { id, ...d },
      { transfer: [d.data.buffer as ArrayBuffer] },
    );
  } catch (err) {
    self.postMessage({
      id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
