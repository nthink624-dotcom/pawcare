select public.test_price_guide_meter_attack(
  case :scenario
    when 1 then 'session6'
    when 2 then 'device8'
    when 3 then 'ip10'
    when 4 then 'cost'
  end,
  :client_id,
  :estimated_cost,
  :daily_cap,
  (:charge = 1)
);
