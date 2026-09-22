-- Temporary media is retained for at most 60 days. Long-lived grooming and
-- profile media keeps a null expires_at and is removed by explicit/account deletion.
alter table public.shop_media_limits
  alter column transient_retention_days set default 60;

update public.shop_media_limits
set transient_retention_days = 60,
    updated_at = now()
where transient_retention_days = 30;

update public.media_assets
set expires_at = greatest(expires_at, created_at + interval '60 days'),
    updated_at = now()
where retention_policy = 'transient'
  and deleted_at is null
  and expires_at is not null
  and expires_at < created_at + interval '60 days';
