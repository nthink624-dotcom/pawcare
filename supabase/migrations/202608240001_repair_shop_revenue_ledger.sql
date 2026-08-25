-- Repair guard for environments where the revenue-ledger migration was marked
-- applied but the underlying relation was later removed.
-- This is schema-only: it never changes a shop's existing revenue rows.

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

notify pgrst, 'reload schema';
