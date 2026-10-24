-- Performance #1: each model-driven engine's latest map, computed once per HRRR run and
-- served to every visitor from here. Only the server (service role) reads or writes it.
-- Retention: one row per engine, overwritten on every run; it never grows past the engine count.
create table if not exists public.engine_maps (
  id text primary key check (char_length(id) <= 16),
  cycle text not null check (char_length(cycle) = 10),
  data jsonb not null check (octet_length(data::text) <= 2000000),
  computed_at timestamptz not null default now(),
  -- Last time the stored run was checked against the newest HRRR run.
  checked_at timestamptz not null default now(),
  -- Last time a visitor asked for it: the scheduled refresh skips engines nobody is viewing.
  wanted_at timestamptz not null default now(),
  -- Claimed while a refresh runs, so two servers never compute the same map at once.
  refreshing_at timestamptz
);
alter table public.engine_maps enable row level security;
-- No policies: visitors get these through /api/engines/field, never straight from the table.

-- Every 20 minutes, refresh the engines someone viewed in the last few hours once a newer
-- HRRR run is out (the route skips everything else, so idle hours cost nothing).
select cron.schedule(
  'engine-maps',
  '7,27,47 * * * *',
  $$ select net.http_get(
    url := 'https://weather.sswx.space/api/cron/engines',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'db_cron_secret')),
    timeout_milliseconds := 60000
  ); $$
);
