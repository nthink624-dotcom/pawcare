create table if not exists public.shop_alimtalk_template_requests (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shops(id) on delete cascade,
  notification_type text not null,
  template_code text not null unique,
  template_name text not null,
  template_content text not null,
  category_code text not null,
  template_buttons jsonb not null default '[]'::jsonb,
  inspection_status text not null default 'draft',
  service_status text not null default 'unknown',
  provider_checked_at timestamptz,
  submitted_at timestamptz,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shop_alimtalk_template_requests_type_check check (
    notification_type in (
      'booking_confirmed', 'booking_cancelled',
      'appointment_reminder_10m', 'visit_schedule_notice', 'visit_reminder_notice',
      'grooming_started', 'grooming_almost_done', 'grooming_completed'
    )
  ),
  constraint shop_alimtalk_template_requests_inspection_check check (
    inspection_status in ('draft', 'submitting', 'requested', 'reviewing', 'approved', 'rejected', 'unknown')
  )
);

create index if not exists shop_alimtalk_template_requests_shop_type_idx
  on public.shop_alimtalk_template_requests (shop_id, notification_type, created_at desc);

create unique index if not exists shop_alimtalk_template_requests_one_active_review_idx
  on public.shop_alimtalk_template_requests (shop_id, notification_type)
  where inspection_status in ('submitting', 'requested', 'reviewing', 'unknown');

alter table public.shop_alimtalk_template_requests enable row level security;
revoke all on table public.shop_alimtalk_template_requests from anon, authenticated;
grant all on table public.shop_alimtalk_template_requests to service_role;

notify pgrst, 'reload schema';
