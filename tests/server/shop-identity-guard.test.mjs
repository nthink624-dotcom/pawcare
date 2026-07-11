import assert from "node:assert/strict";
import test from "node:test";

import {
  assertShopIdentityChangeLimit,
  buildShopIdentityChanges,
  insertShopIdentityChangeEvents,
} from "../../src/server/shop-identity-guard.ts";

function createAdminMock(rows = []) {
  const inserted = [];

  return {
    inserted,
    from(table) {
      assert.equal(table, "shop_identity_change_events");
      return {
        select() {
          return {
            eq() {
              return this;
            },
            in() {
              return this;
            },
            async gte() {
              return { data: rows, error: null };
            },
          };
        },
        async insert(nextRows) {
          inserted.push(...nextRows);
          return { error: null };
        },
      };
    },
  };
}

test("buildShopIdentityChanges normalizes phone-like identity fields", () => {
  const changes = buildShopIdentityChanges({
    current: {
      name: " 우유 미용실 ",
      phone: "010-1234-5678",
      address: "서울 강남구 1",
      additional_contact: "02-123-4567",
    },
    next: {
      name: "우유 미용실",
      phone: "01012345678",
      address: "서울 강남구 2",
      additional_contact: "021234567",
    },
  });

  assert.deepEqual(changes.map((change) => change.fieldName), ["address"]);
});

test("multiple field changes in one save share one change group", async () => {
  const admin = createAdminMock([]);
  const changes = buildShopIdentityChanges({
    current: { name: "A", phone: "01011112222" },
    next: { name: "B", phone: "01033334444" },
  });
  const limit = await assertShopIdentityChangeLimit({
    admin,
    shopId: "shop-1",
    changes,
    now: new Date("2026-07-11T00:00:00.000Z"),
  });

  await insertShopIdentityChangeEvents({
    admin,
    shopId: "shop-1",
    ownerUserId: "owner-1",
    changedByUserId: "owner-1",
    changes,
    changeGroupId: limit.changeGroupId,
    source: "test",
  });

  assert.equal(admin.inserted.length, 2);
  assert.ok(admin.inserted[0].metadata.change_group_id);
  assert.equal(admin.inserted[0].metadata.change_group_id, admin.inserted[1].metadata.change_group_id);
});

test("monthly limit counts grouped events, not raw field rows", async () => {
  const admin = createAdminMock([
    { id: "row-1", metadata: { change_group_id: "group-1" } },
    { id: "row-2", metadata: { change_group_id: "group-1" } },
    { id: "row-3", metadata: { change_group_id: "group-2" } },
  ]);

  await assert.rejects(
    () =>
      assertShopIdentityChangeLimit({
        admin,
        shopId: "shop-1",
        changes: [{ fieldName: "name", previousValue: "A", nextValue: "B" }],
        now: new Date("2026-07-11T00:00:00.000Z"),
      }),
    /월 2회/,
  );
});
