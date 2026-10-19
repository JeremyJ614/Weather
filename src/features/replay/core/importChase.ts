import type { ChasePayload, PreparedChase } from "./chase";
import { prepareChase } from "./prepare";

export interface ImportProgress {
  fraction: number;
  label: string;
}

/**
 * Prepares a stored chase for replay. Stored tracks are capped at a few thousand points
 * (see chaselog/store.ts), so this runs on the main thread after one yield, without a worker.
 */
export function importChase(
  payload: ChasePayload,
  onProgress?: (p: ImportProgress) => void,
): Promise<PreparedChase> {
  return new Promise((resolve, reject) =>
    setTimeout(() => {
      try {
        resolve(
          prepareChase(payload, (fraction, label) =>
            onProgress?.({ fraction, label }),
          ),
        );
      } catch (e) {
        reject(e);
      }
    }, 0),
  );
}
