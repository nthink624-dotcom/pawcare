-- Local disposable PostgreSQL fixture only. Never run on a hosted project.
do $$ begin
  if current_database() <> 'pm_deletion_fixture' then
    raise exception 'This fixture requires the dedicated local pm_deletion_fixture database';
  end if;
end $$;
create role anon;
create role authenticated;
create role service_role;
create schema private;
create table public.shops(id text primary key, owner_user_id uuid);
create table public.owner_subscriptions(
  user_id uuid primary key, subscription_status text,
  payment_method_exists boolean, billing_key_encrypted text, billing_key_encryption_version integer,
  billing_issue_id text, last_schedule_id text, next_billing_at timestamptz,
  last_payment_id text, last_payment_at timestamptz, last_payment_failed_at timestamptz,
  current_period_started_at timestamptz, current_period_ends_at timestamptz,
  trial_started_at timestamptz, trial_ends_at timestamptz, last_payment_status text
);
create table public.owner_payment_ledger(user_id uuid);
create table public.owner_billing_events(user_id uuid);
create table private.owner_account_deletion_requests(
  id uuid primary key default gen_random_uuid(), owner_user_id uuid,
  shop_ids text[] not null default '{}', idempotency_key_hash char(64) unique,
  state text not null default 'prepared'
);
