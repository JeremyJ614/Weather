-- Phase 29: Weekly Polls. Admins schedule a poll per week (Monday to Sunday,
-- Eastern). Members vote once and see results only after voting (BuildPlan §6);
-- scheduled polls stay hidden until their week opens.

-- Retention: polls are kept as the archive (small); removed only by an admin.
create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  question text not null check (char_length(question) between 8 and 200),
  options text[] not null check (cardinality(options) between 2 and 6),
  note text check (char_length(note) <= 300),
  starts_on date not null,
  ends_on date not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
alter table public.polls enable row level security;
create index if not exists polls_week on public.polls (starts_on desc);
create policy "poll admins read polls" on public.polls
  for select to authenticated using ((select public.can_admin('polls')));
create policy "poll admins add polls" on public.polls
  for insert to authenticated with check ((select public.can_admin('polls')));
create policy "poll admins edit polls" on public.polls
  for update to authenticated
  using ((select public.can_admin('polls')))
  with check ((select public.can_admin('polls')));
create policy "poll admins remove polls" on public.polls
  for delete to authenticated using ((select public.can_admin('polls')));

-- Retention: one row per member per poll; removed with the account; over 2 years pruned daily.
create table if not exists public.poll_votes (
  id bigint generated always as identity primary key,
  poll_id uuid not null references public.polls (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  choice smallint not null,
  voted_at timestamptz not null default now(),
  unique (poll_id, user_id)
);
alter table public.poll_votes enable row level security;
create policy "members read own votes" on public.poll_votes
  for select to authenticated using (user_id = (select auth.uid()));
create policy "poll admins read votes" on public.poll_votes
  for select to authenticated using ((select public.can_admin('polls')));
-- No insert policy: votes are written only by poll_vote().

-- Open and past polls (newest first); tallies only once voted or closed.
create or replace function public.poll_list()
returns table (
  id uuid, question text, options text[], note text, starts_on date, ends_on date,
  open boolean, my_choice smallint, tallies integer[], total integer)
language sql stable security definer set search_path = '' as $$
  with today as (select (now() at time zone 'America/New_York')::date as d),
  shown as (
    select p.*, (p.starts_on <= t.d and p.ends_on >= t.d) as is_open,
           v.choice as mine
    from public.polls p cross join today t
    left join public.poll_votes v on v.poll_id = p.id and v.user_id = (select auth.uid())
    where (select auth.uid()) is not null and p.starts_on <= t.d
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
$$;
grant execute on function public.poll_list() to authenticated;

-- One vote per member on an open poll.
create or replace function public.poll_vote(p_poll uuid, p_choice integer)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  p public.polls;
  today date := (now() at time zone 'America/New_York')::date;
begin
  if uid is null then raise exception 'sign in to vote' using errcode = '42501'; end if;
  select * into p from public.polls where id = p_poll and starts_on <= today and ends_on >= today;
  if not found then raise exception 'this poll is closed' using errcode = 'P0002'; end if;
  if p_choice < 0 or p_choice >= cardinality(p.options) then
    raise exception 'pick one of the options' using errcode = '22023';
  end if;
  insert into public.poll_votes (poll_id, user_id, choice) values (p.id, uid, p_choice)
    on conflict (poll_id, user_id) do nothing;
end;
$$;
grant execute on function public.poll_vote(uuid, integer) to authenticated;
