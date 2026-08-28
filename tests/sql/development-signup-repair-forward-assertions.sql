do $$
begin
  if to_regclass('public.owner_shop_memberships') is null then
    raise exception 'membership table missing';
  end if;
  if (select count(*) from public.owner_shop_memberships) <> 1 then
    raise exception 'membership backfill mismatch';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.owner_shop_memberships'::regclass) then
    raise exception 'membership RLS disabled';
  end if;
  if has_table_privilege('anon', 'public.owner_shop_memberships', 'select')
     or has_table_privilege('authenticated', 'public.owner_shop_memberships', 'select') then
    raise exception 'browser membership grant remains';
  end if;
  if not has_table_privilege('service_role', 'public.owner_shop_memberships', 'select') then
    raise exception 'service membership grant missing';
  end if;
  if (select approval_mode from public.shops where id = 'fixture-shop') <> 'auto'
     or (select booking_slot_interval_minutes from public.shops where id = 'fixture-shop') <> 15 then
    raise exception 'booking defaults not locked';
  end if;
  if not exists (select 1 from public.migration_20260826111854_booking_defaults_backup where shop_id = 'fixture-shop') then
    raise exception 'booking defaults backup missing';
  end if;
  if to_regprocedure('public.complete_owner_signup_v1(uuid,text,uuid,jsonb,jsonb,jsonb,jsonb)') is null then
    raise exception 'atomic signup v1 missing';
  end if;
end;
$$;
