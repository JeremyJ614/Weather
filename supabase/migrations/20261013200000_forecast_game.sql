-- Phase 26: Forecast Game. One locked pair of pins per member per Eastern day;
-- scored server-side against SPC storm reports; points mirrored into a shared
-- ledger (Trivia joins it in phase 27).

-- Retention: one row per member per day; removed with the account; over 2 years pruned daily.
create table if not exists public.game_guesses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  guess_date date not null,
  lat double precision not null check (lat between 18 and 72),
  lon double precision not null check (lon between -180 and -60),
  city_label text check (char_length(city_label) <= 80),
  tor_lat double precision check (tor_lat between 18 and 72),
  tor_lon double precision check (tor_lon between -180 and -60),
  tor_city_label text check (char_length(tor_city_label) <= 80),
  severe_points integer,
  tornado_points integer,
  points integer,
  scored_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, guess_date),
  check ((tor_lat is null) = (tor_lon is null))
);
alter table public.game_guesses enable row level security;

create policy "members read own guesses" on public.game_guesses
  for select to authenticated using (user_id = (select auth.uid()));
create policy "members lock own guess" on public.game_guesses
  for insert to authenticated with check (user_id = (select auth.uid()));

-- Members may only lock today's round (Eastern), before noon Eastern, and can't set scores.
create or replace function public.game_guess_guard()
returns trigger language plpgsql set search_path = '' as $$
declare
  et timestamp := now() at time zone 'America/New_York';
begin
  if auth.role() = 'service_role' then return new; end if;
  if tg_op = 'UPDATE' then
    raise exception 'locked guesses cannot change';
  end if;
  if new.guess_date <> et::date then
    raise exception 'only today''s round can be played';
  end if;
  if et::time >= time '12:00' then
    raise exception 'today''s round closed at noon Eastern';
  end if;
  new.severe_points := null;
  new.tornado_points := null;
  new.points := null;
  new.scored_at := null;
  new.created_at := now();
  return new;
end;
$$;
create or replace trigger game_guess_guard before insert or update on public.game_guesses
  for each row execute function public.game_guess_guard();

-- Retention: removed with the account; over 2 years pruned daily (boards span a month).
create table if not exists public.game_points (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null check (source in ('forecast_game', 'trivia')),
  points integer not null,
  earned_on date not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.game_points enable row level security;
create policy "members read own points" on public.game_points
  for select to authenticated using (user_id = (select auth.uid()));
create index if not exists game_points_earned on public.game_points (earned_on);

-- Members can't write the ledger at all (no insert/update policies); only the scorer can.

-- Retention: one row per month, kept as the hall of champions.
create table if not exists public.game_winners (
  month text primary key check (month ~ '^\d{4}-\d{2}$'),
  user_id uuid references auth.users (id) on delete set null,
  points integer not null,
  created_at timestamptz not null default now()
);
alter table public.game_winners enable row level security;
create policy "members read winners" on public.game_winners
  for select to authenticated using (true);

-- Leaderboard: totals per member for a date range, with display names only.
create or replace function public.game_board(p_from date, p_to date, p_source text default null)
returns table (user_id uuid, name text, points bigint, games bigint)
language sql stable security definer set search_path = '' as $$
  select g.user_id,
         coalesce(case when p.use_nickname and p.nickname is not null then p.nickname
                       else p.first_name || ' ' || left(p.last_name, 1) || '.' end, 'Member') as name,
         sum(g.points)::bigint, count(*)::bigint
  from public.game_points g
  left join public.profiles p on p.id = g.user_id
  where g.earned_on between p_from and p_to
    and (p_source is null or g.source = p_source)
    and (select auth.uid()) is not null
  group by g.user_id, p.use_nickname, p.nickname, p.first_name, p.last_name
  order by 3 desc, 4 asc
  limit 100;
$$;
grant execute on function public.game_board(date, date, text) to authenticated;

-- Winner names for the hall of champions.
create or replace function public.game_champions()
returns table (month text, name text, points integer)
language sql stable security definer set search_path = '' as $$
  select w.month,
         coalesce(case when p.use_nickname and p.nickname is not null then p.nickname
                       else p.first_name || ' ' || left(p.last_name, 1) || '.' end, 'Member'),
         w.points
  from public.game_winners w left join public.profiles p on p.id = w.user_id
  where (select auth.uid()) is not null
  order by w.month desc limit 24;
$$;
grant execute on function public.game_champions() to authenticated;
