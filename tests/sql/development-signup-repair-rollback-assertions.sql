do $$
begin
  if to_regclass('public.owner_shop_memberships') is not null then
    raise exception 'membership rollback incomplete';
  end if;
  if to_regclass('public.signup_idempotency_requests') is not null then
    raise exception 'atomic signup rollback incomplete';
  end if;
  if to_regprocedure('public.complete_owner_signup_v1(uuid,text,uuid,jsonb,jsonb,jsonb,jsonb)') is not null then
    raise exception 'atomic signup function rollback incomplete';
  end if;
  if (select approval_mode from public.shops where id = 'fixture-shop') <> 'manual'
     or (select concurrent_capacity from public.shops where id = 'fixture-shop') <> 2
     or (select booking_slot_interval_minutes from public.shops where id = 'fixture-shop') <> 30
     or (select booking_slot_offset_minutes from public.shops where id = 'fixture-shop') <> 5 then
    raise exception 'booking defaults rollback mismatch';
  end if;
end;
$$;
