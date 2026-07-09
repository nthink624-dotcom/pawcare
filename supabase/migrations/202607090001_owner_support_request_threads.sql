alter table public.owner_support_requests
  add column if not exists category text,
  add column if not exists priority text not null default 'normal',
  add column if not exists title text,
  add column if not exists source text not null default 'owner_web',
  add column if not exists owner_name text,
  add column if not exists owner_phone text,
  add column if not exists owner_email text,
  add column if not exists answered_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists owner_last_read_at timestamptz,
  add column if not exists admin_last_read_at timestamptz;

update public.owner_support_requests
set category = case request_type
  when 'bug' then 'bug'
  when 'improvement' then 'feature_request'
  when 'question' then 'how_to_use'
  else 'other'
end
where category is null;

alter table public.owner_support_requests
  alter column category set default 'other',
  alter column category set not null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'owner_support_requests_request_type_check'
      and conrelid = 'public.owner_support_requests'::regclass
  ) then
    alter table public.owner_support_requests
      drop constraint owner_support_requests_request_type_check;
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname = 'owner_support_requests_status_check'
      and conrelid = 'public.owner_support_requests'::regclass
  ) then
    alter table public.owner_support_requests
      drop constraint owner_support_requests_status_check;
  end if;
end $$;

alter table public.owner_support_requests
  add constraint owner_support_requests_request_type_check
    check (request_type in ('bug', 'improvement', 'question', 'how_to_use', 'payment', 'feature_request', 'account', 'notification', 'other')),
  add constraint owner_support_requests_category_check
    check (category in ('how_to_use', 'bug', 'payment', 'feature_request', 'account', 'notification', 'other')),
  add constraint owner_support_requests_status_check
    check (status in ('open', 'reviewing', 'answered', 'resolved', 'closed')),
  add constraint owner_support_requests_priority_check
    check (priority in ('low', 'normal', 'urgent'));

create index if not exists owner_support_requests_category_created_at_idx
  on public.owner_support_requests (category, created_at desc);

create table if not exists public.owner_support_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.owner_support_requests(id) on delete cascade,
  sender_type text not null check (sender_type in ('owner', 'admin', 'system')),
  sender_id uuid,
  sender_name text,
  message text not null,
  is_answer boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists owner_support_messages_request_id_created_at_idx
  on public.owner_support_messages (request_id, created_at asc);

create table if not exists public.owner_support_attachments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.owner_support_requests(id) on delete cascade,
  message_id uuid references public.owner_support_messages(id) on delete cascade,
  media_asset_id uuid references public.media_assets(id) on delete set null,
  file_url text not null,
  file_name text,
  file_type text,
  file_size integer,
  uploaded_by_type text not null check (uploaded_by_type in ('owner', 'admin')),
  uploaded_by_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists owner_support_attachments_request_id_created_at_idx
  on public.owner_support_attachments (request_id, created_at asc);

create table if not exists public.owner_support_notifications (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.owner_support_requests(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete set null,
  shop_id text not null references public.shops(id) on delete cascade,
  channel text not null check (channel in ('in_app', 'app_push', 'alimtalk', 'sms')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  title text,
  body text,
  sent_at timestamptz,
  failed_reason text,
  created_at timestamptz not null default now()
);

create index if not exists owner_support_notifications_request_id_created_at_idx
  on public.owner_support_notifications (request_id, created_at desc);

insert into public.owner_support_messages (
  request_id,
  sender_type,
  sender_id,
  message,
  is_answer,
  created_at,
  updated_at
)
select
  request.id,
  'owner',
  request.owner_user_id,
  request.message,
  false,
  request.created_at,
  request.updated_at
from public.owner_support_requests request
where not exists (
  select 1
  from public.owner_support_messages message
  where message.request_id = request.id
);

alter table public.owner_support_messages enable row level security;
alter table public.owner_support_attachments enable row level security;
alter table public.owner_support_notifications enable row level security;
