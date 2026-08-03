import assert from "node:assert/strict";
import test from "node:test";

import { getAppointmentWriteErrorMessage } from "../../src/lib/appointment-write-errors.ts";

test("staff overlap persistence errors are safe and actionable for owners", () => {
  assert.equal(
    getAppointmentWriteErrorMessage({
      code: "23P01",
      message: "appointment overlaps another active appointment for the same staff member",
    }),
    "선택한 담당자에게 같은 시간 예약이 있습니다.",
  );
});

test("unrelated persistence errors preserve the server message", () => {
  assert.equal(
    getAppointmentWriteErrorMessage({ message: "database unavailable" }),
    "database unavailable",
  );
});
