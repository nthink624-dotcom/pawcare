create role anon; create role authenticated; create role service_role;
create table public.platform_alimtalk_templates(template_alias text,notification_type text,template_config_key text);
create table public.shop_alimtalk_template_requests(template_alias text,notification_type text,
  constraint shop_alimtalk_template_requests_alias_check check (template_alias in ('booking_consent_request','booking_confirmed')),
  constraint shop_alimtalk_template_requests_type_check check (notification_type in ('booking_consent_request','booking_confirmed')));
create table public.shops(id text primary key);
create table public.guardians(id uuid primary key,shop_id text,name text,notification_settings jsonb default '{}',updated_at timestamptz default now());
create table public.pets(id uuid primary key,shop_id text,guardian_id uuid,name text);
create table public.appointments(id uuid primary key default gen_random_uuid(),shop_id text,guardian_id uuid,pet_id uuid,staff_id text,status text,source text default 'owner',start_at timestamptz,end_at timestamptz,discount_snapshot jsonb default '{}',updated_at timestamptz default now());
