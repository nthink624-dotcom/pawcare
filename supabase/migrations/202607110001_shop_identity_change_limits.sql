alter table public.shop_identity_change_events
  drop constraint if exists shop_identity_change_events_field_name_check;

alter table public.shop_identity_change_events
  add constraint shop_identity_change_events_field_name_check
    check (field_name in ('name', 'address', 'phone', 'additional_contact'));

create index if not exists shop_identity_change_events_shop_field_created_idx
  on public.shop_identity_change_events(shop_id, field_name, created_at desc);

comment on table public.shop_identity_change_events is
  'Tracks customer-visible shop identity changes for abuse review and monthly edit limits.';
