begin;

-- A code's classification survives account deletion. No message body, person or former shop ID is retained after retirement.
create table public.alimtalk_template_registry (
  template_code text primary key,
  scope text not null check (scope in ('platform','shop')),
  owner_shop_id text references public.shops(id) on delete set null,
  retired_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  check ((scope='platform' and owner_shop_id is null) or (scope='shop' and (owner_shop_id is not null or retired_at is not null)))
);
create index alimtalk_template_registry_owner_idx on public.alimtalk_template_registry(owner_shop_id) where retired_at is null;
alter table public.alimtalk_template_registry enable row level security;
revoke all on public.alimtalk_template_registry from public,anon,authenticated;
grant select,insert,update on public.alimtalk_template_registry to service_role;

insert into public.alimtalk_template_registry(template_code,scope,owner_shop_id)
  select template_code,'shop',shop_id from public.shop_alimtalk_template_requests;
insert into public.alimtalk_template_registry(template_code,scope)
  select provider_template_code,'platform' from public.platform_alimtalk_templates where provider='ssodaa'
    and nullif(btrim(provider_template_code),'') is not null
  on conflict do nothing;
-- Quarantine any historic private/public conflict without changing the approved message or selecting a replacement.
update public.platform_alimtalk_templates m set service_status='inactive'
  where provider='ssodaa' and exists(select 1 from public.alimtalk_template_registry r where r.template_code=m.provider_template_code and r.scope='shop');

create function public.guard_alimtalk_registry_identity() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  if new.template_code is distinct from old.template_code or new.scope is distinct from old.scope
    or (new.owner_shop_id is distinct from old.owner_shop_id and not (new.owner_shop_id is null and new.retired_at is not null))
    or (old.retired_at is not null and new.retired_at is distinct from old.retired_at) then
    raise exception 'PM_TEMPLATE_OWNERSHIP_IMMUTABLE';
  end if;
  return new;
end $$;
create trigger guard_alimtalk_registry_identity before update on public.alimtalk_template_registry
  for each row execute function public.guard_alimtalk_registry_identity();

create function public.guard_shop_alimtalk_code() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare r public.alimtalk_template_registry%rowtype;
begin
  if tg_op='UPDATE' and (new.template_code is distinct from old.template_code or new.shop_id is distinct from old.shop_id or new.template_alias is distinct from old.template_alias) then
    raise exception 'PM_TEMPLATE_OWNERSHIP_IMMUTABLE';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('alimtalk-code:'||new.template_code,0));
  insert into public.alimtalk_template_registry(template_code,scope,owner_shop_id) values(new.template_code,'shop',new.shop_id) on conflict do nothing;
  select * into r from public.alimtalk_template_registry where template_code=new.template_code for update;
  if r.scope<>'shop' or r.owner_shop_id is distinct from new.shop_id or r.retired_at is not null then
    raise exception 'PM_TEMPLATE_PRIVATE_OR_RETIRED';
  end if;
  return new;
end $$;
create trigger guard_shop_alimtalk_code before insert or update on public.shop_alimtalk_template_requests
  for each row execute function public.guard_shop_alimtalk_code();

create function public.guard_platform_alimtalk_code() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare r public.alimtalk_template_registry%rowtype;
begin
  if new.provider<>'ssodaa' then return new; end if;
  if nullif(btrim(new.provider_template_code),'') is null then
    if new.service_status='active' then raise exception 'PM_TEMPLATE_INVALID_CODE'; end if;
    return new;
  end if;
  -- Allow deactivation of quarantined historic rows, never their activation.
  if tg_op='UPDATE' and new.provider_template_code=old.provider_template_code and new.service_status='inactive' then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('alimtalk-code:'||new.provider_template_code,0));
  select * into r from public.alimtalk_template_registry where template_code=new.provider_template_code for update;
  if r.template_code is null then
    if new.provider_template_code ~ '^PM[0-9A-F]{26}$' then raise exception 'PM_TEMPLATE_UNKNOWN_PRIVATE_CODE'; end if;
    insert into public.alimtalk_template_registry(template_code,scope) values(new.provider_template_code,'platform') returning * into r;
  end if;
  if r.scope<>'platform' or r.retired_at is not null then raise exception 'PM_TEMPLATE_PRIVATE_OR_RETIRED'; end if;
  return new;
