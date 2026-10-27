-- Deer & Fishing outlooks (review round, 2026-10-27): the lower 48's Day 1–3 maps from the GFS,
-- six rows in engine_maps ('outmap:deer', 'outmap:fish:<species>') overwritten each run.
-- Hourly at :37 the route recomputes them once a newer GFS run is out or Day 1 moves on.
select cron.schedule(
  'engine-outdoor',
  '37 * * * *',
  $$ select net.http_get(
    url := 'https://weather.sswx.space/api/cron/outdoor',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'db_cron_secret')),
    timeout_milliseconds := 60000
  ); $$
);
