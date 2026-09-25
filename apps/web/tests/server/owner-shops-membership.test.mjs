import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const { resolveOwnerShopAccess } = await import("../../src/server/owner-api-auth.ts");

test("owner shop listing uses the shared canonical access resolver", async () => {
  const route = await readSource("src/app/api/owner/shops/route.ts");
  const getRoute = route.slice(route.indexOf("export async function GET"), route.indexOf("export async function PATCH"));

  assert.match(getRoute, /authClient\.auth\.getUser\(token\)/);
  assert.match(getRoute, /assertServerManagedAccountActive\(user\)/);
  assert.match(getRoute, /loadOwnerShopAccessForUser\(user\.id\)/);
  assert.match(getRoute, /accessibleShops\.map\(\(access\) => access\.shopId\)/);
  assert.equal((getRoute.match(/\.in\("id", accessibleShopIds\)/g) ?? []).length, 2);
  assert.doesNotMatch(getRoute, /\.eq\("owner_user_id"/);
  assert.doesNotMatch(getRoute, /user_metadata/);
});

test("canonical resolver preserves owners and managers while filtering unbound staff", async () => {
  const authority = await readSource("src/server/owner-api-auth.ts");
  const resolver = authority.slice(
    authority.indexOf("export function resolveOwnerShopAccess"),
    authority.indexOf("export function isStaffOwnerContext"),
  );

  assert.match(resolver, /\.\.\.params\.ownedShops\.map\([\s\S]*role: "owner" as const/);
  assert.match(resolver, /\.\.\.params\.memberships\.flatMap/);
  assert.match(resolver, /return staffId[\s\S]*:\s*\[\]/);
  assert.match(resolver, /rolePriority\(access\.role\) < rolePriority\(previous\.role\)/);
  assert.match(resolver, /return Array\.from\(accessByShopId\.values\(\)\)\.sort/);

  const access = resolveOwnerShopAccess({
    userId: "current-user",
    ownedShops: [{ id: "owned-shop" }],
    memberships: [
      { owner_user_id: "current-user", shop_id: "manager-shop", role: "manager", is_primary: true },
      { owner_user_id: "current-user", shop_id: "staff-shop", role: "staff", is_primary: false },
      { owner_user_id: "current-user", shop_id: "foreign-binding-shop", role: "staff", is_primary: false },
      { owner_user_id: "current-user", shop_id: "inactive-shop", role: "staff", is_primary: false },
    ],
    staffBindings: [
      { id: "staff-current", shop_id: "staff-shop", is_active: true, auth_user_id: "current-user" },
      { id: "staff-foreign", shop_id: "foreign-binding-shop", is_active: true, auth_user_id: "other-user" },
      { id: "staff-inactive", shop_id: "inactive-shop", is_active: false, auth_user_id: "current-user" },
    ],
  });

  assert.deepEqual(access, [
    { shopId: "manager-shop", role: "manager", isPrimary: true, staffId: null },
    { shopId: "owned-shop", role: "owner", isPrimary: false, staffId: null },
    { shopId: "staff-shop", role: "staff", isPrimary: false, staffId: "staff-current" },
  ]);
});

test("existing canonical tables keep staff binding and memberships service-managed", async () => {
  const [staffMigration, membershipMigration] = await Promise.all([
    readSource("../../supabase/migrations/202607100001_staff_account_privacy.sql"),
    readSource("../../supabase/migrations/20260826034028_secure_owner_shop_memberships.sql"),
  ]);

  assert.match(staffMigration, /auth_user_id uuid references auth\.users\(id\)/);
  assert.match(staffMigration, /unique index if not exists staff_members_auth_user_id_unique/);
  assert.match(membershipMigration, /role in \('owner', 'manager', 'staff'\)/);
  assert.match(membershipMigration, /revoke all on table public\.owner_shop_memberships from public, anon, authenticated/);
  assert.match(membershipMigration, /grant select, insert, update, delete on table public\.owner_shop_memberships to service_role/);
  assert.doesNotMatch(membershipMigration, /grant[^;]+owner_shop_memberships[^;]+to (?:public|anon|authenticated)/i);
});
