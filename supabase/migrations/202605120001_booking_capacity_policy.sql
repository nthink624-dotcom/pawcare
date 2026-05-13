update shops
set concurrent_capacity = case
  when approval_mode = 'manual' then 2
  else 1
end
where concurrent_capacity <> case
  when approval_mode = 'manual' then 2
  else 1
end;

alter table shops
  drop constraint if exists shops_concurrent_capacity_check;

alter table shops
  add constraint shops_concurrent_capacity_check
    check (concurrent_capacity between 1 and 2);
