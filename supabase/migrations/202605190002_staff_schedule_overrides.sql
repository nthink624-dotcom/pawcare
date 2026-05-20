create table if not exists public.staff_schedule_overrides (
  id text primary key,
  shop_id text not null references public.shops(id) on delete cascade,
  staff_id text not null references public.staff_members(id) on delete cascade,
  work_date date not null,
  status text not null,
  start_time time,
  end_time time,
  period text,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_schedule_overrides_status_check
    check (status in ('work', 'off', 'annual', 'half')),
  constraint staff_schedule_overrides_period_check
    check (period is null or period in ('오전', '오후')),
  constraint staff_schedule_overrides_work_time_check
    check (
      status <> 'work'
      or (
        start_time is not null
        and end_time is not null
        and start_time < end_time
      )
    )
);

create unique index if not exists staff_schedule_overrides_shop_staff_date_idx
  on public.staff_schedule_overrides (shop_id, staff_id, work_date);

create index if not exists staff_schedule_overrides_shop_date_idx
  on public.staff_schedule_overrides (shop_id, work_date);
