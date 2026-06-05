alter table if exists public.staff_members
  add column if not exists display_name text not null default '',
  add column if not exists position text not null default '직원';

update public.staff_members
set
  display_name = case
    when nullif(trim(display_name), '') is null then name
    else display_name
  end,
  position = case
    when nullif(trim(position), '') is null or position = '직원' then coalesce(nullif(trim(split_part(role, '/', 1)), ''), '직원')
    else position
  end
where is_active = true;
