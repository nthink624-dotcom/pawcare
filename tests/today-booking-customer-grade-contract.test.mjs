import assert from "node:assert/strict";
import test from "node:test";

import { getTodayBookingCustomerGradeLabel } from "../src/lib/today-booking-customer-grade.ts";

test("today booking grade uses only explicit canonical values", () => {
  assert.equal(getTodayBookingCustomerGradeLabel({ visitType: "first_visit", gradeOverride: null }), "신규 고객");
  assert.equal(getTodayBookingCustomerGradeLabel({ visitType: "revisit", gradeOverride: "loyal" }), "단골");
  assert.equal(getTodayBookingCustomerGradeLabel({ visitType: "first_visit", gradeOverride: "loyal" }), "신규 고객");
  assert.equal(getTodayBookingCustomerGradeLabel({ visitType: "revisit", gradeOverride: "normal" }), null);
  assert.equal(getTodayBookingCustomerGradeLabel({ visitType: null, gradeOverride: "attention" }), null);
  assert.equal(getTodayBookingCustomerGradeLabel({ visitType: null, gradeOverride: null }), null);
});
