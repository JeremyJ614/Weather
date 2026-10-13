-- Phase 27: Daily Trivia. Three questions a day (two weather, one random topic) from
-- Gemini, editable by admins, who can add questions, set any question's points
-- and mark a Bonus Question. Members never read the answer key: they get
-- today's questions through trivia_today() and are graded by trivia_answer().

-- Retention: questions are kept as the archive (small); removed only by an admin.
create table if not exists public.trivia_questions (
  id uuid primary key default gen_random_uuid(),
  ask_date date not null,
  slot smallint not null check (slot between 1 and 20),
  category text not null default 'weather' check (category in ('weather', 'random')),
  question text not null check (char_length(question) between 8 and 300),
  choices text[] not null check (cardinality(choices) between 2 and 6),
  answer_index smallint not null,
  explanation text check (char_length(explanation) <= 600),
  points integer not null default 150 check (points between 0 and 10000),
  bonus boolean not null default false,
  source text not null default 'admin' check (source in ('ai', 'admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ask_date, slot),
  check (answer_index >= 0 and answer_index < cardinality(choices))
);
alter table public.trivia_questions enable row level security;
-- Members have no direct access at all; admins with the Trivia permission manage everything.
create policy "trivia admins read questions" on public.trivia_questions
  for select to authenticated using ((select public.can_admin('trivia')));
create policy "trivia admins add questions" on public.trivia_questions
  for insert to authenticated with check ((select public.can_admin('trivia')));
create policy "trivia admins edit questions" on public.trivia_questions
  for update to authenticated
  using ((select public.can_admin('trivia')))
  with check ((select public.can_admin('trivia')));
create policy "trivia admins remove questions" on public.trivia_questions
  for delete to authenticated using ((select public.can_admin('trivia')));

-- Retention: one row per member per question; removed with the account; over 2 years pruned daily.
create table if not exists public.trivia_answers (
  id bigint generated always as identity primary key,
  question_id uuid not null references public.trivia_questions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  choice_index smallint not null,
  correct boolean not null,
  points integer not null,
  answered_at timestamptz not null default now(),
  unique (question_id, user_id)
);
alter table public.trivia_answers enable row level security;
create policy "members read own answers" on public.trivia_answers
  for select to authenticated using (user_id = (select auth.uid()));
-- No insert/update policies: answers are written only by trivia_answer().

-- Today's active questions (Eastern), with the key only for ones already answered.
create or replace function public.trivia_today()
returns table (
  id uuid, slot smallint, category text, question text, choices text[],
  points integer, bonus boolean,
  answered boolean, choice_index smallint, correct boolean, earned integer,
  answer_index smallint, explanation text)
language sql stable security definer set search_path = '' as $$
  select q.id, q.slot, q.category, q.question, q.choices, q.points, q.bonus,
         a.id is not null, a.choice_index, a.correct, a.points,
         case when a.id is not null then q.answer_index end,
         case when a.id is not null then q.explanation end
  from public.trivia_questions q
  left join public.trivia_answers a
    on a.question_id = q.id and a.user_id = (select auth.uid())
  where (select auth.uid()) is not null
    and q.active
    and q.ask_date = (now() at time zone 'America/New_York')::date
  order by q.bonus, q.slot;
$$;
grant execute on function public.trivia_today() to authenticated;

-- Grades one answer once and pays correct ones into the shared points ledger.
create or replace function public.trivia_answer(p_question uuid, p_choice integer)
returns table (correct boolean, earned integer, answer_index smallint, explanation text)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  q public.trivia_questions;
  ok boolean;
  pts integer;
  fresh integer;
begin
  if uid is null then raise exception 'sign in to play' using errcode = '42501'; end if;
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
    values (q.id, uid, p_choice, ok, pts)
    on conflict (question_id, user_id) do nothing;
  get diagnostics fresh = row_count;
  if fresh = 1 and pts > 0 then
    insert into public.game_points (user_id, source, points, earned_on, detail)
      values (uid, 'trivia', pts, q.ask_date,
              jsonb_build_object('question', q.id, 'bonus', q.bonus));
  end if;
  return query
    select a.correct, a.points, q.answer_index, q.explanation
    from public.trivia_answers a where a.question_id = q.id and a.user_id = uid;
end;
$$;
grant execute on function public.trivia_answer(uuid, integer) to authenticated;

-- Trivia questions are made shortly after midnight Eastern (both UTC hours, for daylight saving).
select cron.schedule('trivia-daily', '2 4,5 * * *', $$
  select net.http_get(
    url := 'https://weather.sswx.space/api/cron/trivia',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'db_cron_secret')),
    timeout_milliseconds := 60000
  );
$$);

-- Duplicate guard (BuildPlan §6): a fingerprint of each question's normalized words;
-- the generator also checks word similarity against the past year before saving.
alter table public.trivia_questions add column if not exists fingerprint text check (char_length(fingerprint) <= 64);
create index if not exists trivia_questions_fingerprint on public.trivia_questions (fingerprint);
create index if not exists trivia_questions_day on public.trivia_questions (ask_date);
