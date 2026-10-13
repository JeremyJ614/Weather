# Storage safety

## What happened to the VIP app
The VIP repo records it itself (`stormsync-dashboard/github-repo/supabase/migrations/20260902010000_model_map_retention.sql` and `20260903070000_housekeeping.sql`):
1. **Model map frames.** The renderer uploaded a full set of HRRR/GFS frames to Supabase Storage every cycle and nothing deleted them: 3.7 GB, 18,642 files in 26 days. Supabase restricted the project and every request (logins included) returned 402.
2. **Unbounded cache keys.** `weather_cache` kept a new 140 kB row per tropical advisory and a new 260 kB row for every map viewport anyone opened (`water:gauges:<bbox>`), about 150 MB a season.
3. **Logs.** `cron.job_run_details` gained ~1,000 rows a day forever.
The fixes came after the outage, and the one-time recovery stranded 15,938 files.

## Rules for this app
1. **No rendered images in Supabase.** Model and radar imagery is drawn on the phone from upstream tiles or loaded directly from NOAA/NWS URLs. Engine outputs are small GeoJSON, overwritten in place.
2. **Every table that grows declares a retention rule** in the same migration that creates it, enforced by a test that fails when a table has neither a rule nor a written reason.
3. **Cache keys are bounded.** Viewports are snapped to a fixed tile grid; per-event keys expire.
4. **Logs expire.** cron history 7 days, engine runs 30 days, audit log 1 year.
5. **Watchdog.** A daily job records database size and storage bytes; the admin panel shows the trend and alerts at 60% and 80% of the free quota, before anything breaks.
6. **Storage uploads are capped** per user and per file (avatars, news images), and replaced files are deleted, not orphaned.
