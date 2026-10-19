-- Fix-It #7.3: fill this year's Storm Chasing ledger from SPC's archive and archived model
-- runs (three days per call), then keep refilling any day a daily scan misses. Applied 2026-10-19.
select cron.schedule('chase-backfill', '*/30 * * * *', $$
  select net.http_get(
    url := 'https://weather.sswx.space/api/cron/chase/backfill',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'db_cron_secret')),
    timeout_milliseconds := 60000
  );
$$);
