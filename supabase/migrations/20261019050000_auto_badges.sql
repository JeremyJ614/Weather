-- Automatic badges (Final Fix-It #12). Applied 2026-10-19.
-- A badge with a rule (an activity and a goal) is awarded by award_badges() the moment a
-- member's activity reaches the goal: hourly for everyone, and right away when a member
-- opens their profile. Badges without a rule are still given by hand.
alter table public.badges
  add column if not exists rule_metric text
    check (rule_metric is null or rule_metric ~ '^[a-z_]{1,20}(:[a-z0-9-]{1,48})?$'),
  add column if not exists rule_goal integer check (rule_goal is null or rule_goal between 1 and 1000000),
  add column if not exists auto_key text unique check (auto_key is null or auto_key ~ '^[a-z0-9-]{1,32}$');

-- Streaks and per-member counts read page views by member.
create index if not exists page_views_user_day on public.page_views (user_id, day);

-- Every activity a rule can count, for one member or (p_user null) everyone.
create or replace function public.badge_metrics(p_user uuid default null)
returns table (user_id uuid, metric text, value bigint)
language sql stable security definer set search_path = '' as $$
  with pv as (
    select v.user_id, v.day, v.slug from public.page_views v
    where p_user is null or v.user_id = p_user
  ),
  d as (select distinct pv.user_id, pv.day from pv),
  runs as (
    select r.user_id, count(*) as len from (
      select d.user_id, d.day - (row_number() over (partition by d.user_id order by d.day))::int as g
      from d
    ) r group by r.user_id, r.g
  ),
  paid as (
    select s.user_id, s.cycle from public.subscriptions s
    where s.status = 'active' and s.tier <> 'free' and not s.comped
      and (p_user is null or s.user_id = p_user)
  )
  select d.user_id, 'days', count(*)::bigint from d group by d.user_id
  union all select runs.user_id, 'streak', max(runs.len)::bigint from runs group by runs.user_id
  union all select pv.user_id, 'pages', count(distinct pv.slug)::bigint from pv group by pv.user_id
  union all
    select pv.user_id, b.rule_metric, count(distinct pv.day)::bigint
    from pv join public.badges b on b.rule_metric = 'page:' || pv.slug
    group by pv.user_id, b.rule_metric
  union all
    select g.user_id, 'guesses', count(*)::bigint from public.game_guesses g
    where p_user is null or g.user_id = p_user group by g.user_id
  union all
    select p.user_id, 'points', coalesce(sum(p.points), 0)::bigint from public.game_points p
    where p_user is null or p.user_id = p_user group by p.user_id
  union all
    select t.user_id, 'titles', count(*)::bigint from public.game_titles t
    where t.user_id is not null and (p_user is null or t.user_id = p_user) group by t.user_id
  union all
    select a.user_id, 'trivia', count(*)::bigint from public.trivia_answers a
    where a.correct and (p_user is null or a.user_id = p_user) group by a.user_id
  union all
    select v.user_id, 'votes', count(*)::bigint from public.poll_votes v
    where p_user is null or v.user_id = p_user group by v.user_id
  union all
    select c.user_id, 'chases', count(*)::bigint from public.chases c
    where p_user is null or c.user_id = p_user group by c.user_id
  union all
    select c.user_id, 'tornadoes', coalesce(sum(c.tornadoes), 0)::bigint from public.chases c
    where p_user is null or c.user_id = p_user group by c.user_id
  union all
    select c.user_id, 'miles', floor(coalesce(sum(c.miles), 0))::bigint from public.chases c
    where p_user is null or c.user_id = p_user group by c.user_id
  union all
    select r.referred_by, 'referrals', count(*)::bigint from public.profiles r
    where r.referred_by is not null and (p_user is null or r.referred_by = p_user)
    group by r.referred_by
  union all
    select p.id, 'member_days', floor(extract(epoch from now() - p.created_at) / 86400)::bigint
    from public.profiles p where p_user is null or p.id = p_user
  union all
    select p.id, 'founding', 1::bigint from public.profiles p
    where p.created_at < '2027-01-01' and (p_user is null or p.id = p_user)
  union all
    select n.user_id, 'alerts', 1::bigint from public.notify_prefs n
    where cardinality(n.topics) > 0 and (p_user is null or n.user_id = p_user)
  union all
    select distinct s.user_id, 'push', 1::bigint from public.push_subscriptions s
    where p_user is null or s.user_id = p_user
  union all
    select b.user_id, 'brief', 1::bigint from public.brief_subscriptions b
    where p_user is null or b.user_id = p_user
  union all select paid.user_id, 'paid', 1::bigint from paid
  union all select paid.user_id, 'yearly', 1::bigint from paid where paid.cycle = 'year';
$$;
revoke all on function public.badge_metrics(uuid) from public, anon, authenticated;
grant execute on function public.badge_metrics(uuid) to service_role;

-- Gives every badge whose goal has been reached; returns the ones newly given.
create or replace function public.award_badges(p_user uuid default null)
returns table (user_id uuid, badge_id uuid)
language sql volatile security definer set search_path = '' as $$
  insert into public.member_badges (user_id, badge_id)
  select m.user_id, b.id
  from public.badge_metrics(p_user) m
  join public.badges b on b.rule_metric = m.metric and m.value >= b.rule_goal
  on conflict do nothing
  returning member_badges.user_id, member_badges.badge_id;
$$;
revoke all on function public.award_badges(uuid) from public, anon, authenticated;
grant execute on function public.award_badges(uuid) to service_role;

-- A member's own: newly earned badges, and how far along every rule is.
create or replace function public.award_my_badges()
returns setof uuid
language sql volatile security definer set search_path = '' as $$
  select a.badge_id from public.award_badges((select auth.uid())) a
  where (select auth.uid()) is not null;
$$;
revoke all on function public.award_my_badges() from public, anon;
grant execute on function public.award_my_badges() to authenticated;

create or replace function public.my_badge_progress()
returns table (metric text, value bigint)
language sql stable security definer set search_path = '' as $$
  select m.metric, m.value from public.badge_metrics((select auth.uid())) m
  where (select auth.uid()) is not null;
$$;
revoke all on function public.my_badge_progress() from public, anon;
grant execute on function public.my_badge_progress() to authenticated;

-- Hourly, for everyone (pure SQL, nothing leaves the database).
select cron.schedule('award-badges', '17 * * * *', $$select count(*) from public.award_badges()$$);

insert into public.badges (auto_key, name, description, icon, rarity, grp, rule_metric, rule_goal) values
  ('first-look', 'First Look', 'Opened StormSync Weather for the first time.', 'Eye', 'common', 'Getting started', 'days', 1),
  ('regular', 'Regular', 'Checked the weather here on 7 different days.', 'CalendarCheck', 'common', 'Getting started', 'days', 7),
  ('explorer', 'Explorer', 'Visited 10 different pages.', 'Compass', 'common', 'Getting started', 'pages', 10),
  ('on-alert', 'On Alert', 'Turned on weather alerts.', 'BellRing', 'common', 'Getting started', 'alerts', 1),
  ('early-riser', 'Early Riser', 'Signed up for the Daily Brief.', 'Sunrise', 'common', 'Getting started', 'brief', 1),
  ('pocket-radar', 'Pocket Radar', 'Turned on push alerts on a phone or computer.', 'Smartphone', 'common', 'Getting started', 'push', 1),
  ('first-call', 'First Call', 'Made your first forecast in the Wx Game.', 'Crosshair', 'common', 'Games', 'guesses', 1),
  ('quiz-taker', 'Quiz Taker', 'Answered 5 trivia questions right.', 'Lightbulb', 'common', 'Games', 'trivia', 5),
  ('voice', 'Voice of the Crowd', 'Voted in 3 weekly polls.', 'Vote', 'common', 'Community', 'votes', 3),
  ('logbook', 'Logbook', 'Saved your first chase to the Chasing Log.', 'Route', 'common', 'Chasing', 'chases', 1),
  ('week-streak', 'Seven-Day Streak', 'Checked in 7 days in a row.', 'Flame', 'rare', 'Regulars', 'streak', 7),
  ('cartographer', 'Cartographer', 'Visited 30 different pages.', 'MapPinned', 'rare', 'Regulars', 'pages', 30),
  ('tropics-watch', 'Tropics Watcher', 'Checked the Tropical Outlook on 10 different days.', 'Orbit', 'rare', 'Regulars', 'page:tropical-outlook', 10),
  ('storm-scholar', 'Storm Scholar', 'Answered 25 trivia questions right.', 'BookOpen', 'rare', 'Games', 'trivia', 25),
  ('sharpshooter', 'Sharpshooter', 'Earned 500 game points.', 'Target', 'rare', 'Games', 'points', 500),
  ('month-streak', 'Thirty-Day Streak', 'Checked in 30 days in a row.', 'Zap', 'epic', 'Regulars', 'streak', 30),
  ('trivia-ace', 'Trivia Ace', 'Answered 100 trivia questions right.', 'GraduationCap', 'epic', 'Games', 'trivia', 100),
  ('storm-chaser', 'Storm Chaser', 'Logged 10 chases.', 'Car', 'epic', 'Chasing', 'chases', 10),
  ('tornado-witness', 'Tornado Witness', 'Logged chases with 10 tornadoes between them.', 'Tornado', 'epic', 'Chasing', 'tornadoes', 10),
  ('recruiter', 'Recruiter', 'Brought 3 friends to StormSync.', 'UserPlus', 'epic', 'Community', 'referrals', 3),
  ('ironman', 'Season Ironman', 'Checked in 100 days in a row.', 'Infinity', 'legendary', 'Legends', 'streak', 100),
  ('champion', 'Champion', 'Won a Wx Game title.', 'Crown', 'legendary', 'Legends', 'titles', 1),
  ('grandmaster', 'Grandmaster', 'Earned 5,000 game points.', 'Gem', 'legendary', 'Legends', 'points', 5000),
  ('road-warrior', 'Road Warrior', 'Logged 5,000 miles of chasing.', 'Mountain', 'legendary', 'Legends', 'miles', 5000),
  ('year-one', 'Year One', 'A StormSync member for a full year.', 'Hourglass', 'legendary', 'Legends', 'member_days', 365),
  ('founding', 'Founding Member', 'Joined StormSync Weather in 2026, its launch year.', 'Sparkles', 'legendary', 'Legends', 'founding', 1),
  ('ambassador', 'Ambassador', 'Brought 10 friends to StormSync.', 'Megaphone', 'legendary', 'Legends', 'referrals', 10),
  ('supporter', 'Supporter', 'Backs StormSync with a paid plan.', 'HandHeart', 'rare', 'Community', 'paid', 1),
  ('all-in', 'All In', 'Chose a yearly plan.', 'BadgeCheck', 'epic', 'Community', 'yearly', 1),
  ('centurion', 'Centurion', 'Checked the weather here on 100 different days.', 'Shield', 'epic', 'Regulars', 'days', 100)
on conflict (auto_key) do nothing;
