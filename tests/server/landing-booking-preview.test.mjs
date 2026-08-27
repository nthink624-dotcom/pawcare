import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { LANDING_DEMO_SHOP_ID } from "../../src/lib/development-demo.ts";
import { buildLandingDemoBootstrap } from "../../src/server/landing-demo-bootstrap.ts";

const REQUIRED_SERVICE_ID = "petmanager-demo-service-full";

test("landing booking bootstrap is a fresh PII-free local fixture", () => {
  const first = buildLandingDemoBootstrap();
  const second = buildLandingDemoBootstrap();

  assert.equal(first.mode, "mock");
  assert.equal(first.shop.id, LANDING_DEMO_SHOP_ID);
  assert.equal(first.shop.phone, "");
  assert.equal(first.shop.address, "");
  assert.ok(first.services.some((service) => service.id === REQUIRED_SERVICE_ID));
  assert.ok(first.services.every((service) => service.shop_id === LANDING_DEMO_SHOP_ID));
  assert.equal(first.guardians.length, 1);
  assert.equal(first.guardians[0].name, "예약 예시 고객");
  assert.equal(first.guardians[0].phone, "000-0000-0000");
  assert.equal(first.pets.length, 1);
  assert.equal(first.pets[0].name, "예약 예시 A");
  assert.equal(first.appointments.length, 1);
  assert.equal(first.appointments[0].status, "completed");
  assert.equal(first.groomingRecords.length, 1);
  assert.ok(first.groomingRecords[0].care_report_data);
  assert.deepEqual(first.notifications, []);
  assert.deepEqual(first.landingInterests, []);
  assert.notEqual(first, second);
  assert.notEqual(first.shop, second.shop);
});

test("landing demo branch resolves before hosted Supabase access", () => {
  const source = fs.readFileSync(new URL("../../src/server/bootstrap.ts", import.meta.url), "utf8");
  const landingBranch = source.indexOf("if (isLandingDemoShopId(shopId))");
  const environmentGate = source.indexOf("if (!hasSupabaseServerEnv())");
  const hostedClient = source.indexOf("const supabase = getSupabaseAdmin()");

  assert.ok(landingBranch >= 0);
  assert.ok(landingBranch < environmentGate);
  assert.ok(landingBranch < hostedClient);
  assert.match(source.slice(landingBranch, environmentGate), /buildLandingDemoBootstrap\(\)/);
});

test("landing preview retry is bounded and the global error screen is not exposed", () => {
  const source = fs.readFileSync(
    new URL("../../src/components/landing/landing-booking-flow-carousel.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /automaticRetryCountRef\.current === 0/);
  assert.match(source, /frameUrl === "about:blank"/);
  assert.match(source, /frameText\.trim\(\)\.length === 0/);
  assert.match(source, /frameText\.includes\("화면을 불러오지 못했습니다"\)/);
  assert.match(source, /예약 데모를 준비하지 못했습니다/);
  assert.doesNotMatch(source, /setInterval\(/);
});

test("landing care report voice control hydrates from a stable server state", () => {
  const source = fs.readFileSync(
    new URL("../../src/components/owner-web/calendar-care-note-input.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /useState\(false\)/);
  assert.match(source, /setSpeechSupported\(Boolean\(getSpeechRecognitionConstructor\(\)\)\)/);
  assert.doesNotMatch(source, /useState\(\(\) => Boolean\(getSpeechRecognitionConstructor\(\)\)\)/);
});
