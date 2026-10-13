-- News & announcements: posts and the image bucket. Applied 2026-10-13.

-- Retention: owner-written posts, added by hand (a few a week); removing a post removes its images.
create table if not exists public.news_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 140),
  body text not null default '' check (char_length(body) <= 20000),
  cover_path text check (cover_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80}$'),
  status text not null default 'draft' check (status in ('draft', 'published')),
  publish_at timestamptz,
  author uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status = 'draft' or publish_at is not null)
);
alter table public.news_posts enable row level security;
create index if not exists news_posts_live on public.news_posts (publish_at desc) where status = 'published';

create policy "published news is public" on public.news_posts
  for select to anon, authenticated using (status = 'published' and publish_at <= now());
create policy "news admins read all" on public.news_posts
  for select to authenticated using ((select public.can_admin('news')));
create policy "news admins write" on public.news_posts
  for insert to authenticated with check ((select public.can_admin('news')));
create policy "news admins edit" on public.news_posts
  for update to authenticated using ((select public.can_admin('news'))) with check ((select public.can_admin('news')));
create policy "news admins remove" on public.news_posts
  for delete to authenticated using ((select public.can_admin('news')));

-- Images: public bucket, 2 MB per file, images only (the editor shrinks them to WebP first).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('news', 'news', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = true, file_size_limit = 2097152,
  allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png'];

create policy "news admins upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'news' and (select public.can_admin('news')));
create policy "news admins replace" on storage.objects
  for update to authenticated using (bucket_id = 'news' and (select public.can_admin('news')));
create policy "news admins remove images" on storage.objects
  for delete to authenticated using (bucket_id = 'news' and (select public.can_admin('news')));
create policy "news admins list images" on storage.objects
  for select to authenticated using (bucket_id = 'news' and (select public.can_admin('news')));