end $$;
create trigger guard_platform_alimtalk_code before insert or update on public.platform_alimtalk_templates
  for each row execute function public.guard_platform_alimtalk_code();

create function public.guard_alimtalk_selection_scope() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare r public.alimtalk_template_registry%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('alimtalk-code:'||new.template_code,0));
  select * into r from public.alimtalk_template_registry where template_code=new.template_code for share;
  if r.template_code is null or r.retired_at is not null then raise exception 'PM_TEMPLATE_PRIVATE_OR_RETIRED'; end if;
  if r.scope='shop' then
    if r.owner_shop_id is distinct from new.shop_id or not exists(select 1 from public.shop_alimtalk_template_requests q where q.shop_id=new.shop_id and q.template_alias=new.template_alias and q.template_code=new.template_code) then
      raise exception 'PM_TEMPLATE_PRIVATE_TO_ANOTHER_SHOP';
    end if;
  elsif not exists(select 1 from public.platform_alimtalk_templates m where m.provider='ssodaa' and m.provider_template_code=new.template_code and m.template_alias=new.template_alias and m.service_status='active') then
    raise exception 'PM_TEMPLATE_NOT_PUBLIC_FOR_ALIAS';
  end if;
  return new;
end $$;
create trigger guard_alimtalk_selection_scope before insert or update on public.shop_alimtalk_template_selections
  for each row execute function public.guard_alimtalk_selection_scope();

