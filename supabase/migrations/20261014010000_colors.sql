-- Admin color editor (owner request 2026-10-13): map and data colors by hex code.
-- Overrides live in app_config "color_overrides" ({ key: "#rrggbb" }); defaults stay in code.
insert into public.app_config (key, value) values ('color_overrides', '{}'::jsonb) on conflict (key) do nothing;
create policy "color overrides are public" on public.app_config
  for select to anon, authenticated using (key = 'color_overrides');
create policy "color admins edit colors" on public.app_config
  for update to authenticated
  using (key = 'color_overrides' and (select public.can_admin('colors')))
  with check (key = 'color_overrides' and (select public.can_admin('colors')));
