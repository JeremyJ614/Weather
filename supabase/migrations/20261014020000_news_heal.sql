-- Fix-It #4: Weather News safety net. Every hour the collector checks the stored stories and
-- collects again only when they are missing or over a day old (a missed or failed daily run).
select cron.schedule('weather-news-heal', '35 * * * *', $$
  select net.http_get(
    url := 'https://weather.sswx.space/api/cron/weather-news?heal=1',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'db_cron_secret')),
    timeout_milliseconds := 60000
  );
$$);
