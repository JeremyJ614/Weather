-- Phase 28 + owner fixes: pins can be moved until the midnight Eastern reset
-- (no noon lock); admins adjust points and enter past champions; monthly and
-- yearly titles live in one hall.

-- Members place or move only today's pins (Eastern) and can never set scores.
create or replace function public.game_guess_guard()
returns trigger language plpgsql set search_path = '' as $$
declare
  today date := (now() at time zone 'America/New_York')::date;
begin
  if auth.role() = 'service_role' then return new; end if;
  if tg_op = 'UPDATE' then
    if old.guess_date <> today or old.points is not null then
      raise exception 'only today''s pins can move';
    end if;
    new.user_id := old.user_id;
    new.guess_date := old.guess_date;
    new.created_at := old.created_at;
  else
    new.created_at := now();
  end if;
  if new.guess_date <> today then
    raise exception 'only today''s round can be played';
  end if;
  new.severe_points := null;
  new.tornado_points := null;
  new.points := null;
  new.scored_at := null;
  return new;
end;
$$;

create policy "members move own guess" on public.game_guesses
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Admin adjustments join the ledger as their own source.
alter table public.game_points drop constraint if exists game_points_source_check;
alter table public.game_points add constraint game_points_source_check
  check (source in ('forecast_game', 'trivia', 'admin'));
create policy "leaderboard admins adjust points" on public.game_points
  for insert to authenticated
  with check (source = 'admin' and (select public.can_admin('leaderboard')));
create policy "leaderboard admins read points" on public.game_points
  for select to authenticated using ((select public.can_admin('leaderboard')));

-- Retention: kept as the hall of champions; a member's link clears when the account goes.
create table if not exists public.game_titles (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('month', 'year')),
  period text not null check (
    (kind = 'month' and period ~ '^\d{4}-(0[1-9]|1[0-2])$')
    or (kind = 'year' and period ~ '^\d{4}$')),
  user_id uuid references auth.users (id) on delete set null,
  name text check (char_length(name) between 1 and 60),
  points integer,
  entered_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (kind, period),
  check (user_id is not null or name is not null)
);
alter table public.game_titles enable row level security;
create policy "members read titles" on public.game_titles
  for select to authenticated using (true);
create policy "leaderboard admins add titles" on public.game_titles
  for insert to authenticated with check ((select public.can_admin('leaderboard')));
create policy "leaderboard admins edit titles" on public.game_titles
  for update to authenticated
  using ((select public.can_admin('leaderboard')))
  with check ((select public.can_admin('leaderboard')));
create policy "leaderboard admins remove titles" on public.game_titles
  for delete to authenticated using ((select public.can_admin('leaderboard')));

insert into public.game_titles (kind, period, user_id, points, created_at)
  select 'month', w.month, w.user_id, w.points, w.created_at from public.game_winners w
  on conflict do nothing;
comment on table public.game_winners is 'Retired: superseded by game_titles (rows copied). Empty and unused.';

-- A member's display name, the same everywhere on the boards.
create or replace function public.member_name(p_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(
    case when p.use_nickname and p.nickname is not null then p.nickname
         else p.first_name || ' ' || left(p.last_name, 1) || '.' end, 'Member')
  from public.profiles p where p.id = p_id and (select auth.uid()) is not null;
$$;

-- The hall: every monthly and yearly title, newest first.
create or replace function public.game_hall()
returns table (kind text, period text, name text, points integer, entered boolean)
language sql stable security definer set search_path = '' as $$
  select t.kind, t.period,
         coalesce(t.name, public.member_name(t.user_id), 'Former member'),
         t.points, t.entered_by is not null
  from public.game_titles t
  where (select auth.uid()) is not null
  order by t.period desc, t.kind desc
  limit 240;
$$;
grant execute on function public.game_hall() to authenticated;

-- Members (for the admin picker): id and display name, admins only.
create or replace function public.game_members(p_q text)
returns table (user_id uuid, name text)
language sql stable security definer set search_path = '' as $$
  select p.id, public.member_name(p.id)
  from public.profiles p
  where (select public.can_admin('leaderboard'))
    and (p.first_name ilike p_q || '%' or p.last_name ilike p_q || '%'
         or p.nickname ilike p_q || '%')
  order by p.first_name limit 12;
$$;
grant execute on function public.game_members(text) to authenticated;

-- Weather News also runs on the database scheduler (Vercel cron alone missed runs).
select cron.schedule('weather-news-daily', '5 11,12 * * *', $$
  select net.http_get(
    url := 'https://weather.sswx.space/api/cron/weather-news',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'db_cron_secret')),
    timeout_milliseconds := 60000
  );
$$);

-- Boards count every source (admin adjustments add points, not plays).
create or replace function public.game_board(p_from date, p_to date, p_source text default null)
returns table (user_id uuid, name text, points bigint, games bigint)
language sql stable security definer set search_path = '' as $$
  select g.user_id, public.member_name(g.user_id),
         sum(g.points)::bigint,
         count(*) filter (where g.source <> 'admin')::bigint
  from public.game_points g
  where g.earned_on between p_from and p_to
    and (p_source is null or g.source = p_source)
    and (select auth.uid()) is not null
  group by g.user_id
  having sum(g.points) <> 0
  order by 3 desc, 4 asc
  limit 100;
$$;
