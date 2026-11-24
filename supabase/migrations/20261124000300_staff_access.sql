-- Staff roles are evaluated from protected database rows, never JWT user metadata.
alter table public.staff_roles drop constraint staff_roles_role_check;
alter table public.staff_roles add constraint staff_roles_role_check check (role in ('admin','editor','author'));
create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff_roles where user_id = (select auth.uid()) and role = 'admin');
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;
create function public.owns_draft(p_author_id uuid, p_status text) returns boolean language sql stable security definer set search_path = '' as $$
  select p_status = 'draft' and exists (
    select 1 from public.staff_roles r join public.authors a on a.profile_id = r.user_id
    where r.user_id = (select auth.uid()) and r.role = 'author' and a.id = p_author_id
  );
$$;
revoke all on function public.owns_draft(uuid, text) from public;
grant execute on function public.owns_draft(uuid, text) to authenticated;
-- The existing editor policies remain in force; these add author access only to own drafts.
create policy author_draft_read on public.articles for select to authenticated using (public.owns_draft(author_id, status));
create policy author_draft_insert on public.articles for insert to authenticated with check (public.owns_draft(author_id, status) and published_at is null);
create policy author_draft_update on public.articles for update to authenticated using (public.owns_draft(author_id, status)) with check (public.owns_draft(author_id, status) and published_at is null);
-- Editors/admins may assign roles and profiles; only admins get the grants and policies below.
grant insert, update, delete on public.profiles, public.staff_roles to authenticated;
create policy admin_profiles on public.profiles for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy admin_roles on public.staff_roles for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create table public.site_settings (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
revoke all on public.site_settings from anon, authenticated;
grant select, insert, update, delete on public.site_settings to authenticated;
create policy admin_settings on public.site_settings for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
