-- Protect operational data from accidental destructive actions.
-- Shops are soft-deleted. Hard deletes of key business rows are retained in an
-- internal audit ledger, and TRUNCATE is blocked for those tables.

create schema if not exists private;
revoke all on schema private from public;

alter table public.shops
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by_actor text,
  add column if not exists deleted_reason text;

create index if not exists shops_active_idx
  on public.shops (id)
  where deleted_at is null;

create table if not exists public.data_deletion_audit (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  event_type text not null check (event_type in ('hard_delete', 'soft_delete', 'restore')),
  table_name text not null,
  record_id text not null,
  shop_id text,
  actor_identifier text,
  database_role text not null,
  deletion_reason text,
  record_snapshot jsonb not null default '{}'::jsonb
);

create index if not exists data_deletion_audit_occurred_at_idx
  on public.data_deletion_audit (occurred_at desc);

create index if not exists data_deletion_audit_table_record_idx
  on public.data_deletion_audit (table_name, record_id, occurred_at desc);

create index if not exists data_deletion_audit_shop_idx
  on public.data_deletion_audit (shop_id, occurred_at desc)
  where shop_id is not null;

alter table public.data_deletion_audit enable row level security;
revoke all on table public.data_deletion_audit from anon, authenticated;

create or replace function private.write_business_delete_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_row jsonb;
  resolved_record_id text;
  resolved_shop_id text;
  resolved_actor text;
begin
  old_row := to_jsonb(old);
  resolved_record_id := coalesce(old_row ->> 'id', old_row ->> 'user_id', old_row ->> 'shop_id', '(unknown)');
  resolved_shop_id := case
    when tg_table_name = 'shops' then old_row ->> 'id'
    else old_row ->> 'shop_id'
  end;
  resolved_actor := coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', ''),
    current_user
  );

  insert into public.data_deletion_audit (
    event_type,
    table_name,
    record_id,
    shop_id,
    actor_identifier,
    database_role,
    record_snapshot
  ) values (
    'hard_delete',
    tg_table_name,
    resolved_record_id,
    resolved_shop_id,
    resolved_actor,
    current_user,
    old_row
  );

  return old;
end;
$$;

create or replace function private.write_shop_soft_delete_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_name text;
  snapshot jsonb;
begin
  if old.deleted_at is null and new.deleted_at is not null then
    event_name := 'soft_delete';
    snapshot := to_jsonb(old);
  elsif old.deleted_at is not null and new.deleted_at is null then
    event_name := 'restore';
    snapshot := to_jsonb(new);
  else
    return new;
  end if;

  insert into public.data_deletion_audit (
    event_type,
    table_name,
    record_id,
    shop_id,
    actor_identifier,
    database_role,
    deletion_reason,
    record_snapshot
  ) values (
    event_name,
    'shops',
    new.id,
    new.id,
    coalesce(new.deleted_by_actor, current_user),
    current_user,
    new.deleted_reason,
    snapshot
  );

  return new;
end;
$$;

create or replace function private.block_protected_table_truncate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception '보호된 업무 테이블은 TRUNCATE할 수 없습니다. 승인된 복구 절차를 사용해 주세요.'
    using errcode = '55000';
end;
$$;

create or replace function private.prevent_data_deletion_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception '삭제 감사 기록은 수정하거나 삭제할 수 없습니다.'
    using errcode = '55000';
end;
$$;

drop trigger if exists data_deletion_audit_immutable on public.data_deletion_audit;
create trigger data_deletion_audit_immutable
before update or delete on public.data_deletion_audit
for each row
execute function private.prevent_data_deletion_audit_mutation();

drop trigger if exists shops_soft_delete_audit on public.shops;
create trigger shops_soft_delete_audit
after update of deleted_at on public.shops
for each row
execute function private.write_shop_soft_delete_audit();

drop trigger if exists shops_hard_delete_audit on public.shops;
create trigger shops_hard_delete_audit
before delete on public.shops
for each row
execute function private.write_business_delete_audit();

drop trigger if exists owner_profiles_hard_delete_audit on public.owner_profiles;
create trigger owner_profiles_hard_delete_audit
before delete on public.owner_profiles
for each row
execute function private.write_business_delete_audit();

drop trigger if exists appointments_hard_delete_audit on public.appointments;
create trigger appointments_hard_delete_audit
before delete on public.appointments
for each row
execute function private.write_business_delete_audit();

drop trigger if exists guardians_hard_delete_audit on public.guardians;
create trigger guardians_hard_delete_audit
before delete on public.guardians
for each row
execute function private.write_business_delete_audit();

drop trigger if exists pets_hard_delete_audit on public.pets;
create trigger pets_hard_delete_audit
before delete on public.pets
for each row
execute function private.write_business_delete_audit();

drop trigger if exists services_hard_delete_audit on public.services;
create trigger services_hard_delete_audit
before delete on public.services
for each row
execute function private.write_business_delete_audit();

drop trigger if exists staff_members_hard_delete_audit on public.staff_members;
create trigger staff_members_hard_delete_audit
before delete on public.staff_members
for each row
execute function private.write_business_delete_audit();

drop trigger if exists grooming_records_hard_delete_audit on public.grooming_records;
create trigger grooming_records_hard_delete_audit
before delete on public.grooming_records
for each row
execute function private.write_business_delete_audit();

drop trigger if exists shops_block_truncate on public.shops;
create trigger shops_block_truncate
before truncate on public.shops
execute function private.block_protected_table_truncate();

drop trigger if exists owner_profiles_block_truncate on public.owner_profiles;
create trigger owner_profiles_block_truncate
before truncate on public.owner_profiles
execute function private.block_protected_table_truncate();

drop trigger if exists appointments_block_truncate on public.appointments;
create trigger appointments_block_truncate
before truncate on public.appointments
execute function private.block_protected_table_truncate();

drop trigger if exists guardians_block_truncate on public.guardians;
create trigger guardians_block_truncate
before truncate on public.guardians
execute function private.block_protected_table_truncate();

drop trigger if exists pets_block_truncate on public.pets;
create trigger pets_block_truncate
before truncate on public.pets
execute function private.block_protected_table_truncate();

drop trigger if exists services_block_truncate on public.services;
create trigger services_block_truncate
before truncate on public.services
execute function private.block_protected_table_truncate();

drop trigger if exists staff_members_block_truncate on public.staff_members;
create trigger staff_members_block_truncate
before truncate on public.staff_members
execute function private.block_protected_table_truncate();

drop trigger if exists grooming_records_block_truncate on public.grooming_records;
create trigger grooming_records_block_truncate
before truncate on public.grooming_records
execute function private.block_protected_table_truncate();

revoke all on function private.write_business_delete_audit() from public, anon, authenticated;
revoke all on function private.write_shop_soft_delete_audit() from public, anon, authenticated;
revoke all on function private.block_protected_table_truncate() from public, anon, authenticated;
revoke all on function private.prevent_data_deletion_audit_mutation() from public, anon, authenticated;
