create table if not exists owner_admin_events (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references auth.users(id) on delete cascade,
  target_shop_id text not null references shops(id) on delete cascade,
  admin_email text not null,
  event_type text not null check (
    event_type in (
      'trial_extended',
      'service_extended',
      'plan_changed',
      'status_changed',
      'payment_status_changed',
      'suspended',
      'restored'
    )
  ),
  previous_payload jsonb not null default '{}'::jsonb,
  next_payload jsonb not null default '{}'::jsonb,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists owner_admin_events_target_user_idx
  on owner_admin_events(target_user_id, created_at desc);

create index if not exists owner_admin_events_target_shop_idx
  on owner_admin_events(target_shop_id, created_at desc);
