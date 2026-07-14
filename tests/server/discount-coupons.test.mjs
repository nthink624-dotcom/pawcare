import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCustomerDiscountQuote,
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

test("first-visit and revisit coupons are mutually exclusive in a quote", () => {
  const quote = buildCustomerDiscountQuote({
    coupons: [
      { ...coupon("first", "first_visit"), discount_value: 5000 },
      { ...coupon("revisit", "revisit"), discount_value: 9000 },
    ],
    visitType: "first_visit",
    dateKey: "2026-07-11",
    serviceOptionIds: ["service-1"],
    originalAmount: 30000,
  });

  assert.deepEqual(quote.eligibleCoupons.map((item) => item.id), ["first"]);
  assert.deepEqual(quote.appliedCoupons.map((item) => item.id), ["first"]);
});

test("service-specific coupons apply only to linked service options", () => {
  const scopedCoupon = {
    ...coupon("scoped", "all"),
    service_scope: "specific",
    service_option_ids: ["service-2"],
  };

  const quote = buildCustomerDiscountQuote({
    coupons: [scopedCoupon],
    visitType: "revisit",
    dateKey: "2026-07-11",
    serviceOptionIds: ["service-1"],
    originalAmount: 30000,
  });

  assert.equal(quote.discountAmount, 0);
  assert.deepEqual(quote.eligibleCoupons, []);
});

test("the server chooses the highest-value valid combination", () => {
  const quote = buildCustomerDiscountQuote({
    coupons: [
      { ...coupon("exclusive", "all"), discount_value: 7000 },
      { ...coupon("stack-1", "all"), combination_policy: "stackable", discount_value: 4000 },
      { ...coupon("stack-2", "all"), combination_policy: "stackable", discount_value: 5000 },
    ],
    visitType: "revisit",
    dateKey: "2026-07-11",
    serviceOptionIds: ["service-1"],
    originalAmount: 30000,
  });

  assert.deepEqual(quote.appliedCoupons.map((item) => item.id), ["stack-1", "stack-2"]);
  assert.equal(quote.discountAmount, 9000);
  assert.equal(quote.finalAmount, 21000);
});

test("per-customer coupons already used are excluded", () => {
  const limitedCoupon = { ...coupon("limited", "all"), per_customer_limit: true };
  const quote = buildCustomerDiscountQuote({
    coupons: [limitedCoupon],
    visitType: "revisit",
    dateKey: "2026-07-11",
    serviceOptionIds: ["service-1"],
    originalAmount: 30000,
    usedCouponIds: ["limited"],
  });

  assert.equal(quote.discountAmount, 0);
  assert.deepEqual(quote.appliedCoupons, []);
});

test("complimentary services apply alongside the best monetary discount", () => {
  const quote = buildCustomerDiscountQuote({
    coupons: [
      { ...coupon("money", "all"), discount_value: 5000 },
      {
        ...coupon("service", "all"),
        discount_type: "service",
        discount_value: 0,
        service_benefit_name: "발바닥 보습",
        combination_policy: "stackable",
      },
    ],
    visitType: "revisit",
    dateKey: "2026-07-11",
    serviceOptionIds: ["service-1"],
    originalAmount: 30000,
  });

  assert.deepEqual(quote.appliedCoupons.map((item) => item.id), ["money", "service"]);
  assert.equal(quote.appliedCoupons[1].serviceBenefitName, "발바닥 보습");
  assert.equal(quote.discountAmount, 5000);
  assert.equal(quote.finalAmount, 25000);
});
