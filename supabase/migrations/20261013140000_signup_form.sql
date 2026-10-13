-- Admin-editable signup form. Applied 2026-10-13.
insert into public.app_config (key, value) values
  ('signup_form', '{"show":{"nickname":true,"phone":true,"foundUs":true,"referral":true},"foundUsOptions":[],"intro":""}'::jsonb)
on conflict (key) do nothing;
create policy "signup form is readable" on public.app_config
  for select to anon, authenticated using (key = 'signup_form');
create policy "signup admins edit form" on public.app_config
  for update to authenticated
  using (key = 'signup_form' and (select public.can_admin('signup-form')))
  with check (key = 'signup_form' and (select public.can_admin('signup-form')));
