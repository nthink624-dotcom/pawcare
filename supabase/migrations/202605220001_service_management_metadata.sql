-- Title: 2026-05-22 서비스/요금표 저장 스키마 보강
-- Purpose: Persist owner service-management values that were previously local-only.

alter table if exists public.services
  add column if not exists category text not null default '미용',
  add column if not exists description text not null default '',
  add column if not exists sort_order integer not null default 1,
  add column if not exists capacity_label text not null default '동일 시간 1건',
  add column if not exists staff_selection_mode text not null default 'all',
  add column if not exists price_guide jsonb not null default '{}'::jsonb;

alter table if exists public.services
  drop constraint if exists services_staff_selection_mode_check,
  add constraint services_staff_selection_mode_check
    check (staff_selection_mode in ('all', 'unassigned', 'specific'));

create index if not exists services_shop_sort_order_idx
  on public.services (shop_id, sort_order, created_at);

create index if not exists services_shop_active_category_idx
  on public.services (shop_id, is_active, category);

create table if not exists public.shop_service_guides (
  shop_id text primary key references public.shops(id) on delete cascade,
  duration_guide jsonb not null default '{"baseRows":[],"extraRows":[]}'::jsonb,
  extra_cost_guide jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.shop_service_guides (shop_id)
select shops.id
from public.shops
on conflict (shop_id) do nothing;

do $$
begin
  if to_regclass('public.staff_members') is not null then
    execute $sql$
      create table if not exists public.service_staff_assignments (
        service_id text not null references public.services(id) on delete cascade,
        staff_id text not null references public.staff_members(id) on delete cascade,
        created_at timestamptz not null default now(),
        primary key (service_id, staff_id)
      )
    $sql$;

    execute $sql$
      create index if not exists service_staff_assignments_staff_idx
        on public.service_staff_assignments (staff_id)
    $sql$;
  end if;
end $$;

with ranked_services as (
  select
    id,
    row_number() over (
      partition by shop_id
      order by created_at, id
    ) as next_sort_order,
    case
      when name like '%목욕%' then '목욕'
      when name like '%위생%' then '위생'
      when name like '%발톱%' then '옵션'
      when name like '%스파%' or name like '%약욕%' then '옵션'
      else '미용'
    end as inferred_category
  from public.services
)
update public.services
set
  sort_order = ranked_services.next_sort_order,
  category = ranked_services.inferred_category,
  updated_at = now()
from ranked_services
where services.id = ranked_services.id
  and (
    services.sort_order = 1
    or services.category = '미용'
  );

notify pgrst, 'reload schema';
