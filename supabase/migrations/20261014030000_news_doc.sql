-- Fix-It #4: SSWX News posts are written in a rich editor. The formatted post is stored as a
-- structured document (validated on the server, rendered as React, never as HTML); `body`
-- keeps the plain text for excerpts and older Markdown posts.
alter table public.news_posts add column if not exists doc jsonb check (doc is null or octet_length(doc::text) <= 300000);
