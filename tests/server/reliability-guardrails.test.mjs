import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readProjectFile(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("the database overlap guard remains transaction-serialized", () => {
  const migration = readProjectFile(
    "supabase/migrations/20260803145206_serialize_staff_appointment_overlap_checks.sql",
  );

  assert.match(migration, /prevent_overlapping_staff_appointments/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /'confirmed', 'in_progress', 'almost_done'/);
  assert.match(migration, /errcode = '23P01'/);
});

test("customer reservations stay immediate-confirmed without a pending approval flow", () => {
  const domain = readProjectFile("src/types/domain.ts");
  const ownerMutations = readProjectFile("src/server/owner-mutations.ts");
  const removalMigration = readProjectFile(
    "supabase/migrations/202606300001_remove_reservation_pending_flow.sql",
  );

  assert.doesNotMatch(domain, /export type AppointmentStatus =[\s\S]{0,240}\| "pending"/);
  assert.match(ownerMutations, /const status = "confirmed";/);
  assert.match(ownerMutations, /approval_mode: "auto" as const/);
  assert.match(removalMigration, /where status = 'pending'/);
  assert.match(removalMigration, /check \(status in \('confirmed', 'in_progress', 'almost_done'/);
  assert.doesNotMatch(removalMigration, /check \(status in \('pending'/);
});

test("Supabase development and production identities stay explicit", () => {
  const agents = readProjectFile("AGENTS.md");
  const environmentGuide = readProjectFile("docs/supabase-environment-separation.md");
  const releaseChecklist = readProjectFile("docs/release-checklist.md");
  const gitignore = readProjectFile(".gitignore");
  const operatingRules = `${agents}\n${environmentGuide}\n${releaseChecklist}`;

  assert.match(operatingRules, /Development:[^\n]*qefxdtmdtvnzgupmjlom/);
  assert.match(operatingRules, /Production:[^\n]*ysxykikqnneuhypybjry/);
  assert.match(environmentGuide, /https:\/\/qefxdtmdtvnzgupmjlom\.supabase\.co/);
  assert.match(environmentGuide, /https:\/\/ysxykikqnneuhypybjry\.supabase\.co/);
  assert.doesNotMatch(operatingRules, /Do not (?:use or maintain|operate) a separate Supabase Dev project/);
  assert.match(gitignore, /supabase\/\*\*\/\.temp\//);
});

test("photo list surfaces keep using the batch signed URL client", () => {
  const mediaPanel = readProjectFile("src/components/owner-web/media-upload-panel.tsx");
  const settingsScreen = readProjectFile("src/components/owner-web/settings-management-screen.tsx");

  assert.match(mediaPanel, /getOwnerMediaSignedUrls/);
  assert.doesNotMatch(mediaPanel, /\/api\/owner\/media\/signed-url\?/);
  assert.match(settingsScreen, /getOwnerMediaSignedUrls/);
});

test("the owner application retains a route error recovery boundary", () => {
  const errorBoundary = readProjectFile("src/app/error.tsx");

  assert.match(errorBoundary, /reset/);
  assert.match(errorBoundary, /관리자 메인/);
  assert.match(errorBoundary, /\[petmanager-ui\]/);
});

test("grooming outcomes stay linked to required photos, customer results, and revenue", () => {
  const ownerMutations = readProjectFile("src/server/owner-mutations.ts");
  const tokenContract = readProjectFile("src/server/booking-access-token.ts");
  const notificationDispatch = readProjectFile("src/server/notification-dispatch.ts");
  const resultCard = readProjectFile("src/components/customer/customer-grooming-result-card.tsx");
  const mediaService = readProjectFile("src/server/media-service.ts");
  const migration = readProjectFile(
    "supabase/migrations/20260803162637_grooming_record_outcomes.sql",
  );

  assert.match(ownerMutations, /requiresStartPhoto = params\.status === "in_progress"/);
  assert.match(ownerMutations, /params\.status === "almost_done"/);
  assert.match(ownerMutations, /final_service_price \?\? service\?\.price/);
  assert.match(ownerMutations, /actual_duration_minutes: getActualGroomingDurationMinutes/);
  assert.match(ownerMutations, /next_recommended_visit_date/);
  assert.match(tokenContract, /"reschedule" \| "result"/);
  assert.match(notificationDispatch, /isGroomingResult \? "result"/);
  assert.match(notificationDispatch, /24 \* 365/);
  assert.match(resultCard, /앱 설치나 회원가입 없이/);
  assert.match(mediaService, /payload\.action !== "result"/);
  assert.match(mediaService, /\.eq\("appointment_id", payload\.appointmentId\)/);
  assert.match(migration, /create trigger grooming_records_sync_revenue/);
  assert.match(migration, /actual_duration_minutes/);
  assert.match(migration, /next_recommended_visit_date/);
});

test("grooming notes keep a private autosaved draft without delaying photo completion", () => {
  const draftHook = readProjectFile("src/components/owner-web/use-grooming-record-draft.ts");
  const draftRoute = readProjectFile("src/app/api/owner/grooming-record-drafts/route.ts");
  const completionFields = readProjectFile("src/components/owner-web/calendar-grooming-completion-fields.tsx");
  const calendar = readProjectFile("src/components/owner-web/calendar-management-screen.tsx");
  const mediaClient = readProjectFile("src/lib/media/owner-media-client.ts");
  const resultCard = readProjectFile("src/components/customer/customer-grooming-result-card.tsx");
  const migration = readProjectFile(
    "supabase/migrations/20260804030815_grooming_record_drafts_and_internal_notes.sql",
  );

  assert.match(draftHook, /window\.localStorage\.setItem/);
  assert.match(draftHook, /AUTOSAVE_DELAY_MS = 900/);
  assert.match(draftHook, /chooseNewestGroomingDraft/);
  assert.match(draftRoute, /requireOwnerShop/);
  assert.match(draftRoute, /본인 담당 예약의 미용 기록만 작성할 수 있습니다/);
  assert.match(completionFields, /매장 내부 메모/);
  assert.match(completionFields, /고객 비공개/);
  assert.match(calendar, /providerReadyMode: "background"/);
  assert.match(mediaClient, /Delivery falls back to the optimized original/);
  assert.doesNotMatch(resultCard, /internal_memo/);
  assert.match(migration, /grooming_record_drafts/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on table public\.grooming_record_drafts from anon, authenticated/);
});

test("profitability remains tied to timing snapshots and one revenue row", () => {
  const analytics = readProjectFile("src/server/profitability-analytics.ts");
  const migration = readProjectFile(
    "supabase/migrations/20260803172356_profitability_and_external_data_imports.sql",
  );

  assert.match(analytics, /actual_duration_minutes/);
  assert.match(analytics, /expected_duration_minutes/);
  assert.match(analytics, /shop_revenue_entries/);
  assert.match(analytics, /MIN_RECOMMENDATION_SAMPLE_SIZE = 3/);
  assert.match(migration, /pet_breed_snapshot/);
  assert.match(migration, /pet_weight_snapshot/);
  assert.match(migration, /original_price/);
  assert.match(migration, /discount_amount/);
  assert.doesNotMatch(migration, /security definer/i);
});

test("external imports retain preview, idempotency, and private audit boundaries", () => {
  const route = readProjectFile("src/app/api/owner/data-import/route.ts");
  const commit = readProjectFile("src/server/data-import-commit.ts");
  const migration = readProjectFile(
    "supabase/migrations/20260803172356_profitability_and_external_data_imports.sql",
  );

  assert.match(route, /mode === "commit"/);
  assert.match(route, /MAX_IMPORT_FILE_BYTES/);
  assert.match(commit, /file_sha256/);
  assert.match(commit, /external_record_key/);
  assert.match(commit, /is_active: false/);
  assert.match(migration, /unique \(shop_id, source, file_sha256\)/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on table public\.shop_data_import_batches from anon, authenticated/);
  assert.doesNotMatch(migration, /raw_row|raw_file|file_contents/);
});

test("landing pricing stays transparent and sells saved time instead of a price war", () => {
  const conversion = readProjectFile("src/components/landing/landing-conversion-sections.tsx");
  const primary = readProjectFile("src/components/landing/landing-primary-sections.tsx");
  const landing = `${conversion}\n${primary}`;

  assert.match(landing, /홈페이지에 요금 공개/);
  assert.match(landing, /카드 없는 14일 체험/);
  assert.match(landing, /설치비 0원/);
  assert.match(landing, /해지 방법 공개/);
  assert.match(landing, /기존 데이터 이전 지원/);
  assert.match(landing, /보호자에게 광고 없음/);
  assert.match(landing, /하루 예약 문의 3건만 줄여도/);
  assert.doesNotMatch(landing, /티피보다.*(?:싸|저렴)/);
});
