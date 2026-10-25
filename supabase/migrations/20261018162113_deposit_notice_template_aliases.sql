-- Extend only deposit notification catalog values. Does NOT approve/map/send templates.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $patch$
declare cname text; definition text; column_name text;
begin
 foreach cname in array array['platform_alimtalk_templates_alias_check','platform_alimtalk_templates_notification_type_check'] loop
  select pg_get_constraintdef(oid) into definition from pg_constraint
   where conrelid='public.platform_alimtalk_templates'::regclass and conname=cname and contype='c';
  if definition is null or left(definition,6)<>'CHECK ' then raise exception 'UNEXPECTED_TEMPLATE_CONSTRAINT'; end if;
  column_name:=case when cname like '%alias_check' then 'template_alias' else 'notification_type' end;
  if position('booking_deposit_cancelled' in definition)>0 or position('booking_deposit_expired' in definition)>0 or position('booking_deposit_refunded' in definition)>0 then
   raise exception 'TEMPLATE_CONSTRAINT_ALREADY_CHANGED';
  end if;
  -- Retain every existing allowed value instead of replacing the enum list with a guessed one.
  execute format('alter table public.platform_alimtalk_templates drop constraint %I',cname);
  execute format('alter table public.platform_alimtalk_templates add constraint %I check (%s or %I in (''booking_deposit_request'',''booking_deposit_cancelled'',''booking_deposit_expired'',''booking_deposit_refunded'')) not valid',cname,substr(definition,7),column_name);
  execute format('alter table public.platform_alimtalk_templates validate constraint %I',cname);
 end loop;
 select pg_get_constraintdef(oid) into definition from pg_constraint where conrelid='public.platform_alimtalk_templates'::regclass and conname='platform_alimtalk_templates_config_key_check' and contype='c';
 if definition is null or left(definition,6)<>'CHECK ' then raise exception 'UNEXPECTED_TEMPLATE_CONFIG_CONSTRAINT'; end if;
 if position('templateBookingDepositRequest' in definition)=0 then
  alter table public.platform_alimtalk_templates drop constraint platform_alimtalk_templates_config_key_check;
  execute format('alter table public.platform_alimtalk_templates add constraint platform_alimtalk_templates_config_key_check check (%s or template_config_key=''templateBookingDepositRequest'') not valid',substr(definition,7));
  alter table public.platform_alimtalk_templates validate constraint platform_alimtalk_templates_config_key_check;
 end if;
end $patch$;
commit;
