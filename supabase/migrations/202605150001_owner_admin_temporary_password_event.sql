alter table owner_admin_events
  drop constraint if exists owner_admin_events_event_type_check;

alter table owner_admin_events
  add constraint owner_admin_events_event_type_check
  check (
    event_type in (
      'trial_extended',
      'service_extended',
      'plan_changed',
      'status_changed',
      'payment_status_changed',
      'suspended',
      'restored',
      'temporary_password_issued'
    )
  );
