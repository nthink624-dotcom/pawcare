alter table public.media_assets
  drop constraint if exists media_assets_media_kind_check;

alter table public.media_assets
  add constraint media_assets_media_kind_check
  check (
    media_kind in (
      'grooming_before',
      'grooming_after',
      'grooming_result',
      'message_image',
      'shop_profile',
      'staff_profile',
      'customer_shared',
      'memo_attachment'
    )
  );
