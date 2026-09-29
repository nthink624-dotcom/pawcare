-- These tables have RLS enabled and intentionally expose no browser policies.
-- Remove inherited anon/authenticated table grants so the ACL and RLS boundary
-- agree, while keeping the server-side service role path intact.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'admin_accounts',
    'appointment_change_events',
    'appointment_customer_requests',
    'appointment_pet_participants',
    'appointment_status_event_media',
    'appointment_status_events',
    'guardian_labels',
    'landing_feedback',
    'landing_interests',
    'notification_delivery_checks',
    'owner_activity_events',
    'owner_admin_events',
    'owner_billing_events',
    'owner_identity_verifications',
    'owner_login_sessions',
    'owner_payment_ledger',
    'owner_profiles',
    'owner_subscriptions',
    'owner_support_attachments',
    'owner_support_messages',
    'owner_support_notifications',
    'owner_support_requests',
    'pet_labels',
    'pet_staff_notes',
    'platform_alimtalk_template_events',
    'platform_alimtalk_template_overrides',
    'platform_alimtalk_templates',
    'service_staff_assignments',
    'shop_alimtalk_credit_balances',
    'shop_alimtalk_credit_events',
    'shop_service_guides',
    'staff_schedule_overrides'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('revoke all on table public.%I from anon, authenticated', table_name);
      execute format('grant all on table public.%I to service_role', table_name);
    end if;
  end loop;
end
$$;

notify pgrst, 'reload schema';
