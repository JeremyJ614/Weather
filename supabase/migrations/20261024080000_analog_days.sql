-- Final List #7 engine: Severe Analogs. For today and tomorrow, the past days whose weather
-- best matches the GFS forecast (lib/analogs), the chances they give, and once the day is
-- over how many severe reports it really had. Only the server reads or writes it.
-- Retention: two years, pruned by the engine-analogs job.
create table if not exists public.analog_days (
  day date primary key,
  made_at timestamptz not null default now(),
  cycle text not null check (char_length(cycle) = 10),
  -- Chances (0–1) of 10+, 25+ and 50+ severe reports, and the analogs' average tornadoes.
  p10 real not null check (p10 between 0 and 1),
  p25 real not null check (p25 between 0 and 1),
  p50 real not null check (p50 between 0 and 1),
  torn real not null,
  analogs jsonb not null check (octet_length(analogs::text) <= 8000),
  -- Filled the next day from SPC's report file.
  actual integer,
  checked_at timestamptz
);
alter table public.analog_days enable row level security;
-- No policies: /api/engines/analogs serves it.

-- Four times a day, after each GFS run is out: match today and tomorrow, score yesterday.
select cron.schedule(
  'engine-analogs',
  '50 4,10,16,22 * * *',
  $$ select net.http_get(
    url := 'https://weather.sswx.space/api/cron/analogs',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'db_cron_secret')),
    timeout_milliseconds := 60000
  ); $$
);
