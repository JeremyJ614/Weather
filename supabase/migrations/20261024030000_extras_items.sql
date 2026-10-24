-- Final List #8: the owner switches each Extras item (every Weather Engine and Random) on,
-- off or hidden from admin → Extras. One app_config row, read publicly like the kill switches.
insert into public.app_config (key, value)
values ('extras_items', '{}'::jsonb)
on conflict (key) do nothing;

create policy "extras switches are public" on public.app_config
  for select to anon, authenticated using (key = 'extras_items');
create policy "extras admins edit switches" on public.app_config
  for update to authenticated
  using (key = 'extras_items' and (select public.can_admin('extras')))
  with check (key = 'extras_items' and (select public.can_admin('extras')));
