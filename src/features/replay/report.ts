/**
 * A map layer that switches itself off hands its error to the app's reporter (admin → Error
 * inbox) through the window's error event, without breaking the replay around it.
 */
export function reportError(
  err: unknown,
  context: { source?: string; layer?: string } = {},
) {
  const e = err instanceof Error ? err : new Error(String(err));
  dispatchEvent(
    new ErrorEvent("error", {
      message: `${context.layer ?? context.source ?? "replay"}: ${e.message}`,
      error: e,
    }),
  );
}
