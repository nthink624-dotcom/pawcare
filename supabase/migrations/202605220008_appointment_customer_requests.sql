-- Title: 2026-05-22 고객 예약 변경/취소 요청 스키마 보강
-- Purpose: Persist customer-originated appointment change/cancel requests before or alongside appointment mutation.

create table if not exists public.appointment_customer_requests (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shops(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  guardian_id uuid references public.guardians(id) on delete set null,
  pet_id uuid references public.pets(id) on delete set null,
  request_type text not null,
  request_status text not null default 'received',
  current_service_id text references public.services(id) on delete set null,
  requested_service_id text references public.services(id) on delete set null,
  current_appointment_date date,
  current_appointment_time time,
  requested_appointment_date date,
  requested_appointment_time time,
  customer_memo text not null default '',
  owner_memo text not null default '',
  requester_name text not null default '',
  requester_phone_tail text not null default '',
  source text not null default 'customer_page',
  handled_by_user_id uuid references auth.users(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointment_customer_requests_type_check
    check (request_type in ('cancel', 'reschedule', 'change_service', 'note')),
  constraint appointment_customer_requests_status_check
    check (request_status in ('received', 'approved', 'rejected', 'applied', 'cancelled', 'expired')),
  constraint appointment_customer_requests_source_check
    check (source in ('customer_page', 'owner_web', 'owner_mobile', 'admin', 'system'))
);

create index if not exists appointment_customer_requests_shop_created_idx
  on public.appointment_customer_requests (shop_id, created_at desc);

create index if not exists appointment_customer_requests_appointment_idx
  on public.appointment_customer_requests (appointment_id, created_at desc)
  where appointment_id is not null;

create index if not exists appointment_customer_requests_guardian_idx
  on public.appointment_customer_requests (guardian_id, created_at desc)
  where guardian_id is not null;

create index if not exists appointment_customer_requests_status_idx
  on public.appointment_customer_requests (shop_id, request_status, created_at desc);

notify pgrst, 'reload schema';
