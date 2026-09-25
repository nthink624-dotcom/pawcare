import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const route = await readFile(new URL("../src/app/dev/booking-detail-preview/page.tsx", import.meta.url), "utf8");
const preview = await readFile(new URL("../src/components/owner/owner-booking-detail-dev-preview.tsx", import.meta.url), "utf8");
const ownerApp = await readFile(new URL("../src/components/owner/owner-app.tsx", import.meta.url), "utf8");
const weightAdapter = await readFile(new URL("../src/lib/owner-appointment-visit-weight.ts", import.meta.url), "utf8");

test("booking detail preview is unavailable in production", () => {
  assert.match(route, /process\.env\.NODE_ENV === "production" \|\| process\.env\.VERCEL_ENV === "production"/);
  assert.match(route, /notFound\(\)/);
});

test("development preview mounts the actual mobile appointment detail and shared visit-weight adapter", () => {
  assert.match(ownerApp, /export function AppointmentDetail/);
  assert.match(preview, /import \{ AppointmentDetail \} from "@\/components\/owner\/owner-app"/);
  assert.match(preview, /<AppointmentDetail/);
  assert.match(preview, /visitWeightTransport=\{transport\}/);
  assert.match(preview, /showMediaHistory=\{false\}/);
  assert.match(weightAdapter, /OwnerAppointmentVisitWeightTransport/);
  assert.match(weightAdapter, /ownerAppointmentVisitWeightTransport/);
  assert.doesNotMatch(preview, /function AppointmentDetail/);
});

test("development preview uses deterministic in-memory GET, PUT, readback, and cancellation only", () => {
  assert.match(preview, /requestCounts.*get: 0, put: 0, cancel: 0/s);
  assert.match(preview, /GET \{requestCounts\.get\}, PUT \{requestCounts\.put\}, 취소 \{requestCounts\.cancel\}/);
  assert.match(preview, /weightsRef\.current = \{ \.\.\.weightsRef\.current, current: measurement \}/);
  assert.match(preview, /payload\.status === "cancelled"/);
  assert.match(preview, /아주 긴 이름의 반려동물/);
  assert.match(preview, /010-1234-5678/);
  assert.doesNotMatch(preview, /fetch\(|fetchApiJsonWithAuth|localStorage|sessionStorage/);
});
