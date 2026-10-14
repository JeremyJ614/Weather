-- Fix-It #5: the owner's own signup questions. Answers are saved with the profile.
alter table public.profiles add column if not exists custom_answers jsonb not null default '{}'::jsonb check (octet_length(custom_answers::text) <= 20000);