create table public.alimtalk_template_cleanup (
  template_code text primary key references public.alimtalk_template_registry(template_code),
  state text not null default 'pending' check(state in ('pending','processing','stopped','review_cancelled','manual_review','unknown')),
  attempts integer not null default 0,
  lease_owner uuid,
  lease_until timestamptz,
  next_attempt_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
alter table public.alimtalk_template_cleanup enable row level security;
revoke all on public.alimtalk_template_cleanup from public,anon,authenticated;
grant select,insert,update on public.alimtalk_template_cleanup to service_role;
create index alimtalk_template_cleanup_due_idx on public.alimtalk_template_cleanup(next_attempt_at) where state in ('pending','unknown','processing');

create table public.alimtalk_template_provider_cache (
  template_code text primary key references public.alimtalk_template_registry(template_code),
  detail jsonb not null check(jsonb_typeof(detail)='object' and coalesce(detail->>'templateCode','')=template_code),
  checked_at timestamptz not null,
  valid_until timestamptz not null
);
alter table public.alimtalk_template_provider_cache enable row level security;
revoke all on public.alimtalk_template_provider_cache from public,anon,authenticated;
grant select,insert,update,delete on public.alimtalk_template_provider_cache to service_role;
create function public.guard_alimtalk_provider_cache() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare r public.alimtalk_template_registry%rowtype;
begin
  select * into r from public.alimtalk_template_registry where template_code=new.template_code for share;
  if r.template_code is null or r.retired_at is not null then raise exception 'PM_TEMPLATE_PRIVATE_OR_RETIRED'; end if;
  if tg_op='UPDATE' and old.checked_at>new.checked_at then return null; end if;
  return new;
end $$;
create trigger guard_alimtalk_provider_cache before insert or update on public.alimtalk_template_provider_cache
  for each row execute function public.guard_alimtalk_provider_cache();

create function public.retire_shop_alimtalk_codes() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  -- The same deletion transaction both denies future access and creates recoverable provider work.
  insert into public.alimtalk_template_cleanup(template_code)
    select r.template_code from public.alimtalk_template_registry r
    where r.owner_shop_id=old.id and r.scope='shop' and exists(
      select 1 from public.shop_alimtalk_template_requests q where q.template_code=r.template_code and q.inspection_status<>'draft'
    ) on conflict do nothing;
  with retired as (
    update public.alimtalk_template_registry set retired_at=coalesce(retired_at,clock_timestamp()),owner_shop_id=null
      where owner_shop_id=old.id and scope='shop' returning template_code
  ) delete from public.alimtalk_template_provider_cache c using retired r where c.template_code=r.template_code;
  return old;
end $$;
create trigger retire_shop_alimtalk_codes before delete on public.shops for each row execute function public.retire_shop_alimtalk_codes();

-- Includes pending work, legacy/current selection, and the latest approved submission awaiting owner choice.
create view public.shop_alimtalk_active_codes with (security_invoker=true) as
with latest as (
  select distinct on(shop_id,template_alias) shop_id,template_alias,template_code,inspection_status
  from public.shop_alimtalk_template_requests where inspection_status<>'draft'
  order by shop_id,template_alias,created_at desc,id desc
), candidates as (
  select shop_id,template_alias,template_code from public.shop_alimtalk_template_requests
    where is_current or inspection_status in ('submitting','requested','reviewing','unknown')
  union select shop_id,template_alias,template_code from latest where inspection_status='approved'
  union select shop_id,template_alias,template_code from public.shop_alimtalk_template_selections
)
select c.shop_id,c.template_alias,c.template_code from candidates c join public.alimtalk_template_registry r using(template_code)
where r.retired_at is null and (r.scope='platform' or r.owner_shop_id=c.shop_id);
revoke all on public.shop_alimtalk_active_codes from public,anon,authenticated;
grant select on public.shop_alimtalk_active_codes to service_role;

create function public.claim_alimtalk_template_cleanup(p_run uuid,p_limit integer default 20)
returns setof public.alimtalk_template_cleanup language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  if p_run is null then raise exception 'PM_INVALID_JOB'; end if;
  update public.alimtalk_template_cleanup set state='manual_review',lease_owner=null,lease_until=null
    where attempts>=6 and state in ('pending','unknown','processing') and (lease_until is null or lease_until<clock_timestamp());
  return query with due as (
    select q.template_code from public.alimtalk_template_cleanup q
    join public.alimtalk_template_registry r using(template_code)
    where r.scope='shop' and r.retired_at is not null and q.state in ('pending','unknown','processing')
      and q.next_attempt_at<=clock_timestamp() and (q.lease_until is null or q.lease_until<clock_timestamp())
      and q.attempts<6
    order by q.next_attempt_at,q.template_code for update of q skip locked limit least(greatest(p_limit,1),20)
  ) update public.alimtalk_template_cleanup q set state='processing',lease_owner=p_run,
    lease_until=clock_timestamp()+interval '330 seconds',attempts=q.attempts+1,updated_at=clock_timestamp()
    from due where q.template_code=due.template_code returning q.*;
end $$;
create function public.finish_alimtalk_template_cleanup(p_run uuid,p_code text,p_state text)
returns boolean language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  if p_state not in ('stopped','review_cancelled','manual_review','unknown') then raise exception 'PM_INVALID_CLEANUP_RESULT'; end if;
  update public.alimtalk_template_cleanup set state=case when p_state='unknown' and attempts>=6 then 'manual_review' else p_state end,lease_owner=null,lease_until=null,
    next_attempt_at=clock_timestamp()+interval '1 hour',updated_at=clock_timestamp()
    where template_code=p_code and lease_owner=p_run and lease_until>clock_timestamp();
  return found;
end $$;
revoke all on function public.claim_alimtalk_template_cleanup(uuid,integer),public.finish_alimtalk_template_cleanup(uuid,text,text) from public,anon,authenticated;
grant execute on function public.claim_alimtalk_template_cleanup(uuid,integer),public.finish_alimtalk_template_cleanup(uuid,text,text) to service_role;
revoke all on function public.guard_alimtalk_registry_identity(),public.guard_shop_alimtalk_code(),public.guard_platform_alimtalk_code(),public.guard_alimtalk_selection_scope(),public.retire_shop_alimtalk_codes() from public,anon,authenticated;
revoke all on function public.guard_alimtalk_provider_cache() from public,anon,authenticated;
grant execute on function public.guard_alimtalk_registry_identity(),public.guard_shop_alimtalk_code(),public.guard_platform_alimtalk_code(),public.guard_alimtalk_selection_scope(),public.retire_shop_alimtalk_codes(),public.guard_alimtalk_provider_cache() to service_role;
notify pgrst,'reload schema';
commit;
