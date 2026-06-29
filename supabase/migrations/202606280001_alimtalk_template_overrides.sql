-- Purpose: Store the PetManager-side Alimtalk template body that should be used at send time.

create table if not exists public.platform_alimtalk_template_overrides (
  template_alias text primary key,
  template_body text not null,
  is_active boolean not null default true,
  updated_by_admin_id uuid references public.admin_accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_alimtalk_template_overrides_alias_check
    check (
      template_alias in (
        'booking_received',
        'booking_confirmed',
        'booking_rejected',
        'booking_cancelled',
        'booking_time_proposed',
        'booking_rescheduled_confirmed',
        'appointment_reminder_10m',
        'grooming_started',
        'grooming_almost_done',
        'grooming_completed',
        'revisit_notice',
        'birthday_greeting'
      )
    )
);

create index if not exists platform_alimtalk_template_overrides_active_idx
  on public.platform_alimtalk_template_overrides (is_active, updated_at desc);

notify pgrst, 'reload schema';
