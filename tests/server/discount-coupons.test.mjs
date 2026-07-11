import assert from "node:assert/strict";
import test from "node:test";

import {
  filterDiscountCouponsForVisitType,
  hasActiveVisitSpecificDiscountCoupon,
} from "../../src/lib/discount-coupons.ts";

const baseCoupon = {
  id: "coupon",
  name: "혜택",
  owner_label: "혜택",
  enabled: true,
  visible: true,
  discount_type: "fixed",
  discount_value: 1000,
  combination_policy: "exclusive",
  service_scope: "all",
  service_option_ids: [],
  per_customer_limit: false,
  starts_at: "",
  ends_at: "",
};

function coupon(id, audience) {
  return {
    ...baseCoupon,
    id,
    audience,
  };
}

test("unknown visitors do not see first-visit and revisit coupons separately", () => {
  const coupons = [
    coupon("first", "first_visit"),
    coupon("revisit", "revisit"),
    coupon("all", "all"),
  ];

  const visible = filterDiscountCouponsForVisitType(coupons, "unknown", "2026-07-11");

  assert.deepEqual(visible.map((item) => item.id), ["all"]);
  assert.equal(hasActiveVisitSpecificDiscountCoupon(coupons, "2026-07-11"), true);
});

test("first-visit customers see first-visit coupons but not revisit coupons", () => {
  const coupons = [
    coupon("first", "first_visit"),
    coupon("revisit", "revisit"),
    coupon("all", "all"),
  ];

  const visible = filterDiscountCouponsForVisitType(coupons, "first_visit", "2026-07-11");

  assert.deepEqual(visible.map((item) => item.id), ["first", "all"]);
});

test("revisit customers see revisit coupons but not first-visit coupons", () => {
  const coupons = [
    coupon("first", "first_visit"),
    coupon("revisit", "revisit"),
    coupon("all", "all"),
  ];

  const visible = filterDiscountCouponsForVisitType(coupons, "revisit", "2026-07-11");

  assert.deepEqual(visible.map((item) => item.id), ["revisit", "all"]);
});
