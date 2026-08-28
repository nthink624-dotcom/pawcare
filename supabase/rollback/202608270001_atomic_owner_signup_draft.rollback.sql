do $$
begin
  if to_regclass('public.signup_idempotency_requests') is not null
     and exists (select 1 from public.signup_idempotency_requests) then
    raise exception 'PM_ATOMIC_SIGNUP_V1_ROLLBACK_BLOCKED_REQUESTS_EXIST';
  end if;
end;
$$;
revoke all on function public.complete_owner_signup_v1(uuid, text, uuid, jsonb, jsonb, jsonb, jsonb)
  from public, anon, authenticated, service_role;
drop function if exists public.complete_owner_signup_v1(uuid, text, uuid, jsonb, jsonb, jsonb, jsonb);
drop table if exists public.signup_idempotency_requests;
notify pgrst, 'reload schema';
