-- Database tune-up, part 1 (review round, speed pick "db-tune"; applied 2026-10-27): an index
-- under every foreign key that had none, per Supabase's performance advisor (member lookups and
-- cascades). The five "unused" indexes stay: each backs a real query that is rare only while
-- traffic is low (Stripe webhook, trivia de-duplication, usage, volunteer queue, member reports).

create index if not exists audit_log_actor on public.audit_log (actor);
create index if not exists contact_messages_user on public.contact_messages (user_id);
create index if not exists disaster_orgs_message on public.disaster_orgs (message_id);
-- Only where the volunteers table still stands (20261020060000 drops it; a fresh replay of the
-- migrations, as in the 2026-11-26 project move, reaches here without it).
do $$ begin
  if to_regclass('public.disaster_volunteers') is not null then
    create index if not exists disaster_volunteers_message on public.disaster_volunteers (message_id);
    create index if not exists disaster_volunteers_org on public.disaster_volunteers (org_id);
    create index if not exists disaster_volunteers_user on public.disaster_volunteers (user_id);
  end if;
end $$;
create index if not exists donations_user on public.donations (user_id);
create index if not exists game_points_user on public.game_points (user_id);
create index if not exists game_titles_entered_by on public.game_titles (entered_by);
create index if not exists game_titles_user on public.game_titles (user_id);
create index if not exists game_winners_user on public.game_winners (user_id);
create index if not exists member_badges_badge on public.member_badges (badge_id);
create index if not exists news_posts_author on public.news_posts (author);
create index if not exists notification_reads_notification on public.notification_reads (notification_id);
create index if not exists notifications_sent_by on public.notifications (sent_by);
create index if not exists notifications_user on public.notifications (user_id);
create index if not exists poll_votes_user on public.poll_votes (user_id);
create index if not exists polls_created_by on public.polls (created_by);
create index if not exists profiles_referred_by on public.profiles (referred_by);
create index if not exists push_subscriptions_user on public.push_subscriptions (user_id);
create index if not exists trivia_answers_user on public.trivia_answers (user_id);
create index if not exists user_roles_granted_by on public.user_roles (granted_by);
create index if not exists weatherdle_plays_user on public.weatherdle_plays (user_id);
