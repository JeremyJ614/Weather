-- Final List #5: Weatherdle. One weather word a day (Eastern), any length from 3 to 14
-- letters, chosen by Gemini or set by an admin, with an optional hint the admin can turn
-- on or off. Guesses are graded here, never in the browser, and a solve pays into the
-- shared points ledger with the Forecast Game and Daily Trivia.

-- Retention: one tiny row per day, kept as the archive; admins can change or clear a word.
create table if not exists public.weatherdle_words (
  day date primary key,
  word text not null check (word ~ '^[A-Z]{3,14}$'),
  hint text not null check (char_length(hint) between 4 and 200),
  source text not null default 'ai' check (source in ('ai', 'admin', 'list')),
  created_at timestamptz not null default now()
);
alter table public.weatherdle_words enable row level security;
-- Members never read the word list; admins with the Weatherdle permission manage it.
create policy "weatherdle admins read words" on public.weatherdle_words
  for select to authenticated using ((select public.can_admin('weatherdle')));
create policy "weatherdle admins add words" on public.weatherdle_words
  for insert to authenticated with check ((select public.can_admin('weatherdle')));
create policy "weatherdle admins edit words" on public.weatherdle_words
  for update to authenticated
  using ((select public.can_admin('weatherdle')))
  with check ((select public.can_admin('weatherdle')));

-- Retention: one row per member per day; removed with the account; over 2 years pruned daily.
create table if not exists public.weatherdle_plays (
  day date not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  guesses text[] not null default '{}' check (cardinality(guesses) <= 6),
  solved boolean not null default false,
  hint_used boolean not null default false,
  points integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (day, user_id)
);
alter table public.weatherdle_plays enable row level security;
create policy "members read own weatherdle" on public.weatherdle_plays
  for select to authenticated using (user_id = (select auth.uid()));
create policy "weatherdle admins read plays" on public.weatherdle_plays
  for select to authenticated using ((select public.can_admin('weatherdle')));
-- No insert/update policies: plays are written only by the functions below.

-- Hints on or off (admin → Weatherdle); read by anyone, like the other switches.
insert into public.app_config (key, value)
values ('weatherdle_settings', '{"hints": true}'::jsonb)
on conflict (key) do nothing;
create policy "weatherdle settings are public" on public.app_config
  for select to anon, authenticated using (key = 'weatherdle_settings');
create policy "weatherdle admins edit settings" on public.app_config
  for update to authenticated
  using (key = 'weatherdle_settings' and (select public.can_admin('weatherdle')))
  with check (key = 'weatherdle_settings' and (select public.can_admin('weatherdle')));

-- Weatherdle solves join the shared ledger as their own source.
alter table public.game_points drop constraint if exists game_points_source_check;
alter table public.game_points add constraint game_points_source_check
  check (source in ('forecast_game', 'trivia', 'admin', 'weatherdle'));

-- Wordle's marks for one guess: g (right spot), y (in the word), x (not in it), counting
-- repeated letters the way Wordle does (greens first, then yellows from what is left).
create or replace function public.weatherdle_marks(p_guess text, p_word text)
returns text language plpgsql immutable set search_path = '' as $$
declare
  n integer := char_length(p_word);
  marks text[] := array_fill('x'::text, array[n]);
  rest text[] := array[]::text[];
  pos integer;
begin
  for i in 1..n loop
    if substr(p_guess, i, 1) = substr(p_word, i, 1) then
      marks[i] := 'g';
    else
      rest := rest || substr(p_word, i, 1);
    end if;
  end loop;
  for i in 1..n loop
    continue when marks[i] = 'g';
    pos := array_position(rest, substr(p_guess, i, 1));
    if pos is not null then
      marks[i] := 'y';
      rest := rest[1:pos - 1] || rest[pos + 1:];
    end if;
  end loop;
  return array_to_string(marks, '');
end;
$$;

-- Points for a solve: 300 on the first try down to 100 on the sixth, 10 more for each
-- letter past five, a quarter off with the hint.
create or replace function public.weatherdle_points(p_tries integer, p_len integer, p_hint boolean)
returns integer language sql immutable set search_path = '' as $$
  select round(
    ((array[300, 250, 200, 160, 130, 100])[p_tries] + 10 * greatest(0, p_len - 5))
    * case when p_hint then 0.75 else 1 end)::integer;
$$;

-- Today's game for the signed-in member: the word's length, their graded guesses, the hint
-- once they've asked for it, and the word itself only when the game is over.
create or replace function public.weatherdle_state()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'America/New_York')::date;
  w public.weatherdle_words;
  p public.weatherdle_plays;
  hints boolean;
  done boolean;
