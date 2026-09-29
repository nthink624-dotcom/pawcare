-- CatchCall links a provider-neutral call event to one owner-confirmed appointment.
-- This migration is intentionally not applied by the feature implementation.

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
  '?ㅻ꼫媛 ?듯솕 ?댁슜???뺤씤????ν븳 ?덉빟. ?꾪솕踰덊샇 ?먮Ц怨??듯솕 ?댁슜? ??ν븯吏 ?딅뒗??';
comment on column public.call_events.notification_status is
  '?대떦 ?듯솕 ?덉빟???덉빟?뺤젙 ?뚮┝??泥섎━ ?곹깭. 以묐났 諛쒖넚 諛⑹????곹깭媛?';

alter table public.call_events enable row level security;

;
