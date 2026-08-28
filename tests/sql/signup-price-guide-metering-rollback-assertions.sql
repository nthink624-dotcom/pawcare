\set ON_ERROR_STOP on

do $$
begin
  if to_regclass('public.signup_price_guide_security_meter_buckets') is not null then
    raise exception 'ROLLBACK_LEFT_METER_TABLE';
  end if;
  if to_regprocedure('public.claim_signup_price_guide_analysis_v2(uuid,text,text,text,text,text,text,text,text,text,text,integer,integer)') is not null then
    raise exception 'ROLLBACK_LEFT_CLAIM_V2';
  end if;
  if to_regprocedure('public.claim_signup_price_guide_analysis_v1(uuid,text,text,text,text,integer,integer)') is not null then
    raise exception 'ROLLBACK_RESTORED_INSECURE_V1';
  end if;
  if exists (select 1 from public.signup_price_guide_analysis_requests) then
    raise exception 'ROLLBACK_LEFT_ANALYSIS_ROWS';
  end if;
end;
$$;

