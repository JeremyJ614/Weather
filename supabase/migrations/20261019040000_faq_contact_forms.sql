-- FAQ and Contact Us forms, both edited in the admin panel (Final Fix-It #11). Applied 2026-10-19.
-- An empty value means "the built-in defaults" until an admin saves (src/lib/help).
insert into public.app_config (key, value) values
  ('faq', '{}'::jsonb),
  ('contact_forms', '{}'::jsonb)
on conflict (key) do nothing;

create policy "faq is readable" on public.app_config
  for select to anon, authenticated using (key = 'faq');
create policy "faq admins edit faq" on public.app_config
  for update to authenticated
  using (key = 'faq' and (select public.can_admin('faq')))
  with check (key = 'faq' and (select public.can_admin('faq')));

create policy "contact forms are readable" on public.app_config
  for select to anon, authenticated using (key = 'contact_forms');
create policy "contact form admins edit forms" on public.app_config
  for update to authenticated
  using (key = 'contact_forms' and (select public.can_admin('contact-forms')))
  with check (key = 'contact_forms' and (select public.can_admin('contact-forms')));
