do $$
declare
  v_existed boolean;
  v_expected bigint;
  v_current bigint;
  v_expected_fingerprint text;
  v_current_fingerprint text;
begin
  select table_existed_before, row_count_after, row_fingerprint_after
    into v_existed, v_expected, v_expected_fingerprint
  from public.migration_20260826034028_reconciliation_state where singleton;
  if not found then raise exception 'PM_MEMBERSHIP_ROLLBACK_STATE_MISSING'; end if;
  if v_existed then raise exception 'PM_MEMBERSHIP_ROLLBACK_REQUIRES_MANUAL_GRANT_RESTORE'; end if;
  select count(*) into v_current from public.owner_shop_memberships;
  if v_current is distinct from v_expected then
    raise exception 'PM_MEMBERSHIP_ROLLBACK_BLOCKED_DATA_CHANGED';
  end if;
  select encode(
    extensions.digest(
      convert_to(
        coalesce(string_agg(to_jsonb(membership)::text, E'\n' order by owner_user_id, shop_id), ''),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  ) into v_current_fingerprint
  from public.owner_shop_memberships as membership;
  if v_current_fingerprint is distinct from v_expected_fingerprint then
    raise exception 'PM_MEMBERSHIP_ROLLBACK_BLOCKED_CONTENT_CHANGED';
  end if;
end;
$$;
revoke all on table public.owner_shop_memberships from public, anon, authenticated, service_role;
drop table public.owner_shop_memberships;
drop table public.migration_20260826034028_reconciliation_state;
notify pgrst, 'reload schema';
