/**
 * Severe Analogs was retired (owner, 2026-11-15). The database scheduler's job
 * "engine-analogs" may still call here until it is unscheduled; it does no work.
 * Owner step: run `select cron.unschedule('engine-analogs');` in the Supabase SQL editor.
 */
export function GET() {
  return Response.json({ retired: "Severe Analogs" }, { status: 410 });
}
