create table if not exists public.shop_revenue_entries (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shops(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  grooming_record_id uuid references public.grooming_records(id) on delete set null,
  guardian_id uuid references public.guardians(id) on delete set null,
  pet_id uuid references public.pets(id) on delete set null,
  service_id text references public.services(id) on delete set null,
  entry_date date not null,
  occurred_at timestamptz not null default now(),
  revenue_type text not null default 'service' check (
    revenue_type in ('service', 'product', 'fee', 'discount', 'refund', 'adjustment')
  ),
  status text not null default 'paid' check (
    status in ('expected', 'unpaid', 'paid', 'partially_refunded', 'refunded', 'cancelled', 'void')
  ),
  payment_method text not null default 'unknown' check (
    payment_method in ('unknown', 'card', 'cash', 'transfer', 'easy_pay', 'mixed', 'other')
  ),
  gross_amount integer not null default 0 check (gross_amount >= 0),
  discount_amount integer not null default 0 check (discount_amount >= 0),
  refund_amount integer not null default 0 check (refund_amount >= 0),
  net_amount integer generated always as (gross_amount - discount_amount - refund_amount) stored,
  title text not null default '',
  memo text not null default '',
  source text not null default 'manual' check (
    source in ('manual', 'appointment', 'grooming_record', 'portone', 'system')
  ),
  external_payment_id text,
  created_by_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists shop_revenue_entries_grooming_record_id_unique
  on public.shop_revenue_entries(grooming_record_id)
  where grooming_record_id is not null;

create index if not exists shop_revenue_entries_shop_id_entry_date_idx
  on public.shop_revenue_entries(shop_id, entry_date desc, occurred_at desc);

create index if not exists shop_revenue_entries_shop_id_status_date_idx
  on public.shop_revenue_entries(shop_id, status, entry_date desc);

create index if not exists shop_revenue_entries_shop_id_service_date_idx
  on public.shop_revenue_entries(shop_id, service_id, entry_date desc)
  where service_id is not null;

create index if not exists shop_revenue_entries_shop_id_guardian_date_idx
  on public.shop_revenue_entries(shop_id, guardian_id, entry_date desc)
  where guardian_id is not null;

create index if not exists shop_revenue_entries_external_payment_id_idx
  on public.shop_revenue_entries(external_payment_id)
  where external_payment_id is not null;

insert into public.shop_revenue_entries (
  shop_id,
  appointment_id,
  grooming_record_id,
  guardian_id,
  pet_id,
  service_id,
  entry_date,
  occurred_at,
  revenue_type,
  status,
  payment_method,
  gross_amount,
  title,
  memo,
  source,
  metadata,
  created_at,
  updated_at
)
select
  grooming_records.shop_id,
  grooming_records.appointment_id,
  grooming_records.id,
  grooming_records.guardian_id,
  grooming_records.pet_id,
  grooming_records.service_id,
  (grooming_records.groomed_at at time zone 'Asia/Seoul')::date,
  grooming_records.groomed_at,
  'service',
  'paid',
  'unknown',
  greatest(grooming_records.price_paid, 0),
  coalesce(nullif(services.name, ''), 'Grooming revenue'),
  coalesce(nullif(grooming_records.memo, ''), nullif(grooming_records.style_notes, ''), ''),
  'grooming_record',
  jsonb_build_object('backfilledFrom', 'grooming_records.price_paid'),
  coalesce(grooming_records.created_at, now()),
  coalesce(grooming_records.updated_at, now())
from public.grooming_records
left join public.services on services.id = grooming_records.service_id
where grooming_records.price_paid > 0
on conflict do nothing;

create or replace view public.shop_revenue_daily_summary as
select
  shop_id,
  entry_date,
  count(*) filter (where status not in ('cancelled', 'void')) as entry_count,
  coalesce(sum(gross_amount) filter (where status not in ('cancelled', 'void')), 0)::integer as gross_amount,
  coalesce(sum(discount_amount) filter (where status not in ('cancelled', 'void')), 0)::integer as discount_amount,
  coalesce(sum(refund_amount) filter (where status not in ('cancelled', 'void')), 0)::integer as refund_amount,
  coalesce(sum(net_amount) filter (where status in ('paid', 'partially_refunded', 'refunded')), 0)::integer as paid_net_amount,
  coalesce(sum(net_amount) filter (where status = 'expected'), 0)::integer as expected_net_amount,
  coalesce(sum(net_amount) filter (where status = 'unpaid'), 0)::integer as unpaid_net_amount
from public.shop_revenue_entries
group by shop_id, entry_date;

create or replace view public.shop_revenue_service_summary as
select
  revenue.shop_id,
  revenue.service_id,
  coalesce(services.name, revenue.title, 'Uncategorized') as service_name,
  count(*) filter (where revenue.status not in ('cancelled', 'void')) as entry_count,
  coalesce(sum(revenue.net_amount) filter (where revenue.status in ('paid', 'partially_refunded', 'refunded')), 0)::integer as paid_net_amount,
  coalesce(sum(revenue.net_amount) filter (where revenue.status = 'expected'), 0)::integer as expected_net_amount,
  coalesce(sum(revenue.net_amount) filter (where revenue.status = 'unpaid'), 0)::integer as unpaid_net_amount,
  min(revenue.entry_date) as first_entry_date,
  max(revenue.entry_date) as last_entry_date
from public.shop_revenue_entries revenue
left join public.services on services.id = revenue.service_id
group by revenue.shop_id, revenue.service_id, coalesce(services.name, revenue.title, 'Uncategorized');
