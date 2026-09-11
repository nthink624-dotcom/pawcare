-- Restore the server role's least-privilege access to the existing private
-- media tenant guards. Client roles remain blocked by the original revokes.

grant usage on schema private to service_role;

grant execute
  on function private.assert_linked_row_shop(text, uuid, uuid, uuid)
  to service_role;

grant execute
  on function private.assert_media_asset_tenant_integrity()
  to service_role;
