-- Ops foundation: app settings, the Mapbox map-load counter, and the storage watchdog.
-- Every table here has RLS on and no policies: only the security-definer functions below touch them.

-- Retention: a fixed set of setting keys; does not grow.
create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_config enable row level security;

-- Mapbox's free tier is 50,000 map loads a month; switch to MapLibre with margin.
insert into public.app_config (key, value) values ('mapbox_monthly_limit', '45000'::jsonb)
on conflict (key) do nothing;

-- One row per UTC month. Retention: 24 months (pruned daily by take_storage_snapshot).
create table if not exists public.map_load_months (
  month date primary key,
  mapbox_loads integer not null default 0 check (mapbox_loads >= 0)
);
alter table public.map_load_months enable row level security;

-- Which map library to use right now.
create or replace function public.map_provider()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when coalesce((
      select m.mapbox_loads from public.map_load_months m
      where m.month = date_trunc('month', now() at time zone 'utc')::date), 0)
    < (select (c.value)::int from public.app_config c where c.key = 'mapbox_monthly_limit')
  then 'mapbox' else 'maplibre' end;
$$;

-- Called once before each Mapbox map is created. False means the month's budget is spent:
-- use MapLibre. The worst a caller can do is force the free fallback early.
create or replace function public.count_map_load()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  lim int := (select (c.value)::int from public.app_config c where c.key = 'mapbox_monthly_limit');
  m date := date_trunc('month', now() at time zone 'utc')::date;
  n int;
begin
  insert into public.map_load_months as t (month, mapbox_loads) values (m, 1)
  on conflict (month) do update set mapbox_loads = t.mapbox_loads + 1
  where t.mapbox_loads < lim
  returning mapbox_loads into n;
  return n is not null;
end;
$$;

revoke all on function public.map_provider() from public;
revoke all on function public.count_map_load() from public;
grant execute on function public.map_provider() to anon, authenticated;
grant execute on function public.count_map_load() to anon, authenticated;

-- Storage watchdog: one size reading a day, taken by the Vercel cron
-- (/api/cron/storage-watchdog). Retention: 400 days.
create table if not exists public.storage_snapshots (
  day date primary key,
  db_bytes bigint not null,
  storage_bytes bigint not null,
  taken_at timestamptz not null default now()
);
alter table public.storage_snapshots enable row level security;

create or replace function public.take_storage_snapshot()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.storage_snapshots (day, db_bytes, storage_bytes)
  values (
    (now() at time zone 'utc')::date,
    pg_catalog.pg_database_size(pg_catalog.current_database()),
    coalesce((select sum((o.metadata->>'size')::bigint) from storage.objects o), 0)
  )
  on conflict (day) do update
    set db_bytes = excluded.db_bytes, storage_bytes = excluded.storage_bytes, taken_at = now();

  delete from public.storage_snapshots where day < (now() at time zone 'utc')::date - 400;
  delete from public.map_load_months
    where month < date_trunc('month', now() at time zone 'utc')::date - interval '24 months';
end;
$$;
revoke all on function public.take_storage_snapshot() from public, anon, authenticated;

create extension if not exists pg_cron;
-- pg_cron keeps a row per run forever unless pruned (part of the VIP leak); keep 7 days.
select cron.schedule('cron-history-prune', '23 6 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$);

select public.take_storage_snapshot();
