-- Weather News tab: daily collected stories and admin curation. Applied 2026-10-13.

-- Retention: at most 40 rows, replaced by each daily collection.
create table if not exists public.weather_news_items (
  url text primary key check (char_length(url) <= 500),
  title text not null check (char_length(title) <= 300),
  source text not null check (char_length(source) <= 40),
  snippet text check (char_length(snippet) <= 300),
  severity integer not null default 0,
  published_at timestamptz,
  fetched_at timestamptz not null default now()
);
alter table public.weather_news_items enable row level security;
create policy "weather news is public" on public.weather_news_items
  for select to anon, authenticated using (true);

-- Retention: rows older than 30 days pruned by the daily cron.
create table if not exists public.news_curation (
  url text primary key check (char_length(url) <= 500),
  action text not null check (action in ('pin', 'hide')),
  position integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.news_curation enable row level security;
create policy "curation is public" on public.news_curation
  for select to anon, authenticated using (true);
create policy "news admins curate" on public.news_curation
  for insert to authenticated with check ((select public.can_admin('news')));
create policy "news admins recurate" on public.news_curation
  for update to authenticated using ((select public.can_admin('news'))) with check ((select public.can_admin('news')));
create policy "news admins uncurate" on public.news_curation
  for delete to authenticated using ((select public.can_admin('news')));
