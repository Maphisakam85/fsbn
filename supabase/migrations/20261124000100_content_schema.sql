-- FSBN content schema. Staff roles are assigned only by a trusted database administrator.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) > 0),
  created_at timestamptz not null default now()
);
create table public.staff_roles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role text not null check (role in ('admin', 'editor'))
);
-- Definer reads the protected role table without granting clients role-management rights.
create function public.is_editor() returns boolean language sql stable security definer
set search_path = '' as $$
  select exists (select 1 from public.staff_roles where user_id = (select auth.uid()) and role in ('admin', 'editor'));
$$;
revoke all on function public.is_editor() from public;
grant execute on function public.is_editor() to anon, authenticated;

create table public.authors (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  profile_id uuid references public.profiles(id) on delete set null,
  bio text
);
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null unique check (length(trim(name)) > 0),
  description text
);
create table public.topics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null unique check (length(trim(name)) > 0)
);
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null unique check (length(trim(name)) > 0)
);
-- external_url supports existing demo imagery; storage_path is for future managed uploads.
create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  storage_path text unique,
  external_url text,
  alt_text text not null default '',
  caption text,
  credit text,
  created_at timestamptz not null default now(),
  check (num_nonnulls(storage_path, external_url) = 1),
  check (external_url is null or external_url ~ '^https://')
);
create table public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  headline text not null check (length(trim(headline)) > 0),
  summary text not null default '',
  body text not null default '',
  author_id uuid not null references public.authors(id) on delete restrict,
  category_id uuid not null references public.categories(id) on delete restrict,
  cover_image_id uuid references public.media_assets(id) on delete set null,
  image_caption text,
  image_credit text,
  image_alt_text text,
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'archived')),
  is_demo boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  seo_title text,
  seo_description text,
  read_time_minutes integer check (read_time_minutes > 0),
  check (status <> 'published' or (published_at is not null and not is_demo)),
  check (status <> 'published' or length(trim(body)) > 0)
);
create table public.article_topics (
  article_id uuid not null references public.articles(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  primary key (article_id, topic_id)
);
create table public.article_tags (
  article_id uuid not null references public.articles(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (article_id, tag_id)
);
create index articles_publication_idx on public.articles (published_at desc) where status = 'published';
create index articles_category_publication_idx on public.articles (category_id, published_at desc) where status = 'published';
create index articles_author_idx on public.articles (author_id);
create index articles_cover_image_idx on public.articles (cover_image_id);
create index article_topics_topic_idx on public.article_topics (topic_id);
create index article_tags_tag_idx on public.article_tags (tag_id);
create function public.set_article_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger articles_updated_at before update on public.articles for each row execute function public.set_article_updated_at();

alter table public.profiles enable row level security;
alter table public.staff_roles enable row level security;
alter table public.authors enable row level security;
alter table public.categories enable row level security;
alter table public.topics enable row level security;
alter table public.tags enable row level security;
alter table public.media_assets enable row level security;
alter table public.articles enable row level security;
alter table public.article_topics enable row level security;
alter table public.article_tags enable row level security;
revoke all on public.profiles, public.staff_roles, public.authors, public.categories, public.topics, public.tags, public.media_assets, public.articles, public.article_topics, public.article_tags from anon, authenticated;
grant select on public.authors, public.categories, public.topics, public.tags, public.media_assets, public.articles, public.article_topics, public.article_tags to anon, authenticated;
grant select on public.profiles, public.staff_roles to authenticated;
grant insert, update, delete on public.authors, public.categories, public.topics, public.tags, public.media_assets, public.articles, public.article_topics, public.article_tags to authenticated;
create policy profile_self_read on public.profiles for select to authenticated using (id = (select auth.uid()) or (select public.is_editor()));
create policy role_self_read on public.staff_roles for select to authenticated using (user_id = (select auth.uid()));
create policy authors_read on public.authors for select to anon, authenticated using (true);
create policy categories_read on public.categories for select to anon, authenticated using (true);
create policy topics_read on public.topics for select to anon, authenticated using (true);
create policy tags_read on public.tags for select to anon, authenticated using (true);
create policy articles_read on public.articles for select to anon, authenticated using (status = 'published' or (select public.is_editor()));
create policy media_read on public.media_assets for select to anon, authenticated using ((select public.is_editor()) or exists (select 1 from public.articles a where a.cover_image_id = media_assets.id and a.status = 'published'));
create policy article_topics_read on public.article_topics for select to anon, authenticated using ((select public.is_editor()) or exists (select 1 from public.articles a where a.id = article_topics.article_id and a.status = 'published'));
create policy article_tags_read on public.article_tags for select to anon, authenticated using ((select public.is_editor()) or exists (select 1 from public.articles a where a.id = article_tags.article_id and a.status = 'published'));
-- Role checks apply to both existing and new rows for updates.
create policy authors_write on public.authors for all to authenticated using ((select public.is_editor())) with check ((select public.is_editor()));
create policy categories_write on public.categories for all to authenticated using ((select public.is_editor())) with check ((select public.is_editor()));
create policy topics_write on public.topics for all to authenticated using ((select public.is_editor())) with check ((select public.is_editor()));
create policy tags_write on public.tags for all to authenticated using ((select public.is_editor())) with check ((select public.is_editor()));
create policy media_write on public.media_assets for all to authenticated using ((select public.is_editor())) with check ((select public.is_editor()));
create policy articles_write on public.articles for all to authenticated using ((select public.is_editor())) with check ((select public.is_editor()));
create policy article_topics_write on public.article_topics for all to authenticated using ((select public.is_editor())) with check ((select public.is_editor()));
create policy article_tags_write on public.article_tags for all to authenticated using ((select public.is_editor())) with check ((select public.is_editor()));
-- Draft media stays private. Published media delivery will need an explicit public
-- bucket or a controlled delivery mechanism in the publishing section.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('editorial-media', 'editorial-media', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;
create policy editorial_media_read on storage.objects for select to authenticated
  using (bucket_id = 'editorial-media' and (select public.is_editor()));
create policy editorial_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'editorial-media' and (select public.is_editor()));
create policy editorial_media_update on storage.objects for update to authenticated
  using (bucket_id = 'editorial-media' and (select public.is_editor()))
  with check (bucket_id = 'editorial-media' and (select public.is_editor()));
create policy editorial_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'editorial-media' and (select public.is_editor()));
