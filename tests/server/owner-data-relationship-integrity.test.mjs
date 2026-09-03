import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { afterEach, test } from "node:test";

for (const key of [
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
]) {
  delete process.env[key];
}

const { getMockStore, resetMockStore, setMockStore } = await import("../../src/server/mock-store.ts");
const { restoreGuardians, upsertService } = await import("../../src/server/owner-mutations.ts");

afterEach(() => {
  resetMockStore();
});

function serviceInput(serviceId, overrides = {}) {
  return {
    shopId: "demo-shop",
    serviceId,
    name: "테넌트 안전 서비스",
    price: 45_000,
    priceType: "fixed",
    durationMinutes: 60,
    isActive: true,
    category: "미용",
    description: "",
    sortOrder: 1,
    capacityLabel: "동일 시간 1건",
    staffSelectionMode: "all",
    priceGuide: {},
    ...overrides,
  };
}

function assertStatus(status) {
  return (error) => {
    assert.equal(error?.status, status);
    return true;
  };
}

function deletedGuardian(base, id, shopId) {
  return {
    ...base,
    id,
    shop_id: shopId,
    deleted_at: new Date().toISOString(),
    deleted_restore_until: new Date(Date.now() + 60_000).toISOString(),
  };
}

test("a supplied cross-shop or stale service id performs zero mutations", async () => {
  const store = getMockStore();
  const seed = store.services[0];
  assert.ok(seed);

  setMockStore({
    ...store,
    services: [...store.services, { ...seed, id: "foreign-service", shop_id: "other-shop" }],
  });

  const beforeForeign = getMockStore();
  await assert.rejects(() => upsertService(serviceInput("foreign-service")), assertStatus(404));
  assert.deepEqual(getMockStore(), beforeForeign);

  const beforeStale = getMockStore();
  await assert.rejects(() => upsertService(serviceInput("missing-service")), assertStatus(404));
  assert.deepEqual(getMockStore(), beforeStale);
});

test("a same-shop service update keeps its tenant and row identity", async () => {
  const store = getMockStore();
  const seed = store.services.find((service) => service.shop_id === "demo-shop");
  assert.ok(seed);
  const beforeCount = store.services.length;

  await upsertService(serviceInput(seed.id, { name: "같은 매장 수정", price: 52_000 }));

  const updatedStore = getMockStore();
  const updated = updatedStore.services.find((service) => service.id === seed.id);
  assert.equal(updatedStore.services.length, beforeCount);
  assert.equal(updated?.shop_id, seed.shop_id);
  assert.equal(updated?.name, "같은 매장 수정");
  assert.equal(updated?.price, 52_000);
  assert.equal(updated?.created_at, seed.created_at);
});

test("cross-shop and shop-less guardian restore attempts perform zero mutations", async () => {
  const store = getMockStore();
  const seed = store.guardians[0];
  assert.ok(seed);
  const sameShopGuardian = deletedGuardian(seed, "same-shop-guardian", "demo-shop");
  const foreignGuardian = deletedGuardian(seed, "foreign-guardian", "other-shop");

  setMockStore({
    ...store,
    guardians: [...store.guardians, sameShopGuardian, foreignGuardian],
  });

  const beforeForeign = getMockStore();
  await assert.rejects(
    () => restoreGuardians({ shopId: "demo-shop", guardianIds: [foreignGuardian.id] }),
    assertStatus(404),
  );
  assert.deepEqual(getMockStore(), beforeForeign);

  const beforeShopLess = getMockStore();
  await assert.rejects(() => restoreGuardians({ guardianIds: [sameShopGuardian.id] }));
  assert.deepEqual(getMockStore(), beforeShopLess);
});

test("a same-shop restorable guardian is restored without changing its tenant", async () => {
  const store = getMockStore();
  const seed = store.guardians[0];
  assert.ok(seed);
  const guardian = deletedGuardian(seed, "same-shop-guardian", "demo-shop");
  setMockStore({ ...store, guardians: [...store.guardians, guardian] });

  const result = await restoreGuardians({ shopId: "demo-shop", guardianIds: [guardian.id] });

  const restored = getMockStore().guardians.find((item) => item.id === guardian.id);
  assert.deepEqual(result.guardianIds, [guardian.id]);
  assert.equal(restored?.shop_id, "demo-shop");
  assert.equal(restored?.deleted_at, null);
  assert.equal(restored?.deleted_restore_until, null);
});

test("remote mutation contracts bind lookups and writes to the authorized shop", async () => {
  const [mutations, schemas, serviceRoute, guardianRestoreRoute] = await Promise.all([
    readFile(new URL("../../src/server/owner-mutations.ts", import.meta.url), "utf8"),
    readFile(new URL("../../src/server/schemas.ts", import.meta.url), "utf8"),
    readFile(new URL("../../src/app/api/services/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../../src/app/api/guardians/restore/route.ts", import.meta.url), "utf8"),
  ]);

  const serviceBlock = mutations.slice(
    mutations.indexOf("export async function upsertService"),
    mutations.indexOf("export async function deleteService"),
  );
  const restoreBlock = mutations.slice(
    mutations.indexOf("export async function restoreGuardians"),
    mutations.indexOf("export async function createPet"),
  );

  assert.match(serviceRoute, /const owner = await requireOwnerShop\(request, body\?\.shopId\)/);
  assert.match(serviceRoute, /assertOwnerOrManager\(owner\)/);
  assert.match(serviceRoute, /shopId: owner\.shopId/);
  assert.doesNotMatch(serviceBlock, /\.upsert\(/);
  assert.match(serviceBlock, /\.select\("id"\)[\s\S]*\.eq\("id", payload\.serviceId\)[\s\S]*\.eq\("shop_id", payload\.shopId\)[\s\S]*\.maybeSingle\(\)/);
  assert.match(serviceBlock, /\.update\(serviceUpdate\)[\s\S]*\.eq\("id", payload\.serviceId\)[\s\S]*\.eq\("shop_id", payload\.shopId\)/);
  assert.doesNotMatch(serviceBlock.match(/const serviceUpdate = \{[\s\S]*?\n  \};/)?.[0] ?? "", /shop_id/);

  assert.match(schemas, /guardianRestoreSchema = z\.object\(\{\s*shopId: z\.string\(\)\.min\(1\)/);
  assert.match(guardianRestoreRoute, /const owner = await requireOwnerShop\(request, body\?\.shopId\)/);
  assert.match(guardianRestoreRoute, /assertOwnerOrManager\(owner\)/);
  assert.match(guardianRestoreRoute, /restoreGuardians\(\{ \.\.\.body, shopId: owner\.shopId \}\)/);
  assert.equal((restoreBlock.match(/\.eq\("shop_id", payload\.shopId\)/g) ?? []).length, 2);
  assert.doesNotMatch(restoreBlock.match(/\.update\(\{[\s\S]*?\n    \}\)/)?.[0] ?? "", /shop_id/);
});
