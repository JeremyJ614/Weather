-- Fix-It #4 (ported from VIP): "View as member". The owner keeps their own session; pages
-- show a member's view through these owner-only functions, and anything played as the
-- member is written for them and recorded in the audit log under the owner's name.

create or replace function public.lens_target_ok(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_role('founder')
     and p_user <> (select auth.uid())
     and exists (select 1 from public.profiles where id = p_user)
     and not exists (select 1 from public.user_roles
                     where user_id = p_user and role in ('admin', 'founder'));
$$;

-- The member's forecast-game rows (today's and their last scored round).
create or replace function public.lens_guesses(p_user uuid)
returns setof public.game_guesses
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.lens_target_ok(p_user) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select * from public.game_guesses g where g.user_id = p_user
    order by g.guess_date desc limit 40;
end;
$$;
grant execute on function public.lens_guesses(uuid) to authenticated;

-- Today's pins for the member (same rules as members: today only, unscored).
create or replace function public.lens_save_pins(
  p_user uuid, p_lat double precision, p_lon double precision, p_label text,
  p_tlat double precision, p_tlon double precision, p_tlabel text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'America/New_York')::date;
begin
  if not public.lens_target_ok(p_user) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.game_guesses (user_id, guess_date, lat, lon, city_label, tor_lat, tor_lon, tor_city_label)
    values (p_user, today, p_lat, p_lon, left(p_label, 80), p_tlat, p_tlon, left(p_tlabel, 80))
    on conflict (user_id, guess_date) do update set
      lat = excluded.lat, lon = excluded.lon, city_label = excluded.city_label,
      tor_lat = excluded.tor_lat, tor_lon = excluded.tor_lon, tor_city_label = excluded.tor_city_label;
  perform public.log_admin('play_as_forecast', public.member_name(p_user),
    jsonb_build_object('member', p_user, 'date', today));
end;
$$;
grant execute on function public.lens_save_pins(uuid, double precision, double precision, text, double precision, double precision, text) to authenticated;

-- Today's trivia as the member sees it (answer key only for questions they answered).
create or replace function public.lens_trivia_today(p_user uuid)
returns table (
  id uuid, slot smallint, category text, question text, choices text[],
  points integer, bonus boolean,
  answered boolean, choice_index smallint, correct boolean, earned integer,
  answer_index smallint, explanation text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.lens_target_ok(p_user) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select q.id, q.slot, q.category, q.question, q.choices, q.points, q.bonus,
           a.id is not null, a.choice_index, a.correct, a.points,
           case when a.id is not null then q.answer_index end,
           case when a.id is not null then q.explanation end
    from public.trivia_questions q
    left join public.trivia_answers a on a.question_id = q.id and a.user_id = p_user
    where q.active and q.ask_date = (now() at time zone 'America/New_York')::date
    order by q.bonus, q.slot;
end;
$$;
grant execute on function public.lens_trivia_today(uuid) to authenticated;

-- One trivia answer for the member, graded and paid exactly like trivia_answer().
create or replace function public.lens_trivia_answer(p_user uuid, p_question uuid, p_choice integer)
returns table (correct boolean, earned integer, answer_index smallint, explanation text)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  q public.trivia_questions;
  ok boolean;
  pts integer;
  fresh integer;
begin
  if not public.lens_target_ok(p_user) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into q from public.trivia_questions t
    where t.id = p_question and t.active
      and t.ask_date = (now() at time zone 'America/New_York')::date;
  if not found then raise exception 'that question is not open' using errcode = 'P0002'; end if;
  if p_choice < 0 or p_choice >= cardinality(q.choices) then
    raise exception 'pick one of the choices' using errcode = '22023';
  end if;
  ok := p_choice = q.answer_index;
  pts := case when ok then q.points else 0 end;
  insert into public.trivia_answers (question_id, user_id, choice_index, correct, points)
    values (q.id, p_user, p_choice, ok, pts)
    on conflict (question_id, user_id) do nothing;
  get diagnostics fresh = row_count;
  if fresh = 1 and pts > 0 then
    insert into public.game_points (user_id, source, points, earned_on, detail)
      values (p_user, 'trivia', pts, q.ask_date,
              jsonb_build_object('question', q.id, 'bonus', q.bonus, 'via', 'view-as'));
  end if;
  if fresh = 1 then
    perform public.log_admin('play_as_trivia', public.member_name(p_user),
      jsonb_build_object('member', p_user, 'question', q.id, 'correct', ok));
  end if;
  return query
    select a.correct, a.points, q.answer_index, q.explanation
    from public.trivia_answers a where a.question_id = q.id and a.user_id = p_user;
end;
$$;
grant execute on function public.lens_trivia_answer(uuid, uuid, integer) to authenticated;
