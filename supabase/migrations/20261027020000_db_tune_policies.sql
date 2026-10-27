-- Database tune-up, part 2 (review round, speed pick "db-tune"): overlapping permissive policies
-- merged into one per role and action, with the same meaning (each one was evaluated on every
-- read before). Public rows that anon and authenticated both read get an anon-only policy plus
-- one merged policy for signed-in readers. NOT YET APPLIED: it drops policies, so the Supabase
-- connector asks the owner to confirm; apply it from the SQL editor or approve it in chat.

-- app_config: the public settings rows, and admins' edits, each as one policy.
drop policy if exists "billing admins read invoice template" on public.app_config;
drop policy if exists "billing is public" on public.app_config;
drop policy if exists "color overrides are public" on public.app_config;
drop policy if exists "contact forms are readable" on public.app_config;
drop policy if exists "deer seasons are public" on public.app_config;
drop policy if exists "extras switches are public" on public.app_config;
drop policy if exists "faq is readable" on public.app_config;
drop policy if exists "menu layout is public" on public.app_config;
drop policy if exists "plan locks are public" on public.app_config;
drop policy if exists "public ops settings" on public.app_config;
drop policy if exists "signup form is readable" on public.app_config;
drop policy if exists "site defaults are public" on public.app_config;
drop policy if exists "weatherdle settings are public" on public.app_config;
create policy "public settings are readable" on public.app_config for select to anon
  using (key = any (array['billing','color_overrides','contact_forms','deer_seasons','extras_items','faq','menu_layout','plan_locks','disabled_modules','banner','signup_form','menu_defaults','theme_default','weatherdle_settings']));
create policy "members read public settings, billing admins the invoice" on public.app_config for select to authenticated
  using (
    key = any (array['billing','color_overrides','contact_forms','deer_seasons','extras_items','faq','menu_layout','plan_locks','disabled_modules','banner','signup_form','menu_defaults','theme_default','weatherdle_settings'])
    or (key = 'invoice_template' and (select can_admin('billing')))
  );

drop policy if exists "billing admins edit invoice template" on public.app_config;
drop policy if exists "billing admins edit plan locks" on public.app_config;
drop policy if exists "billing admins edit pricing" on public.app_config;
drop policy if exists "color admins edit colors" on public.app_config;
drop policy if exists "contact form admins edit forms" on public.app_config;
drop policy if exists "extras admins edit deer seasons" on public.app_config;
drop policy if exists "extras admins edit switches" on public.app_config;
drop policy if exists "faq admins edit faq" on public.app_config;
drop policy if exists "menu admins edit layout" on public.app_config;
drop policy if exists "menu admins edit site defaults" on public.app_config;
drop policy if exists "ops admins edit settings" on public.app_config;
drop policy if exists "signup admins edit form" on public.app_config;
drop policy if exists "weatherdle admins edit settings" on public.app_config;
create policy "admins edit the settings they manage" on public.app_config for update to authenticated
  using (
       (key = any (array['billing','plan_locks','invoice_template']) and (select can_admin('billing')))
    or (key = 'color_overrides' and (select can_admin('colors')))
    or (key = 'contact_forms' and (select can_admin('contact-forms')))
    or (key = any (array['deer_seasons','extras_items']) and (select can_admin('extras')))
    or (key = 'faq' and (select can_admin('faq')))
    or (key = any (array['menu_layout','menu_defaults','theme_default']) and (select can_admin('menus')))
    or (key = any (array['disabled_modules','banner']) and (select can_admin('ops')))
    or (key = 'signup_form' and (select can_admin('signup-form')))
    or (key = 'weatherdle_settings' and (select can_admin('weatherdle')))
  )
  with check (
       (key = any (array['billing','plan_locks','invoice_template']) and (select can_admin('billing')))
    or (key = 'color_overrides' and (select can_admin('colors')))
    or (key = 'contact_forms' and (select can_admin('contact-forms')))
    or (key = any (array['deer_seasons','extras_items']) and (select can_admin('extras')))
    or (key = 'faq' and (select can_admin('faq')))
    or (key = any (array['menu_layout','menu_defaults','theme_default']) and (select can_admin('menus')))
    or (key = any (array['disabled_modules','banner']) and (select can_admin('ops')))
    or (key = 'signup_form' and (select can_admin('signup-form')))
    or (key = 'weatherdle_settings' and (select can_admin('weatherdle')))
  );

-- Public rows: anon keeps its rule; signed-in readers get one merged rule.
drop policy if exists "releases are public" on public.app_releases;
drop policy if exists "news admins read releases" on public.app_releases;
create policy "releases are public" on public.app_releases for select to anon using (published_at <= now());
create policy "members read releases, news admins all" on public.app_releases for select to authenticated
  using (published_at <= now() or (select can_admin('news')));

