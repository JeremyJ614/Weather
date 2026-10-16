-- Phase 43: the Storm Chasing Outlook. One row per chase day, written by the daily engine
-- (service role only); members read them all, which is what makes the yearly stats.
-- Retention: about 3 years (~1,100 small rows), pruned by the storage watchdog.
create table if not exists public.chase_days (
  day date primary key,
  generated_at timestamptz not null default now(),
  top_score smallint not null check (top_score between 0 and 100),
  spc_cat text check (char_length(spc_cat) <= 8),
  tornado_pct smallint not null default 0 check (tornado_pct between 0 and 100),
  place text check (char_length(place) <= 80),
  data jsonb not null check (octet_length(data::text) <= 60000)
);
alter table public.chase_days enable row level security;
create policy "members read chase days" on public.chase_days
  for select to authenticated using (true);
-- No insert/update policies: only the engine (service role) writes.