begin
  if uid is null then raise exception 'sign in to play' using errcode = '42501'; end if;
  select coalesce((value ->> 'hints')::boolean, true) into hints
    from public.app_config where key = 'weatherdle_settings';
  select * into w from public.weatherdle_words where day = today;
  if not found then
    return jsonb_build_object('day', today, 'length', null, 'hints', coalesce(hints, true));
  end if;
  select * into p from public.weatherdle_plays where day = today and user_id = uid;
  done := coalesce(p.solved, false) or coalesce(cardinality(p.guesses), 0) >= 6;
  return jsonb_build_object(
    'day', today,
    'length', char_length(w.word),
    'tries', 6,
    'hints', coalesce(hints, true),
    'hint', case when coalesce(p.hint_used, false) or done then w.hint end,
    'hint_used', coalesce(p.hint_used, false),
    'guesses', coalesce((
      select jsonb_agg(jsonb_build_object('word', g, 'marks', public.weatherdle_marks(g, w.word)) order by i)
      from unnest(p.guesses) with ordinality as t(g, i)), '[]'::jsonb),
    'solved', coalesce(p.solved, false),
    'done', done,
    'points', coalesce(p.points, 0),
    'word', case when done then w.word end);
end;
$$;
grant execute on function public.weatherdle_state() to authenticated;

-- One guess: any letters, the word's length. A solve pays once into the points ledger.
create or replace function public.weatherdle_guess(p_guess text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'America/New_York')::date;
  g text := upper(btrim(coalesce(p_guess, '')));
  w public.weatherdle_words;
  p public.weatherdle_plays;
  pts integer := 0;
begin
  if uid is null then raise exception 'sign in to play' using errcode = '42501'; end if;
  select * into w from public.weatherdle_words where day = today;
  if not found then raise exception 'today''s word isn''t ready yet' using errcode = 'P0002'; end if;
  if g !~ '^[A-Z]+$' or char_length(g) <> char_length(w.word) then
    raise exception 'use % letters', char_length(w.word) using errcode = '22023';
  end if;
  insert into public.weatherdle_plays (day, user_id) values (today, uid)
    on conflict (day, user_id) do nothing;
  select * into p from public.weatherdle_plays where day = today and user_id = uid for update;
  if p.solved or cardinality(p.guesses) >= 6 then
    raise exception 'today''s game is over' using errcode = '22023';
  end if;
  p.guesses := p.guesses || g;
  if g = w.word then
    pts := public.weatherdle_points(cardinality(p.guesses), char_length(w.word), p.hint_used);
    update public.weatherdle_plays
      set guesses = p.guesses, solved = true, points = pts, updated_at = now()
      where day = today and user_id = uid;
    insert into public.game_points (user_id, source, points, earned_on, detail)
      values (uid, 'weatherdle', pts, today,
              jsonb_build_object('tries', cardinality(p.guesses), 'hint', p.hint_used));
  else
    update public.weatherdle_plays
      set guesses = p.guesses, updated_at = now()
      where day = today and user_id = uid;
  end if;
  return public.weatherdle_state();
end;
$$;
grant execute on function public.weatherdle_guess(text) to authenticated;

-- Reveals the hint (when hints are on), which takes a quarter off a solve.
create or replace function public.weatherdle_hint()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'America/New_York')::date;
begin
  if uid is null then raise exception 'sign in to play' using errcode = '42501'; end if;
  if not coalesce((select (value ->> 'hints')::boolean from public.app_config
                   where key = 'weatherdle_settings'), true) then
    raise exception 'hints are off today' using errcode = '22023';
  end if;
  if not exists (select 1 from public.weatherdle_words where day = today) then
    raise exception 'today''s word isn''t ready yet' using errcode = 'P0002';
  end if;
  insert into public.weatherdle_plays (day, user_id, hint_used) values (today, uid, true)
    on conflict (day, user_id) do update
      set hint_used = true, updated_at = now()
      where not public.weatherdle_plays.solved
        and cardinality(public.weatherdle_plays.guesses) < 6;
  return public.weatherdle_state();
end;
$$;
grant execute on function public.weatherdle_hint() to authenticated;

-- The word is made just after midnight Eastern (both UTC hours, for daylight saving).
select cron.schedule('weatherdle-daily', '4 4,5 * * *', $$
  select net.http_get(
    url := 'https://weather.sswx.space/api/cron/weatherdle',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'db_cron_secret')),
    timeout_milliseconds := 60000
  );
$$);

-- Admins may clear a word set for a future day (today's and past words stay as played).
create policy "weatherdle admins clear future words" on public.weatherdle_words
  for delete to authenticated
  using ((select public.can_admin('weatherdle'))
         and day > (now() at time zone 'America/New_York')::date);
