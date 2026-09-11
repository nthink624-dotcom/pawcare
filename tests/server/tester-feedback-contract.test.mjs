import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  containsObviousSensitiveTesterFeedback,
  normalizeTesterFeedbackBody,
  resolveTesterAccessDisplayState,
  resolveTesterAccessNotice,
  testerFeedbackCategories,
  testerFeedbackScreenKeys,
  testerFeedbackStatuses,
} from "../../src/lib/tester-feedback.ts";

const migrationPath = new URL("../../supabase/migrations/20260908025208_tester_feedback_intake.sql", import.meta.url);
const hanmadiMigrationPath = new URL("../../supabase/migrations/20260909110000_hanmadi_shared_feedback_and_tester_access.sql", import.meta.url);
const ownerRoutePath = new URL("../../src/app/api/owner/tester-feedback/route.ts", import.meta.url);
const adminRoutePath = new URL("../../src/app/api/admin/tester-feedback/route.ts", import.meta.url);
const serverPath = new URL("../../src/server/tester-feedback.ts", import.meta.url);
const adminScreenPath = new URL("../../src/components/admin/admin-tester-feedback-screen.tsx", import.meta.url);
const previewPath = new URL("../../src/app/dev/tester-feedback-inbox-preview/page.tsx", import.meta.url);
const mediaServicePath = new URL("../../src/server/media-service.ts", import.meta.url);
const mediaClientPath = new URL("../../src/lib/media/owner-media-client.ts", import.meta.url);
const cohortServerPath = new URL("../../src/server/owner-pilot-cohort.ts", import.meta.url);

test("shared feedback input is normalized, allowlisted, and rejects obvious sensitive text", () => {
  assert.deepEqual(testerFeedbackCategories, ["inquiry", "improvement", "bug"]);
  assert.deepEqual(testerFeedbackStatuses, ["new", "reviewing", "resolved"]);
  assert.equal(testerFeedbackScreenKeys.includes("schedule"), true);
  assert.equal(testerFeedbackScreenKeys.includes("free_form_url"), false);
  assert.equal(normalizeTesterFeedbackBody("  저장이   안 돼요.\r\n\r\n\r\n 다시 확인해 주세요.  "), "저장이 안 돼요.\n\n다시 확인해 주세요.");
  for (const unsafe of [
    "customer@example.com 확인",
    "010-1234-5678 연락",
    "https://example.com/log",
    "Bearer: secret",
  ]) assert.equal(containsObviousSensitiveTesterFeedback(unsafe), true);
  assert.equal(containsObviousSensitiveTesterFeedback("예약 저장 후 목록이 갱신되지 않습니다."), false);
});

