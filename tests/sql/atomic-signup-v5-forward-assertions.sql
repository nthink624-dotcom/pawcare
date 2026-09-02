do $$
begin
  if to_regprocedure('public.claim_owner_signup_v5(uuid,text)') is null
     or to_regprocedure('public.mark_owner_signup_auth_created_v5(uuid,text,uuid)') is null
     or to_regprocedure('public.complete_owner_signup_v5(uuid,text,uuid,jsonb,jsonb,jsonb,jsonb,uuid,uuid,jsonb,text)') is null then
    raise exception 'PM_SIGNUP_V5_FORWARD_CONTRACT_MISSING';
  end if;
  if to_regnamespace('pm_signup_private') is null then
    raise exception 'PM_SIGNUP_V5_PRIVATE_SCHEMA_MISSING';
  end if;
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='pm_signup_private'
       and (not p.prosecdef or not ('search_path=""'=any(coalesce(p.proconfig, array[]::text[]))))
  ) then raise exception 'PM_SIGNUP_V5_PRIVATE_FUNCTION_SECURITY_INVALID'; end if;
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.proname like '%owner_signup_v5'
       and (p.prosecdef or not ('search_path=""'=any(coalesce(p.proconfig, array[]::text[]))))
  ) then raise exception 'PM_SIGNUP_V5_WRAPPER_SECURITY_INVALID'; end if;
  if has_function_privilege('authenticated','public.claim_owner_signup_v5(uuid,text)','execute')
     or has_function_privilege('anon','public.claim_owner_signup_v5(uuid,text)','execute')
     or not has_function_privilege('service_role','public.claim_owner_signup_v5(uuid,text)','execute') then
    raise exception 'PM_SIGNUP_V5_EXECUTE_GRANTS_INVALID';
  end if;
end;
$$;
