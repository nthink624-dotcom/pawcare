-- Disposable local database only. This transaction rolls back every fixture, including 100,000 retired codes.
begin;
insert into public.shops(id) values('scope-a'),('scope-b');
insert into public.shop_alimtalk_template_requests(shop_id,notification_type,template_alias,template_code,template_name,template_content,category_code,inspection_status,service_status,created_at)
values
 ('scope-a','grooming_started','grooming_started','OLD_A','old','old body','001','approved','a',now()-interval '2 days'),
 ('scope-a','grooming_started','grooming_started','OWNER_A','owner','owner body','001','approved','a',now()-interval '1 day'),
 ('scope-a','grooming_started','grooming_started','PENDING_A','pending','pending body','001','requested','r',now()),
 ('scope-a','grooming_started','grooming_started','DRAFT_A','draft','draft body','001','draft','unknown',now());

do $$ begin
  begin
    perform public.replace_platform_alimtalk_template('grooming_started','grooming_started','templateGroomingStarted',
      '{"templateCode":"OWNER_A","templateContent":"owner body","inspectionStatus":"APR","serviceStatus":"A","buttons":[]}', '{}',null,null);
    raise exception 'private code was published globally';
  exception when raise_exception then if sqlerrm not like 'PM_TEMPLATE_PRIVATE%' then raise; end if; end;
  begin
    perform public.set_shop_alimtalk_template_selection('scope-b','grooming_started',
      '{"templateCode":"OWNER_A","templateContent":"owner body","inspectionStatus":"APR","serviceStatus":"A","buttons":[]}', '{}',0,'00000000-0000-4000-8000-000000000001');
    raise exception 'foreign selection succeeded';
  exception when raise_exception then if sqlerrm not like 'PM_TEMPLATE_PRIVATE%' then raise; end if; end;
  begin
    update public.alimtalk_template_registry set scope='platform',owner_shop_id=null where template_code='OWNER_A';
    raise exception 'private registry changed to public';
  exception when raise_exception then if sqlerrm<>'PM_TEMPLATE_OWNERSHIP_IMMUTABLE' then raise; end if; end;
end $$;
select public.set_shop_alimtalk_template_selection('scope-a','grooming_started',
  '{"templateCode":"OWNER_A","templateContent":"owner body","inspectionStatus":"APR","serviceStatus":"A","buttons":[]}', '{}',0,'00000000-0000-4000-8000-000000000001');

insert into public.alimtalk_template_registry(template_code,scope,retired_at)
  select 'RETIRED_'||g,'shop',now() from generate_series(1,100000) g;
do $$ begin
  assert (select count(*)=100000 from public.alimtalk_template_registry where template_code like 'RETIRED_%');
  assert (select count(*)=2 from public.shop_alimtalk_active_codes where shop_id='scope-a'), 'only selected and pending latest codes may sync';
  assert not exists(select 1 from public.shop_alimtalk_active_codes where template_code in ('OLD_A','DRAFT_A'));
  assert not has_table_privilege('anon','public.alimtalk_template_registry','select');
  assert not has_table_privilege('authenticated','public.alimtalk_template_provider_cache','select');
  assert not has_table_privilege('authenticated','public.shop_alimtalk_active_codes','select');
  assert not has_function_privilege('authenticated','public.claim_alimtalk_template_cleanup(uuid,integer)','execute');
  assert (select relrowsecurity from pg_class where oid='public.alimtalk_template_cleanup'::regclass);
end $$;

insert into public.alimtalk_template_provider_cache(template_code,detail,checked_at,valid_until)
 values('OWNER_A','{"templateCode":"OWNER_A","templateContent":"new"}',now(),now()+interval '5 minutes');
insert into public.alimtalk_template_provider_cache(template_code,detail,checked_at,valid_until)
 values('OWNER_A','{"templateCode":"OWNER_A","templateContent":"old"}',now()-interval '1 minute',now()+interval '1 minute')
 on conflict(template_code) do update set detail=excluded.detail,checked_at=excluded.checked_at,valid_until=excluded.valid_until;
do $$ begin
  assert (select detail->>'templateContent'='new' from public.alimtalk_template_provider_cache where template_code='OWNER_A'), 'late stale response must not overwrite a newer cache';
end $$;

delete from public.shops where id='scope-a';
do $$ begin
  assert not exists(select 1 from public.shop_alimtalk_template_requests where shop_id='scope-a');
  assert not exists(select 1 from public.shop_alimtalk_template_selections where shop_id='scope-a');
  assert not exists(select 1 from public.alimtalk_template_provider_cache where template_code='OWNER_A');
  assert (select scope='shop' and owner_shop_id is null and retired_at is not null from public.alimtalk_template_registry where template_code='OWNER_A');
  assert (select count(*)=3 from public.alimtalk_template_cleanup), 'only submitted codes are queued, never unsent drafts';
  begin
    perform public.replace_platform_alimtalk_template('grooming_started','grooming_started','templateGroomingStarted',
      '{"templateCode":"OWNER_A","templateContent":"owner body","inspectionStatus":"APR","serviceStatus":"A","buttons":[]}', '{}',null,null);
    raise exception 'retired code became public after FK deletion';
  exception when raise_exception then if sqlerrm not like 'PM_TEMPLATE_PRIVATE%' then raise; end if; end;
  begin
    insert into public.alimtalk_template_provider_cache values('OWNER_A','{"templateCode":"OWNER_A"}',now(),now()+interval '1 hour');
    raise exception 'retired message was cached after deletion';
  exception when raise_exception then if sqlerrm not like 'PM_TEMPLATE_PRIVATE%' then raise; end if; end;
end $$;

set local role service_role;
do $$ declare run uuid:=gen_random_uuid(); other uuid:=gen_random_uuid(); n integer; begin
  select count(*) into n from public.claim_alimtalk_template_cleanup(run,20);
  assert n=3;
  select count(*) into n from public.claim_alimtalk_template_cleanup(other,20);
  assert n=0, 'claimed cleanup cannot overlap';
  assert not public.finish_alimtalk_template_cleanup(other,'OWNER_A','stopped');
  assert public.finish_alimtalk_template_cleanup(run,'OWNER_A','stopped');
end $$;
reset role;
update public.alimtalk_template_cleanup set attempts=6,state='processing',lease_until=now()-interval '1 second' where template_code='PENDING_A';
select count(*) from public.claim_alimtalk_template_cleanup(gen_random_uuid(),20);
do $$ begin
  assert (select state='manual_review' from public.alimtalk_template_cleanup where template_code='PENDING_A'), 'exhausted/uncertain attempts must be visible for review';
end $$;
rollback;
