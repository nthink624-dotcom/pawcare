import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  OWNER_PILOT_INITIAL_FREE_DAYS,
  OWNER_PILOT_MAX_FREE_DAYS,
  OWNER_PILOT_MIN_EXTENSION_DAYS,
  resolveOwnerPilotBenefitGrantAttempt,
  validateOwnerPilotBenefitGrant,
} from "../../src/lib/billing/owner-pilot-benefit.ts";
import {
  buildPilotBenefitPreviewFixture,
  PILOT_BENEFIT_PREVIEW_STATES,
} from "../../src/app/dev/pilot-benefits-preview/pilot-benefit-fixtures.ts";

const migrationPath = new URL("../../supabase/migrations/20260907090000_owner_pilot_pre_payment_benefits.sql", import.meta.url);
const serverPath = new URL("../../src/server/owner-pilot-benefits.ts", import.meta.url);
const routePath = new URL("../../src/app/api/admin/pilot-benefits/route.ts", import.meta.url);
const screenPath = new URL("../../src/components/admin/admin-pilot-benefit-screen.tsx", import.meta.url);
const navPath = new URL("../../src/components/admin/admin-section-nav.tsx", import.meta.url);
const landingPath = new URL("../../src/components/landing/landing-page.tsx", import.meta.url);
const faqPath = new URL("../../src/components/landing/landing-conversion-sections.tsx", import.meta.url);
const previewPagePath = new URL("../../src/app/dev/pilot-benefits-preview/page.tsx", import.meta.url);
const previewFixturesPath = new URL("../../src/app/dev/pilot-benefits-preview/pilot-benefit-fixtures.ts", import.meta.url);

test("pilot policy replaces 14 days with 30 and caps pre-payment free access at 60", () => {
  assert.equal(OWNER_PILOT_INITIAL_FREE_DAYS, 30);
  assert.equal(OWNER_PILOT_MIN_EXTENSION_DAYS, 3);
  assert.equal(OWNER_PILOT_MAX_FREE_DAYS, 60);
  assert.equal(validateOwnerPilotBenefitGrant({ kind: "initial", requestedDays: 30, currentTotalFreeDays: 0, paid: false }), null);
  assert.match(validateOwnerPilotBenefitGrant({ kind: "initial", requestedDays: 44, currentTotalFreeDays: 0, paid: false }) ?? "", /30일/);
  assert.equal(validateOwnerPilotBenefitGrant({ kind: "feedback_issue", requestedDays: 3, currentTotalFreeDays: 30, paid: false }), null);
  assert.match(validateOwnerPilotBenefitGrant({ kind: "feedback_issue", requestedDays: 2, currentTotalFreeDays: 30, paid: false }) ?? "", /3일 이상/);
  assert.match(validateOwnerPilotBenefitGrant({ kind: "feedback_issue", requestedDays: 31, currentTotalFreeDays: 30, paid: false }) ?? "", /총 60일/);
  assert.match(validateOwnerPilotBenefitGrant({ kind: "feedback_issue", requestedDays: 3, currentTotalFreeDays: 30, paid: true }) ?? "", /첫 결제 전/);
});

test("one logical grant keeps its idempotency key until success or intent change", () => {
  let created = 0;
  const createKey = () => `key-${++created}`;
  const intent = {
    userId: "owner-1",
    shopId: "shop-1",
    kind: "feedback_issue",
    days: 3,
    reason: "확인된 피드백",
  };
  const first = resolveOwnerPilotBenefitGrantAttempt(null, intent, createKey);
  const lostResponseRetry = resolveOwnerPilotBenefitGrantAttempt(first, { ...intent, reason: "  확인된 피드백  " }, createKey);
  const changedRequest = resolveOwnerPilotBenefitGrantAttempt(first, { ...intent, days: 4 }, createKey);
  const afterConfirmedSuccess = resolveOwnerPilotBenefitGrantAttempt(null, intent, createKey);

  assert.equal(first.idempotencyKey, "key-1");
  assert.equal(lostResponseRetry, first);
  assert.equal(changedRequest.idempotencyKey, "key-2");
  assert.equal(afterConfirmedSuccess.idempotencyKey, "key-3");
  assert.notEqual(
    resolveOwnerPilotBenefitGrantAttempt(first, { ...intent, shopId: "shop-2" }, createKey).idempotencyKey,
    first.idempotencyKey,
  );
});

