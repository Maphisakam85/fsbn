-- Author uploads are private and owned by the authenticated uploader.
alter table public.media_assets add column uploaded_by uuid references auth.users(id) on delete set null default auth.uid();
create policy author_media_read on public.media_assets for select to authenticated using (uploaded_by = (select auth.uid()) and exists (select 1 from public.staff_roles where user_id = (select auth.uid()) and role = 'author'));
create policy author_media_insert on public.media_assets for insert to authenticated with check (uploaded_by = (select auth.uid()) and exists (select 1 from public.staff_roles where user_id = (select auth.uid()) and role = 'author'));
create policy author_storage_read on storage.objects for select to authenticated using (bucket_id = 'editorial-media' and (storage.foldername(name))[1] = (select auth.uid())::text and exists (select 1 from public.staff_roles where user_id = (select auth.uid()) and role = 'author'));
create policy author_storage_insert on storage.objects for insert to authenticated with check (bucket_id = 'editorial-media' and (storage.foldername(name))[1] = (select auth.uid())::text and exists (select 1 from public.staff_roles where user_id = (select auth.uid()) and role = 'author'));
create policy author_topics_read on public.article_topics for select to authenticated using (exists (select 1 from public.articles a where a.id = article_id and public.owns_draft(a.author_id, a.status)));
create policy author_topics_insert on public.article_topics for insert to authenticated with check (exists (select 1 from public.articles a where a.id = article_id and public.owns_draft(a.author_id, a.status)));
create policy author_topics_delete on public.article_topics for delete to authenticated using (exists (select 1 from public.articles a where a.id = article_id and public.owns_draft(a.author_id, a.status)));

-- Invoker security means all article and relationship operations still obey RLS.
create function public.save_article(p_id uuid, p_article jsonb, p_topics uuid[]) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare v_id uuid; v_existing public.articles%rowtype;
begin
  if p_id is null then
    insert into public.articles (slug, headline, summary, body, author_id, category_id, cover_image_id, image_caption, image_credit, image_alt_text, status, published_at, seo_title, seo_description)
    values (p_article->>'slug', p_article->>'headline', p_article->>'summary', p_article->>'body', (p_article->>'author_id')::uuid, (p_article->>'category_id')::uuid, nullif(p_article->>'cover_image_id','')::uuid, p_article->>'image_caption', p_article->>'image_credit', p_article->>'image_alt_text', p_article->>'status', nullif(p_article->>'published_at','')::timestamptz, p_article->>'seo_title', p_article->>'seo_description') returning id into v_id;
  else
    select * into v_existing from public.articles where id = p_id for update;
    if not found then raise exception 'Article not found or access denied'; end if;
    -- Remove associations while a draft is still visible to its author.
    delete from public.article_topics where article_id = p_id;
    update public.articles set slug=p_article->>'slug', headline=p_article->>'headline', summary=p_article->>'summary', body=p_article->>'body', author_id=(p_article->>'author_id')::uuid, category_id=(p_article->>'category_id')::uuid, cover_image_id=nullif(p_article->>'cover_image_id','')::uuid, image_caption=p_article->>'image_caption', image_credit=p_article->>'image_credit', image_alt_text=p_article->>'image_alt_text', status=p_article->>'status', published_at=nullif(p_article->>'published_at','')::timestamptz, seo_title=p_article->>'seo_title', seo_description=p_article->>'seo_description' where id=p_id returning id into v_id;
    if v_id is null then raise exception 'Article update denied'; end if;
  end if;
  insert into public.article_topics (article_id, topic_id) select v_id, t from unnest(coalesce(p_topics, array[]::uuid[])) t;
  return v_id;
end;
$$;
revoke all on function public.save_article(uuid,jsonb,uuid[]) from public;
grant execute on function public.save_article(uuid,jsonb,uuid[]) to authenticated;
