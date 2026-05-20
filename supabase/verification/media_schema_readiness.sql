-- PetManager media schema readiness check.
-- Read-only verification query. Safe for local/development/production.
-- Expected production Supabase ref: ysxykikqnneuhypybjry.

with expected_tables(table_schema, table_name) as (
  values
    ('public', 'media_assets'),
    ('public', 'media_variants'),
    ('public', 'notification_media_attachments'),
    ('public', 'media_send_attempts'),
    ('public', 'shop_media_usage_months'),
    ('public', 'shop_media_limits')
),
table_status as (
  select
    expected_tables.table_schema,
    expected_tables.table_name,
    exists (
      select 1
      from information_schema.tables
      where information_schema.tables.table_schema = expected_tables.table_schema
        and information_schema.tables.table_name = expected_tables.table_name
    ) as exists
  from expected_tables
),
expected_columns(table_name, column_name) as (
  values
    ('media_assets', 'id'),
    ('media_assets', 'shop_id'),
    ('media_assets', 'storage_path'),
    ('media_assets', 'source_byte_size'),
    ('media_assets', 'expires_at'),
    ('media_variants', 'media_asset_id'),
    ('media_variants', 'variant_key'),
    ('notification_media_attachments', 'notification_id'),
    ('notification_media_attachments', 'media_asset_id'),
    ('notification_media_attachments', 'send_status'),
    ('media_send_attempts', 'media_asset_id'),
    ('media_send_attempts', 'status'),
    ('shop_media_usage_months', 'shop_id'),
    ('shop_media_usage_months', 'usage_month'),
    ('shop_media_limits', 'shop_id'),
    ('shop_media_limits', 'monthly_soft_limit_bytes'),
    ('shop_media_limits', 'transient_retention_days'),
    ('shop_media_limits', 'enforcement_mode')
),
column_status as (
  select
    expected_columns.table_name,
    expected_columns.column_name,
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and information_schema.columns.table_name = expected_columns.table_name
        and information_schema.columns.column_name = expected_columns.column_name
    ) as exists
  from expected_columns
),
expected_indexes(indexname) as (
  values
    ('media_assets_shop_created_at_idx'),
    ('media_assets_shop_kind_created_at_idx'),
    ('media_assets_shop_guardian_created_at_idx'),
    ('media_assets_shop_pet_created_at_idx'),
    ('media_assets_shop_appointment_created_at_idx'),
    ('media_assets_shop_grooming_record_created_at_idx'),
    ('media_assets_shop_expires_at_idx'),
    ('notification_media_attachments_notification_idx'),
    ('notification_media_attachments_shop_sent_at_idx'),
    ('notification_media_attachments_shop_guardian_sent_at_idx'),
    ('media_send_attempts_shop_created_at_idx'),
    ('media_send_attempts_shop_sent_at_idx'),
    ('media_send_attempts_media_created_at_idx'),
    ('shop_media_usage_months_month_idx'),
    ('shop_media_limits_enforcement_mode_idx')
),
index_status as (
  select
    expected_indexes.indexname,
    exists (
      select 1
      from pg_indexes
      where schemaname = 'public'
        and pg_indexes.indexname = expected_indexes.indexname
    ) as exists
  from expected_indexes
),
function_status as (
  select
    'increment_shop_media_usage' as function_name,
    exists (
      select 1
      from pg_proc
      join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
      where pg_namespace.nspname = 'public'
        and pg_proc.proname = 'increment_shop_media_usage'
    ) as exists
),
storage_bucket_status as (
  select
    'petmanager-media' as bucket_name,
    case
      when exists (
        select 1
        from information_schema.tables
        where table_schema = 'storage'
          and table_name = 'buckets'
      )
      then exists (
        select 1
        from storage.buckets
        where id = 'petmanager-media'
          and name = 'petmanager-media'
          and public = false
      )
      else false
    end as exists
)
select
  'table' as check_type,
  table_schema || '.' || table_name as target,
  exists
from table_status
union all
select
  'column' as check_type,
  'public.' || table_name || '.' || column_name as target,
  exists
from column_status
union all
select
  'index' as check_type,
  'public.' || indexname as target,
  exists
from index_status
union all
select
  'function' as check_type,
  'public.' || function_name as target,
  exists
from function_status
union all
select
  'storage_bucket' as check_type,
  'storage.' || bucket_name as target,
  exists
from storage_bucket_status
order by check_type, target;