test("pilot migration enforces exact tenant, payment, idempotency and cap boundaries atomically", async () => {
  const migration = await readFile(migrationPath, "utf8");
  assert.match(migration, /owner_pilot_benefit_claims/);
  assert.match(migration, /owner_pilot_benefit_grants/);
  assert.doesNotMatch(migration, /update public\.early_partner_benefit_claims|insert into public\.early_partner_benefit_grants/);
  assert.match(migration, /where user_id = p_user_id\s+and shop_id = p_shop_id\s+for update/);
  assert.match(migration, /owner_payment_ledger[\s\S]*user_id = p_user_id and shop_id = p_shop_id and status = 'PAID'/);
  assert.match(migration, /p_grant_kind = 'initial' and p_days <> 30/);
  assert.match(migration, /p_grant_kind = 'feedback_issue' and p_days < 3/);
  assert.match(migration, /v_claim\.total_free_days \+ p_days > 60/);
  assert.match(migration, /v_subscription\.trial_started_at \+ interval '30 days'/);
  assert.match(migration, /v_claim\.free_started_at \+ make_interval\(days => v_total_days\)/);
  assert.match(migration, /PM_PILOT_IDEMPOTENCY_CONFLICT/);
  assert.match(migration, /pg_advisory_xact_lock\(hashtext\(p_idempotency_key::text\)\)/);
  assert.match(migration, /v_existing\.created_by_admin_email <> lower\(trim\(p_admin_email\)\)/);
  const replayLock = migration.indexOf("perform pg_advisory_xact_lock");
  const replayLookup = migration.indexOf("where idempotency_key = p_idempotency_key", replayLock);
  const paidGuard = migration.indexOf("PM_PILOT_ALREADY_PAID", replayLookup);
  const capGuard = migration.indexOf("PM_PILOT_CAP_EXCEEDED", paidGuard);
  assert.ok(replayLock >= 0 && replayLookup > replayLock && paidGuard > replayLookup && capGuard > paidGuard);
  assert.match(migration, /security invoker[\s\S]*set search_path = ''/);
  assert.match(migration, /revoke execute[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /grant execute[\s\S]*to service_role/);
});

test("admin route and UI expose a confirmed source-only pilot grant path without raw database errors", async () => {
  const [server, route, screen, nav, landing, faq] = await Promise.all([
    readFile(serverPath, "utf8"),
    readFile(routePath, "utf8"),
    readFile(screenPath, "utf8"),
    readFile(navPath, "utf8"),
    readFile(landingPath, "utf8"),
    readFile(faqPath, "utf8"),
  ]);
  assert.match(server, /\.eq\("user_id", userId\)[\s\S]*\.eq\("shop_id", shopId\)/);
  assert.match(server, /grant_owner_pilot_pre_payment_benefit_v1/);
  const grantStart = server.indexOf("export async function grantOwnerPilotBenefit");
  const rpcStart = server.indexOf('admin.rpc("grant_owner_pilot_pre_payment_benefit_v1"', grantStart);
  const statusRefresh = server.indexOf("return getOwnerPilotBenefitStatus", rpcStart);
  assert.ok(grantStart >= 0 && rpcStart > grantStart && statusRefresh > rpcStart);
  assert.doesNotMatch(server.slice(grantStart, rpcStart), /getOwnerPilotBenefitStatus|current\.paid|current\.enrolled|remainingGrantableDays/);
  assert.doesNotMatch(server, /throw new OwnerPilotBenefitError\(result\.error\.message/);
  assert.match(route, /export async function GET[\s\S]*requireAdminSession\(request\)/);
  assert.match(route, /export async function POST[\s\S]*requireAdminSession\(request\)/);
  assert.match(route, /reason: z\.string\(\)\.trim\(\)\.min\(3\)\.max\(300\)/);
  assert.match(screen, /첫 결제 전 파일럿 대상과 지급 사유를 확인했습니다/);
  assert.match(screen, /disabled=\{grantDisabled\}/);
  assert.match(screen, /파일럿 30일 적용/);
  assert.match(screen, /한 건당 3일 이상 · 남은 한도/);
  assert.match(screen, /min-h-11/);
  assert.match(screen, /resolveOwnerPilotBenefitGrantAttempt\(grantAttemptRef\.current, intent/);
  assert.match(screen, /grantAttemptRef\.current = attempt/);
  assert.match(screen, /idempotencyKey: attempt\.idempotencyKey/);
  assert.match(screen, /grantAttemptRef\.current = null/);
  assert.match(nav, /href: "\/admin\/pilot-benefits"/);
  assert.match(landing, /일반 14일 대신 최초 시작일부터 총 30일/);
  assert.match(landing, /건당 3일 이상[\s\S]*최대 60일/);
  assert.match(faq, /일반 14일 대신 최초 시작일부터 총 30일/);
  assert.doesNotMatch(landing + faq, /첫 유료 결제 완료 후 30일|문제는 수준에 따라 7일 또는 14일/);
});

test("development-only DB-free preview renders every required status without an API path", async () => {
  const [page, fixtureSource, screen] = await Promise.all([
    readFile(previewPagePath, "utf8"),
    readFile(previewFixturesPath, "utf8"),
    readFile(screenPath, "utf8"),
  ]);

  assert.deepEqual(PILOT_BENEFIT_PREVIEW_STATES, [
    "initial",
    "extended",
    "cap",
    "paid",
    "schema-missing",
    "loading",
    "error",
  ]);
  const fixtures = Object.fromEntries(PILOT_BENEFIT_PREVIEW_STATES.map((state) => [state, buildPilotBenefitPreviewFixture(state)]));
  assert.equal(fixtures.initial.benefit.enrolled, false);
  assert.equal(fixtures.extended.benefit.totalFreeDays, 42);
  assert.equal(fixtures.cap.benefit.totalFreeDays, 60);
  assert.equal(fixtures.cap.benefit.remainingGrantableDays, 0);
  assert.equal(fixtures.paid.benefit.paid, true);
  assert.equal(fixtures["schema-missing"].benefit.schemaReady, false);
  assert.equal(fixtures.loading.viewState, "loading");
  assert.equal(fixtures.error.viewState, "error");

  assert.match(page, /process\.env\.NODE_ENV !== "development"\) notFound\(\)/);
  assert.match(page, /<AdminPilotBenefitScreen fixture=\{buildPilotBenefitPreviewFixture\(state\)\}/);
  assert.doesNotMatch(page + fixtureSource, /fetch\(|fetchApiJson|supabase|auth\.|\/api\//i);
  assert.equal((screen.match(/if \(fixture\) return;/g) ?? []).length, 1);
  assert.match(screen, /if \(fixture \|\| !selectedOwner\) return;/);
  assert.match(screen, /if \(fixture\) \{[\s\S]*개발용 화면에서는 조회하거나 지급하지 않습니다/);
  assert.match(screen, /Boolean\(fixture\) \|\| saving/);
  assert.match(screen, /개발용 예시 화면입니다\. 실제 조회나 지급은 실행되지 않습니다\./);
});
