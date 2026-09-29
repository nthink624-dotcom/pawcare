-- The earlier scale and notification migrations created two identical indexes
-- on notifications(shop_id, created_at desc). Keep the canonical *_shop_id_*
-- index and remove the shorter duplicate during the next approved migration.
drop index if exists public.notifications_shop_created_at_idx;
