-- View-as for Weekly Polls: the owner sees and casts a member's vote, audited.

create or replace function public.lens_poll_list(p_user uuid)
returns table (
  id uuid, question text, options text[], note text, starts_on date, ends_on date,
  open boolean, my_choice smallint, tallies integer[], total integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.lens_target_ok(p_user) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
  with today as (select (now() at time zone 'America/New_York')::date as d),
  shown as (
    select p.*, (p.starts_on <= t.d and p.ends_on >= t.d) as is_open, v.choice as mine
    from public.polls p cross join today t
    left join public.poll_votes v on v.poll_id = p.id and v.user_id = p_user
    where p.starts_on <= t.d
    order by p.starts_on desc
    limit 26
  )
  select s.id, s.question, s.options, s.note, s.starts_on, s.ends_on, s.is_open, s.mine,
         case when s.mine is not null or not s.is_open then
           (select array_agg((select count(*) from public.poll_votes x
                               where x.poll_id = s.id and x.choice = i - 1)::integer order by i)
            from generate_subscripts(s.options, 1) i)
         end,
         case when s.mine is not null or not s.is_open then
           (select count(*)::integer from public.poll_votes x where x.poll_id = s.id)
         end
  from shown s
  order by s.is_open desc, s.starts_on desc;
end;
$$;
grant execute on function public.lens_poll_list(uuid) to authenticated;

create or replace function public.lens_poll_vote(p_user uuid, p_poll uuid, p_choice integer)
returns void language plpgsql security definer set search_path = '' as $$
declare
  p public.polls;
  today date := (now() at time zone 'America/New_York')::date;
begin
  if not public.lens_target_ok(p_user) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into p from public.polls where id = p_poll and starts_on <= today and ends_on >= today;
  if not found then raise exception 'this poll is closed' using errcode = 'P0002'; end if;
  if p_choice < 0 or p_choice >= cardinality(p.options) then
    raise exception 'pick one of the options' using errcode = '22023';
  end if;
  insert into public.poll_votes (poll_id, user_id, choice) values (p.id, p_user, p_choice)
    on conflict (poll_id, user_id) do nothing;
  perform public.log_admin('vote_as', public.member_name(p_user),
    jsonb_build_object('member', p_user, 'poll', p.id, 'choice', p_choice));
end;
$$;
grant execute on function public.lens_poll_vote(uuid, uuid, integer) to authenticated;
