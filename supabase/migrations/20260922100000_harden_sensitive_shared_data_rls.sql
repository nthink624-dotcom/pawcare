-- Keep customer, appointment, media, and operational data behind the server API.
-- The PC and mobile servers use service_role after canonical owner membership checks;
-- browser clients must not query these tables through PostgREST directly.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'shops',
    'guardians',
    'pets',
    'services',
    'appointments',
    'grooming_records',
    'grooming_record_drafts',
    'notifications',
    'staff_members',
    'owner_shop_memberships',
    'media_assets',
    'media_variants',
    'notification_media_attachments',
    'media_send_attempts',
    'shop_media_usage_months',
    'shop_media_limits'
  ]
  loop
    if exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = table_name
        and c.relkind in ('r', 'p')
    ) then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    end if;
  end loop;
end
$$;

do $$
begin
  if to_regclass('public.customer_search_profiles') is not null then
    revoke all on table public.customer_search_profiles from public, anon, authenticated;
  end if;
end
$$;

do $$
begin
  if to_regprocedure('public.increment_shop_media_usage(text,date,integer,bigint,integer,bigint)') is not null then
    execute 'revoke all on function public.increment_shop_media_usage(text, date, integer, bigint, integer, bigint) from public, anon, authenticated';
    execute 'alter function public.increment_shop_media_usage(text, date, integer, bigint, integer, bigint) set search_path = pg_catalog, public';
  end if;

  if to_regclass('public.shop_alimtalk_credit_summaries') is not null then
    execute 'alter view public.shop_alimtalk_credit_summaries set (security_invoker = true)';
    execute 'revoke all on table public.shop_alimtalk_credit_summaries from public, anon, authenticated';
  end if;

  if to_regprocedure('public.create_appointment_with_capacity_lock(uuid,text,uuid,uuid,text,date,time,text,text,text,timestamptz,timestamptz,text,timestamptz,timestamptz)') is not null then
    execute 'revoke all on function public.create_appointment_with_capacity_lock(uuid, text, uuid, uuid, text, date, time, text, text, text, timestamptz, timestamptz, text, timestamptz, timestamptz) from public, anon, authenticated';
  end if;

  if to_regprocedure('public.update_appointment_with_capacity_lock(uuid,text,date,time,text,text,text,timestamptz,timestamptz,timestamptz)') is not null then
    execute 'revoke all on function public.update_appointment_with_capacity_lock(uuid, text, date, time, text, text, text, timestamptz, timestamptz, timestamptz) from public, anon, authenticated';
  end if;
end
$$;

notify pgrst, 'reload schema';
