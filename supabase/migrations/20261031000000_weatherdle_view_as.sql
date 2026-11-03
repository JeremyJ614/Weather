-- Weatherdle while the owner views the app as a member (admin → Members → View as).
-- The game moves into *_for(uid) functions no client can call; the member's own
-- functions pass auth.uid(), and the lens_* ones pass the member after lens_target_ok().

create or replace function public.weatherdle_state_for(uid uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
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
revoke execute on function public.weatherdle_state_for(uuid) from public, anon, authenticated;

create or replace function public.weatherdle_guess_for(uid uuid, p_guess text, p_via text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
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
              jsonb_strip_nulls(jsonb_build_object('tries', cardinality(p.guesses), 'hint', p.hint_used, 'via', p_via)));
  else
    update public.weatherdle_plays
      set guesses = p.guesses, updated_at = now()
      where day = today and user_id = uid;
  end if;
  return public.weatherdle_state_for(uid);
end;
$$;
revoke execute on function public.weatherdle_guess_for(uuid, text, text) from public, anon, authenticated;

create or replace function public.weatherdle_hint_for(uid uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
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
  return public.weatherdle_state_for(uid);
end;
$$;
revoke execute on function public.weatherdle_hint_for(uuid) from public, anon, authenticated;

create or replace function public.weatherdle_state()
returns jsonb language sql stable security definer set search_path = '' as $$
  select public.weatherdle_state_for(auth.uid());
$$;
create or replace function public.weatherdle_guess(p_guess text)
returns jsonb language sql security definer set search_path = '' as $$
  select public.weatherdle_guess_for(auth.uid(), p_guess);
$$;
create or replace function public.weatherdle_hint()
returns jsonb language sql security definer set search_path = '' as $$
  select public.weatherdle_hint_for(auth.uid());
$$;

create or replace function public.lens_weatherdle_state(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.lens_target_ok(p_user) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return public.weatherdle_state_for(p_user);
end;
$$;
grant execute on function public.lens_weatherdle_state(uuid) to authenticated;

create or replace function public.lens_weatherdle_guess(p_user uuid, p_guess text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  st jsonb;
begin
  if not public.lens_target_ok(p_user) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  st := public.weatherdle_guess_for(p_user, p_guess, 'view-as');
  perform public.log_admin('play_as_weatherdle', public.member_name(p_user),
    jsonb_build_object('member', p_user, 'solved', st -> 'solved'));
  return st;
end;
$$;
grant execute on function public.lens_weatherdle_guess(uuid, text) to authenticated;

create or replace function public.lens_weatherdle_hint(p_user uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.lens_target_ok(p_user) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  perform public.log_admin('play_as_weatherdle_hint', public.member_name(p_user),
    jsonb_build_object('member', p_user));
  return public.weatherdle_hint_for(p_user);
end;
$$;
grant execute on function public.lens_weatherdle_hint(uuid) to authenticated;

-- The member's past rounds, for their streak and stats while viewing as them.
create or replace function public.lens_weatherdle_plays(p_user uuid)
returns table (day date, solved boolean, guesses text[])
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.lens_target_ok(p_user) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select w.day, w.solved, w.guesses from public.weatherdle_plays w
    where w.user_id = p_user order by w.day desc limit 400;
end;
$$;
grant execute on function public.lens_weatherdle_plays(uuid) to authenticated;
