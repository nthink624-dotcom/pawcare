alter table public.shop_media_limits
  alter column transient_retention_days set default 60;

update public.shop_media_limits
set transient_retention_days = 60,
    updated_at = now()
where transient_retention_days = 30
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'shop_media_limits'
      and column_name = 'updated_at'
  );;
