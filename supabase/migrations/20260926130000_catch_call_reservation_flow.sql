-- CatchCall links a provider-neutral call event to one owner-confirmed appointment.
-- Applied to the linked development and production projects after source and
-- contract verification.

alter table public.appointments
  drop constraint if exists appointments_source_check;

alter table public.appointments
  add constraint appointments_source_check
  check (source in ('customer', 'owner', 'catchcall'));

alter table public.call_events
  add column if not exists appointment_id uuid references public.appointments(id) on delete set null,
  add column if not exists reservation_status text not null default 'not_started'
    check (reservation_status in ('not_started', 'in_progress', 'confirmed', 'failed')),
  add column if not exists reservation_confirmed_at timestamptz,
  add column if not exists notification_status text not null default 'not_requested'
    check (notification_status in ('not_requested', 'queued', 'sent', 'failed', 'skipped')),
  add column if not exists notification_id uuid references public.notifications(id) on delete set null;

create index if not exists call_events_appointment_id_idx
  on public.call_events(appointment_id)
  where appointment_id is not null;

create index if not exists call_events_shop_reservation_status_idx
  on public.call_events(shop_id, reservation_status, occurred_at desc);

comment on column public.call_events.appointment_id is
  '오너가 통화 내용을 확인해 저장한 예약. 전화번호 원문과 통화 내용은 저장하지 않는다.';
comment on column public.call_events.notification_status is
  '해당 통화 예약의 예약확정 알림톡 처리 상태. 중복 발송 방지용 상태값.';

alter table public.call_events enable row level security;
