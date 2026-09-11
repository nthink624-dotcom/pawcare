do $$
begin
  if to_regprocedure('public.claim_owner_signup_v5(uuid,text)') is not null
     or to_regprocedure('public.mark_owner_signup_auth_created_v5(uuid,text,uuid)') is not null
     or to_regprocedure('public.complete_owner_signup_v5(uuid,text,uuid,jsonb,jsonb,jsonb,jsonb,uuid,uuid,jsonb,text)') is not null then
    raise exception 'PM_SIGNUP_V5_ROLLBACK_PUBLIC_FUNCTION_REMAINS';
  end if;
  if to_regnamespace('pm_signup_private') is not null then
    raise exception 'PM_SIGNUP_V5_ROLLBACK_PRIVATE_SCHEMA_REMAINS';
  end if;
  if to_regprocedure('public.claim_owner_signup_v4(uuid,text)') is null
     or to_regprocedure('public.complete_owner_signup_v4(uuid,text,uuid,jsonb,jsonb,jsonb,jsonb,uuid,uuid,jsonb,text)') is null then
    raise exception 'PM_SIGNUP_V5_ROLLBACK_DAMAGED_PREVIOUS_STATE';
  end if;
end;
$$;
