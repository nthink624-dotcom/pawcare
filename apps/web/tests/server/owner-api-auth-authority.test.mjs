import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const { assertServerManagedAccountActive, OwnerApiError } = await import("../../src/server/owner-api-auth.ts");

test("account suspension is read from current server-managed app metadata", async () => {
  const [authority, adminOwners] = await Promise.all([
    readSource("src/server/owner-api-auth.ts"),
    readSource("src/app/api/admin/owners/route.ts"),
  ]);
  const requireOwnerShop = authority.slice(authority.indexOf("export async function requireOwnerShop"));
  const adminPatch = adminOwners.slice(adminOwners.indexOf("export async function PATCH"));

  assert.match(authority, /getServerManagedAccountSuspension\([\s\S]*appMetadata\?\.account_suspended === true/);
  assert.match(requireOwnerShop, /authClient\.auth\.getUser\(token\)[\s\S]*assertServerManagedAccountActive\(user\)/);
  assert.doesNotMatch(authority, /user_metadata[^\n;]*account_suspended|account_suspended[^\n;]*user_metadata/);

  assert.match(adminOwners, /getServerManagedAccountSuspension\(authUser\.app_metadata\)/);
  assert.match(adminOwners, /getServerManagedAccountSuspension\(user\.app_metadata\)/);
  assert.match(adminOwners, /delete sanitized\.account_suspended/);
  assert.match(adminOwners, /updateUserById\(body\.userId,[\s\S]*app_metadata: nextAppMetadata/);
  assert.doesNotMatch(adminOwners, /getServerManagedAccountSuspension\([^)]*user_metadata/);
  assert.ok(adminPatch.indexOf("requireAdminSession(request)") < adminPatch.indexOf("updateUserById(body.userId"));

  assert.doesNotThrow(() =>
    assertServerManagedAccountActive({
      app_metadata: { account_suspended: false },
      user_metadata: { account_suspended: true },
    }),
  );
  assert.throws(
    () => assertServerManagedAccountActive({ app_metadata: { account_suspended: true } }),
    (error) => error instanceof OwnerApiError && error.status === 403,
  );
});

test("staff authority requires both membership and active auth user binding", async () => {
  const authority = await readSource("src/server/owner-api-auth.ts");
  const resolver = authority.slice(
    authority.indexOf("export function resolveOwnerShopAccess"),
    authority.indexOf("export function isStaffOwnerContext"),
  );
  const loader = authority.slice(
    authority.indexOf("export async function loadOwnerShopAccessForUser"),
    authority.indexOf("export async function requireOwnerShop"),
  );
  const requireOwnerShop = authority.slice(authority.indexOf("export async function requireOwnerShop"));

  assert.match(loader, /from\("owner_shop_memberships"\)[\s\S]*eq\("owner_user_id", userId\)/);
  assert.match(loader, /from\("staff_members"\)[\s\S]*eq\("auth_user_id", userId\)[\s\S]*eq\("is_active", true\)/);
  assert.match(loader, /in\("shop_id", staffMembershipShopIds\)/);
  assert.match(loader, /resolveOwnerShopAccess\([\s\S]*staffBindings/);
  assert.match(resolver, /staffBindingByShopId\.get\(membership\.shop_id\)/);
  assert.match(resolver, /return staffId[\s\S]*role: "staff"/);
  assert.match(requireOwnerShop, /staffId: resolvedAccess\.staffId/);
  assert.doesNotMatch(authority, /readMetadataStaffId|metadataStaffId|staff_member_id|staffMemberId/);
});

test("missing staff authority schema fails closed instead of falling back to metadata", async () => {
  const authority = await readSource("src/server/owner-api-auth.ts");
  const loader = authority.slice(
    authority.indexOf("export async function loadOwnerShopAccessForUser"),
    authority.indexOf("export async function requireOwnerShop"),
  );

  assert.match(loader, /isMissingStaffAuthColumnError\(staffResult\.error\)[\s\S]*503/);
  assert.doesNotMatch(loader, /user_metadata|metadata\s*:/);
});