drop policy if exists "anyone reads approved organizations" on public.disaster_orgs;
drop policy if exists "disaster admins read organizations" on public.disaster_orgs;
create policy "anyone reads approved organizations" on public.disaster_orgs for select to anon using (status = 'approved');
create policy "members read approved organizations, admins all" on public.disaster_orgs for select to authenticated
  using (status = 'approved' or (select can_admin('disaster')) or (select can_admin('inbox')));

drop policy if exists "published news is public" on public.news_posts;
drop policy if exists "news admins read all" on public.news_posts;
create policy "published news is public" on public.news_posts for select to anon using (status = 'published' and publish_at <= now());
create policy "members read published news, news admins all" on public.news_posts for select to authenticated
  using ((status = 'published' and publish_at <= now()) or (select can_admin('news')));

-- Own rows or an admin: one rule each.
drop policy if exists "own brief" on public.brief_subscriptions;
drop policy if exists "sms admins read briefs" on public.brief_subscriptions;
create policy "own brief, or sms admins" on public.brief_subscriptions for select to authenticated
  using (user_id = (select auth.uid()) or (select can_admin('sms')));

drop policy if exists "leaderboard admins read points" on public.game_points;
drop policy if exists "members read own points" on public.game_points;
create policy "own points, or leaderboard admins" on public.game_points for select to authenticated
  using (user_id = (select auth.uid()) or (select can_admin('leaderboard')));

drop policy if exists "badge admins read awards" on public.member_badges;
drop policy if exists "members read own badges" on public.member_badges;
create policy "own badges, or badge admins" on public.member_badges for select to authenticated
  using (user_id = (select auth.uid()) or (select can_admin('badges')) or (select can_admin('members')));

drop policy if exists "members admins read pages" on public.member_pages;
drop policy if exists "members read own pages" on public.member_pages;
create policy "own pages, or members admins" on public.member_pages for select to authenticated
  using (user_id = (select auth.uid()) or (select can_admin('members')));

drop policy if exists "members read own reads" on public.notification_reads;
drop policy if exists "notify admins read reads" on public.notification_reads;
create policy "own reads, or notify admins" on public.notification_reads for select to authenticated
  using (user_id = (select auth.uid()) or (select can_admin('notify')));

drop policy if exists "members read their notifications" on public.notifications;
drop policy if exists "notify admins read notifications" on public.notifications;
create policy "own and broadcast notifications, or notify admins" on public.notifications for select to authenticated
  using (user_id is null or user_id = (select auth.uid()) or (select can_admin('notify')));

drop policy if exists "notify admins read alerts" on public.notify_prefs;
drop policy if exists "own alerts" on public.notify_prefs;
create policy "own alerts, or notify admins" on public.notify_prefs for select to authenticated
  using (user_id = (select auth.uid()) or (select can_admin('notify')));

drop policy if exists "notify admins read sent" on public.notify_sent;
drop policy if exists "own sent alerts" on public.notify_sent;
create policy "own sent alerts, or notify admins" on public.notify_sent for select to authenticated
  using (user_id = (select auth.uid()) or (select can_admin('notify')));

drop policy if exists "extras admins read outdoor reports" on public.outdoor_reports;
drop policy if exists "own outdoor reports" on public.outdoor_reports;
create policy "own outdoor reports, or extras admins" on public.outdoor_reports for select to authenticated
  using (user_id = (select auth.uid()) or (select can_admin('extras')));

drop policy if exists "members read own votes" on public.poll_votes;
drop policy if exists "poll admins read votes" on public.poll_votes;
create policy "own votes, or poll admins" on public.poll_votes for select to authenticated
  using (user_id = (select auth.uid()) or (select can_admin('polls')));

drop policy if exists "admins read profiles" on public.profiles;
drop policy if exists "read own profile" on public.profiles;
create policy "own profile, or admins" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select is_admin()));

drop policy if exists "members admins read referral adjust" on public.referral_adjust;
drop policy if exists "members read own referral adjust" on public.referral_adjust;
create policy "own referral adjust, or members admins" on public.referral_adjust for select to authenticated
  using (user_id = (select auth.uid()) or (select can_admin('members')));

drop policy if exists "billing admins read plans" on public.subscriptions;
drop policy if exists "members read own plan" on public.subscriptions;
create policy "own plan, or billing admins" on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid()) or (select can_admin('billing')));

drop policy if exists "members read own weatherdle" on public.weatherdle_plays;
drop policy if exists "weatherdle admins read plays" on public.weatherdle_plays;
create policy "own weatherdle, or weatherdle admins" on public.weatherdle_plays for select to authenticated
  using (user_id = (select auth.uid()) or (select can_admin('weatherdle')));

drop policy if exists "founder grants roles" on public.user_roles;
drop policy if exists "members admins grant member" on public.user_roles;
create policy "founder grants roles, members admins grant member" on public.user_roles for insert to authenticated
  with check (
    ((select has_role('founder')) and role <> 'founder')
    or (role = 'member' and (select can_admin('members')))
  );
