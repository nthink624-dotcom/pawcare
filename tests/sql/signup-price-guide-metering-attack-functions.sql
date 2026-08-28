\set ON_ERROR_STOP on

create table public.test_price_guide_meter_attack_results (
  scenario text not null,
  allowed boolean not null,
  code text not null,
  created_at timestamptz not null default clock_timestamp()
);

create or replace function public.test_price_guide_meter_attack(
  p_scenario text,
  p_client_id integer,
  p_estimated_cost integer,
  p_daily_cap integer,
  p_charge boolean
)
returns void
language plpgsql
as $$
declare
  v_token uuid := gen_random_uuid();
  v_rotation text := to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM');
  v_ip_subject text;
  v_session_subject text;
  v_device_subject text;
  v_result jsonb;
begin
  v_ip_subject := case when p_scenario = 'ip10' then 'same-ip' else p_scenario || '-ip-' || p_client_id end;
  v_session_subject := case when p_scenario = 'session6' then 'same-session' else p_scenario || '-session-' || p_client_id end;
  v_device_subject := case when p_scenario = 'device8' then 'same-device' else p_scenario || '-device-' || p_client_id end;

  v_result := public.claim_signup_price_guide_analysis_v2(
    v_token,
    encode(digest('binding-ip:' || v_ip_subject, 'sha256'), 'hex'),
    encode(digest('binding-session:' || v_session_subject, 'sha256'), 'hex'),
    encode(digest('binding-device:' || v_device_subject, 'sha256'), 'hex'),
    encode(digest(p_scenario || ':file:' || p_client_id || ':' || v_token, 'sha256'), 'hex'),
    v_rotation,
    encode(digest(v_rotation || ':ip:' || v_ip_subject, 'sha256'), 'hex'),
    encode(digest(v_rotation || ':session:' || v_session_subject, 'sha256'), 'hex'),
    encode(digest(v_rotation || ':device:' || v_device_subject, 'sha256'), 'hex'),
    encode(digest(v_rotation || ':provider:' || p_scenario, 'sha256'), 'hex'),
    encode(digest(v_rotation || ':circuit:' || p_scenario, 'sha256'), 'hex'),
    p_estimated_cost,
    p_daily_cap
  );

  insert into public.test_price_guide_meter_attack_results(scenario, allowed, code)
  values (p_scenario, coalesce((v_result->>'allowed')::boolean, false), coalesce(v_result->>'code', 'MISSING'));

  if coalesce((v_result->>'allowed')::boolean, false) then
    if p_charge then
      perform public.complete_signup_price_guide_analysis_v2(
        v_token,
        p_estimated_cost,
        repeat('x', 32),
        clock_timestamp() + interval '5 minutes'
      );
      perform public.purge_signup_price_guide_analysis_v2(v_token, 'confirmed', null);
    else
      perform public.purge_signup_price_guide_analysis_v2(v_token, 'cancelled', null);
    end if;
  end if;
end;
$$;

