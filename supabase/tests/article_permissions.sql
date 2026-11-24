-- Run only against a disposable Supabase database after all migrations, as postgres.
-- All fixtures and changes are rolled back. Raises on any permission failure.
begin;
insert into auth.users (id, email) values
 ('10000000-0000-0000-0000-000000000001','fsbn-author-test@example.invalid'),
 ('10000000-0000-0000-0000-000000000002','fsbn-editor-test@example.invalid'),
 ('10000000-0000-0000-0000-000000000003','fsbn-other-test@example.invalid');
insert into public.profiles (id,display_name) select id,email from auth.users where id in ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003');
insert into public.staff_roles values ('10000000-0000-0000-0000-000000000001','author'),('10000000-0000-0000-0000-000000000002','editor'),('10000000-0000-0000-0000-000000000003','author');
insert into public.authors (id,name,profile_id) values ('20000000-0000-0000-0000-000000000001','Test Author','10000000-0000-0000-0000-000000000001'),('20000000-0000-0000-0000-000000000002','Other Author','10000000-0000-0000-0000-000000000003');
insert into public.categories (id,slug,name) values ('30000000-0000-0000-0000-000000000001','fsbn-test-category','FSBN Test Category');
insert into public.topics (id,slug,name) values ('40000000-0000-0000-0000-000000000001','fsbn-test-topic','FSBN Test Topic');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
do $$
declare a uuid; payload jsonb := '{"slug":"fsbn-test-article","headline":"Test","summary":"Summary","body":"Body","author_id":"20000000-0000-0000-0000-000000000001","category_id":"30000000-0000-0000-0000-000000000001","status":"draft"}'::jsonb; denied boolean := false;
begin
  a := public.save_article(null,payload,array['40000000-0000-0000-0000-000000000001'::uuid]);
  if not exists(select 1 from public.article_topics where article_id=a) then raise exception 'author topic insert failed'; end if;
  perform public.save_article(a,jsonb_set(payload,'{headline}','"Edited"'),array[]::uuid[]);
  if (select headline from public.articles where id=a) <> 'Edited' then raise exception 'author update failed'; end if;
  begin perform public.save_article(a,payload || '{"status":"published","published_at":"2026-01-01T00:00:00Z"}'::jsonb,array[]::uuid[]); exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'author publishing was not denied'; end if;
  denied := false;
  begin perform public.save_article(null,payload || '{"slug":"fsbn-other-test","author_id":"20000000-0000-0000-0000-000000000002"}'::jsonb,array[]::uuid[]); exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'other author draft creation was not denied'; end if;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
do $$
declare a uuid; n int;
begin
 select id into a from public.articles where slug='fsbn-test-article';
 update public.articles set status='published',published_at=now() where id=a;
 if not found then raise exception 'editor publish failed'; end if;
 update public.articles set status='archived' where id=a;
 if not found then raise exception 'editor archive failed'; end if;
 delete from public.articles where id=a;
 get diagnostics n = row_count;
 if n <> 1 then raise exception 'editor delete failed'; end if;
end $$;
rollback;
