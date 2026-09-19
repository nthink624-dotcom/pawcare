alter table public.appointments
  add column if not exists staff_memo text not null default '';

-- Existing customer-created booking notes remain customer requests.
-- Notes on owner-created appointments were previously stored in memo,
-- so move them into the new internal staff memo field.
update public.appointments
set
  staff_memo = memo,
  memo = ''
where source = 'owner'
  and coalesce(staff_memo, '') = ''
  and btrim(memo) <> '';
