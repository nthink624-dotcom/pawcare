-- Reconcile the Development history/schema drift for owner_shop_memberships.
-- The canonical 202605190005 migration is recorded remotely, but the relation is absent.
create table if not exists public.migration_20260826034028_reconciliation_state (
  singleton boolean primary key default true check (singleton),
  table_existed_before boolean not null,
  row_count_after bigint,
  row_fingerprint_after text check (row_fingerprint_after is null or length(row_fingerprint_after) = 64),
  reconciled_at timestamptz not null default now()
);

alter table public.migration_20260826034028_reconciliation_state enable row level security;
revoke all on table public.migration_20260826034028_reconciliation_state from public, anon, authenticated;
grant select, insert, update on table public.migration_20260826034028_reconciliation_state to service_role;

insert into public.migration_20260826034028_reconciliation_state (singleton, table_existed_before)
values (true, to_regclass('public.owner_shop_memberships') is not null)
on conflict (singleton) do nothing;

create table if not exists public.owner_shop_memberships (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  shop_id text not null references public.shops(id) on delete cascade,
  role text not null default 'owner',
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_user_id, shop_id),
  constraint owner_shop_memberships_role_check check (role in ('owner', 'manager', 'staff'))
);

do $$
declare
  v_required_columns integer;
begin
  select count(*) into v_required_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'owner_shop_memberships'
    and column_name in ('owner_user_id', 'shop_id', 'role', 'is_primary', 'created_at', 'updated_at');
  if v_required_columns <> 6
     or not exists (select 1 from pg_constraint where conrelid = 'public.owner_shop_memberships'::regclass and contype = 'p')
     or not exists (select 1 from pg_constraint where conrelid = 'public.owner_shop_memberships'::regclass and conname = 'owner_shop_memberships_role_check') then
    raise exception 'PM_MEMBERSHIP_SCHEMA_RECONCILIATION_FAILED';
  end if;
end;
$$;

create unique index if not exists owner_shop_memberships_primary_owner_unique
  on public.owner_shop_memberships(owner_user_id) where is_primary;
create index if not exists owner_shop_memberships_shop_id_idx
  on public.owner_shop_memberships(shop_id);

insert into public.owner_shop_memberships (owner_user_id, shop_id, role, is_primary, created_at, updated_at)
select shops.owner_user_id, shops.id, 'owner', owner_profiles.shop_id = shops.id, shops.created_at, now()
from public.shops
left join public.owner_profiles on owner_profiles.user_id = shops.owner_user_id
where shops.owner_user_id is not null
on conflict (owner_user_id, shop_id) do update
set role = excluded.role, is_primary = excluded.is_primary, updated_at = now();

update public.migration_20260826034028_reconciliation_state as state
set row_count_after = snapshot.row_count,
    row_fingerprint_after = snapshot.row_fingerprint,
    reconciled_at = now()
from (
  select
    count(*) as row_count,
    encode(
      extensions.digest(
        convert_to(
          coalesce(string_agg(to_jsonb(membership)::text, E'\n' order by owner_user_id, shop_id), ''),
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    ) as row_fingerprint
  from public.owner_shop_memberships as membership
) as snapshot
where state.singleton;

alter table public.owner_shop_memberships enable row level security;
revoke all on table public.owner_shop_memberships from public, anon, authenticated;
grant select, insert, update, delete on table public.owner_shop_memberships to service_role;
notify pgrst, 'reload schema';
