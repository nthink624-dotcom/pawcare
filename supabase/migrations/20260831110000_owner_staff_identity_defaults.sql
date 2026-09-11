-- Prepared only. Do not apply remotely without the owner's migration approval.
-- Keep the owner staff identity aligned with the verified owner profile while
-- keeping the job role separate from assigned grooming services.

create or replace function public.normalize_owner_staff_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_name text;
begin
  if new.id <> new.shop_id || '-staff-owner' then
    return new;
  end if;

  select nullif(trim(profile.name), '')
    into v_owner_name
    from public.owner_profiles profile
   where profile.shop_id = new.shop_id
   order by profile.created_at
   limit 1;

  new.name := coalesce(v_owner_name, '대표자');
  new.display_name := new.name;
  new.role := '대표';
  new.position := '대표';
  return new;
end;
$$;

drop trigger if exists normalize_owner_staff_identity_before_write on public.staff_members;
create trigger normalize_owner_staff_identity_before_write
before insert or update of name, display_name, role, position on public.staff_members
for each row execute function public.normalize_owner_staff_identity();

update public.staff_members staff
   set name = coalesce(nullif(trim(profile.name), ''), '대표자'),
       display_name = coalesce(nullif(trim(profile.name), ''), '대표자'),
       role = '대표',
       position = '대표',
       updated_at = now()
  from public.owner_profiles profile
 where staff.id = staff.shop_id || '-staff-owner'
   and profile.shop_id = staff.shop_id;

revoke all on function public.normalize_owner_staff_identity() from public, anon, authenticated;
grant execute on function public.normalize_owner_staff_identity() to service_role;
