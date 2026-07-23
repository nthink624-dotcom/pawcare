-- Title: Enable RLS on internal public tables
-- Purpose: Block direct anon/authenticated access while preserving server-side service-role access.

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'appointment_change_events',
    'platform_alimtalk_template_overrides',
    'service_staff_assignments',
    'shop_identity_change_events'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I enable row level security', table_name);
    end if;
  end loop;
end
$$;

notify pgrst, 'reload schema';
