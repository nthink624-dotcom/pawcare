-- Preserve existing function security, locking, and unrelated newer behavior.
-- Abort if the expected deadline expressions have changed; never silently skip.
begin;
do $migration$
declare definition text; updated text;
begin
  select pg_get_functiondef('public.snapshot_booking_policy()'::regprocedure) into definition;
  updated := replace(definition, 'clock_timestamp() + interval ''20 minutes''',
    'clock_timestamp() + make_interval(mins => coalesce((p->>''depositHoldMinutes'')::integer,20))');
  if updated = definition then raise exception 'SNAPSHOT_DEADLINE_SOURCE_CHANGED'; end if;
  execute updated;
  select pg_get_functiondef('public.save_booking_preparation(text,uuid,integer,jsonb,text,text,jsonb)'::regprocedure) into definition;
  updated := replace(definition, 'clock_timestamp()+interval ''20 minutes''',
    'clock_timestamp()+make_interval(mins => coalesce((b.data#>>''{policy,depositHoldMinutes}'')::integer,20))');
  if updated = definition then raise exception 'PREPARATION_DEADLINE_SOURCE_CHANGED'; end if;
  execute updated;
end $migration$;
-- Existing request snapshots and dueAt values are intentionally not updated.
alter table public.shop_booking_policies add constraint booking_deposit_hold_minutes_valid
  check (not (policy ? 'depositHoldMinutes') or (
    jsonb_typeof(policy->'depositHoldMinutes') = 'number'
    and (policy->>'depositHoldMinutes')::numeric between 1 and 1440
    and (policy->>'depositHoldMinutes')::numeric = trunc((policy->>'depositHoldMinutes')::numeric)
  ));
commit;
