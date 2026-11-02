/**
 * The NWS Damage Assessment Toolkit's "damage lines" layer holds tornado tracks and also the
 * paths offices draw for straight-line wind and hail, rated "TSTM/Wind" (a 123-mile hail path
 * and a 50-mile, 8-mile-wide wind swath showed up as tornadoes, owner 2026-11-02). Unrated
 * tornadoes are "EFU", "UNKNOWN" or "N/A", so only the wind and hail label is left out.
 */
export const DAT_TORNADOES = "(efscale IS NULL OR efscale NOT LIKE 'TSTM%')";

/** The same rule for a row already read. */
export const isDatTornado = (efscale: unknown) =>
  !/^\s*TSTM/i.test(String(efscale ?? ""));
