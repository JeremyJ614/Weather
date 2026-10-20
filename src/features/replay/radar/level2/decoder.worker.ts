import { decompress } from "bz2";
import { walkMessages, type Radial } from "./format";

/**
 * Unpacks one bzip2 record of a Level II volume off the main thread.
 *
 * bzip2 is slow to undo — a quarter of a second per record in a browser — and
 * the lowest scan of a modern volume is a dozen records, so this runs in a
 * small pool of workers, a record each, while the rest are still arriving.
 * The radials come back as views into the unpacked record, whose buffer is
 * handed over rather than copied.
 */
self.onmessage = (e: MessageEvent<{ id: number; bytes: ArrayBuffer }>) => {
  const { id, bytes } = e.data;
  try {
    const raw = decompress(new Uint8Array(bytes), false);
    const radials: Radial[] = [];
    walkMessages(raw, 0, (r) => radials.push(r));
    self.postMessage(
      { id, radials },
      { transfer: [raw.buffer as ArrayBuffer] },
    );
  } catch (err) {
    self.postMessage({
      id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