test("shared feedback migration keeps replay/rate protection while owner membership, not tester status, authorizes submit", async () => {
  const [base, migration] = await Promise.all([readFile(migrationPath, "utf8"), readFile(hanmadiMigrationPath, "utf8")]);
  assert.match(base, /create table if not exists public\.tester_feedback_submissions/);
  assert.match(migration, /category in \('inquiry', 'improvement', 'bug'\)/);
  assert.match(migration, /char_length\(body\) between 2 and 2000/);
  assert.match(migration, /create or replace function public\.submit_hanmadi_feedback_v1/);
  const submit = migration.slice(migration.indexOf("create or replace function public.submit_hanmadi_feedback_v1"), migration.indexOf("create or replace function public.decide_hanmadi_tester_access_v1"));
  assert.match(submit, /owner_shop_memberships membership[\s\S]*membership\.role = 'owner'/);
  const authorization = submit.slice(submit.indexOf("if not exists ("), submit.indexOf("if p_screenshot_media_asset_id"));
  assert.doesNotMatch(authorization, /owner_pilot_cohort_memberships/);
  const replay = submit.indexOf("submission.request_id = p_request_id");
  const membership = submit.indexOf("owner_shop_memberships membership", replay);
  const rateLimit = submit.indexOf("interval '1 hour'", membership);
  const insert = submit.indexOf("insert into public.tester_feedback_submissions", rateLimit);
  assert.ok(replay >= 0 && membership > replay && rateLimit > membership && insert > rateLimit);
  assert.match(submit, /content_fingerprint = v_content_fingerprint[\s\S]*interval '10 minutes'/);
  assert.match(submit, />= 5 or \([\s\S]*interval '24 hours'[\s\S]*>= 20/);
  assert.match(migration, /revoke all on function public\.submit_hanmadi_feedback_v1[\s\S]*from public, anon, authenticated/);
});

test("owner endpoint is strict, owner-and-shop bound, mobile CORS aware, and accepts only explicit screenshot consent", async () => {
  const route = await readFile(ownerRoutePath, "utf8");
  assert.match(route, /requestSchema = z\.object\([\s\S]*requestId: z\.string\(\)\.uuid\(\)[\s\S]*category: z\.enum\(testerFeedbackCategories\)[\s\S]*body:[\s\S]*screenKey: z\.enum\(testerFeedbackScreenKeys\)[\s\S]*appVersion:[\s\S]*\)\.strict\(\)/);
  assert.match(route, /requireOwnerShop\(request, parsed\.shopId\)/);
  assert.match(route, /owner\.role !== "owner"/);
  assert.match(route, /ownerUserId: owner\.userId[\s\S]*shopId: owner\.shopId/);
  assert.match(route, /containsObviousSensitiveTesterFeedback/);
  assert.match(route, /ownerMobileCorsPreflight/);
  assert.match(route, /screenshot:[\s\S]*mediaAssetId: z\.string\(\)\.uuid\(\)[\s\S]*contentType: z\.enum\(testerFeedbackScreenshotContentTypes\)[\s\S]*consent: z\.literal\(true\)/);
  assert.doesNotMatch(route, /guardianId|petId|appointmentId|audio|device|rawLog|freeFormUrl/);
});

test("server returns a compact mobile acknowledgement and admin list without raw owner identity", async () => {
  const server = await readFile(serverPath, "utf8");
  assert.match(server, /admin\.rpc\("submit_hanmadi_feedback_v1"/);
  assert.match(server, /replayed: row\.replayed === true/);
  const acknowledgement = server.slice(server.indexOf("feedback: {"), server.indexOf("replayed: row.replayed"));
  assert.doesNotMatch(acknowledgement, /body|shopId|ownerUserId|requestId|fingerprint/);
  assert.match(server, /tester_feedback_submissions[\s\S]*order\("created_at", \{ ascending: false \}\)/);
  const publicProjection = server.slice(server.indexOf("function mapRow"), server.indexOf("export async function submitTesterFeedback"));
  assert.doesNotMatch(publicProjection, /ownerUserId|phoneNumber|email|loginId/);
  assert.match(server, /owner_pilot_cohort_memberships[\s\S]*map\.set\(`\$\{row\.shop_id\}:\$\{row\.owner_user_id\}`/);
});

test("screenshot receipt is canonical, private, bounded, tenant-bound, and hard-purged exactly", async () => {
  const [migration, server, mediaService, mediaClient] = await Promise.all([
    readFile(hanmadiMigrationPath, "utf8"),
    readFile(serverPath, "utf8"),
    readFile(mediaServicePath, "utf8"),
    readFile(mediaClientPath, "utf8"),
  ]);
  assert.match(migration, /feedback_screenshot/);
  assert.match(migration, /screenshot_byte_size between 1 and 5242880/);
  assert.match(migration, /media\.shop_id = p_shop_id[\s\S]*media\.uploaded_by_user_id = p_owner_user_id[\s\S]*media\.visibility = 'private'[\s\S]*media\.status = 'ready'/);
  assert.match(migration, /screenshot_receipt_fingerprint/);
  assert.match(mediaService, /"feedback_screenshot"/);
  assert.match(mediaClient, /mediaKind === "price_guide_source" \|\| mediaKind === "feedback_screenshot"[\s\S]*\? "private"/);
  assert.match(server, /removeMediaStorageObjects[\s\S]*verifyMediaStorageObjectsAbsent[\s\S]*media_variants[\s\S]*media_assets/);
  assert.doesNotMatch(migration, /guardian_id|pet_id|appointment_id|raw_device|raw_log|free_form_url/);
});

test("tester period is projected without automatic cancellation or payment and produces stable D-3/D0/3-day notices", async () => {
  const migration = await readFile(hanmadiMigrationPath, "utf8");
  const decision = migration.slice(migration.indexOf("create or replace function public.decide_hanmadi_tester_access_v1"));
  assert.match(decision, /p_action not in \('extend_3_days', 'end', 'convert'\)/);
  assert.match(decision, /interval '3 days'/);
  assert.match(decision, /tester_access_decision_state = v_after_state/);
  assert.doesNotMatch(decision, /owner_subscriptions[\s\S]*(update|delete)|owner_payment_ledger[\s\S]*(insert|update|delete)/i);
  const due = "2026-09-12T00:00:00.000Z";
  assert.deepEqual(resolveTesterAccessNotice({ isTester: true, decisionState: "pending", reviewDueAt: due, cohortPosition: 4, now: "2026-09-09T00:00:00.000Z" }), {
    noticeKey: "tester-review:4:2026-09-12:d-3",
    noticeLabel: "테스트 기간 결정을 3일 뒤 확인해 주세요.",
  });
  const day0 = resolveTesterAccessNotice({ isTester: true, decisionState: "pending", reviewDueAt: due, cohortPosition: 4, now: due });
  const day3 = resolveTesterAccessNotice({ isTester: true, decisionState: "pending", reviewDueAt: due, cohortPosition: 4, now: "2026-09-15T00:00:00.000Z" });
  assert.equal(day0.noticeKey, "tester-review:4:2026-09-12:d+0");
  assert.equal(day3.noticeKey, "tester-review:4:2026-09-12:d+3");
  assert.equal(resolveTesterAccessDisplayState({ isTester: true, decisionState: "pending", reviewDueAt: due, now: due }), "awaiting_owner_decision");
  assert.equal(resolveTesterAccessDisplayState({ isTester: true, decisionState: "ended", reviewDueAt: due, now: due }), "ended");
});

test("admin feedback hub requires admin auth and keeps filters, tester emphasis, decisions, and 44px actions in one white plane", async () => {
  const [route, screen, preview] = await Promise.all([
    readFile(adminRoutePath, "utf8"),
    readFile(adminScreenPath, "utf8"),
    readFile(previewPath, "utf8"),
  ]);
  assert.match(route, /requireAdminSession\(request\)/);
  assert.match(route, /testerFeedbackCategories\.find/);
  assert.match(route, /testerFeedbackStatuses\.find/);
  assert.match(screen, /AdminSectionNav active="testerFeedback"/);
  assert.match(screen, />피드백 허브</);
  assert.match(screen, /테스트 멤버/);
  assert.match(screen, /3일 연장/);
  assert.match(screen, /유료 전환 확인/);
  assert.match(screen, /완전히 삭제/);
  assert.match(screen, /min-h-11/g);
  assert.match(screen, /categoryFilter[\s\S]*statusFilter/);
  assert.match(screen, /bg-\[#B98121\]/);
  assert.equal((screen.match(/bg-\[#B98121\]/g) ?? []).length, 1);
  assert.doesNotMatch(screen, /font-bold|font-extrabold|font-black|text-\[(?:10|11|15|17|19)px\]/);
  assert.match(preview, /process\.env\.NODE_ENV !== "development"/);
  assert.match(preview, /<AdminTesterFeedbackScreen initialFeedback=\{FIXTURE\}/);
  assert.doesNotMatch(preview, /fetch\(|supabase|auth|api\//i);
});

test("shared cohort projection exposes one server authority without changing billing status", async () => {
  const server = await readFile(cohortServerPath, "utf8");
  assert.match(server, /tester_access_decision_state,tester_access_review_due_at/);
  assert.match(server, /accessAllowed: accessSchemaReady && isPilotMember && displayState !== "ended" && displayState !== "converted"/);
  assert.doesNotMatch(server, /owner_subscriptions[\s\S]*update|subscription_status[\s\S]*=/);
});
