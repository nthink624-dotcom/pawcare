import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function readProjectFile(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("local preview refuses stale builds instead of serving an older landing", () => {
  const startScript = readProjectFile("scripts/start-local-server.ps1");

  assert.match(
    startScript,
    /if \(-not \$Dev\) \{\s+npm\.cmd run build\s+if \(\$LASTEXITCODE -ne 0\)/,
  );
  assert.match(startScript, /older \.next build cannot be served/);
});

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
  const gitignoreUrl = new URL("../../.gitignore", import.meta.url);
  const gitignore = existsSync(gitignoreUrl) ? readFileSync(gitignoreUrl, "utf8") : null;
  const operatingRules = `${agents}\n${environmentGuide}\n${releaseChecklist}`;

  assert.match(operatingRules, /Development:[^\n]*qefxdtmdtvnzgupmjlom/);
  assert.match(operatingRules, /Production:[^\n]*ysxykikqnneuhypybjry/);
  assert.match(environmentGuide, /https:\/\/qefxdtmdtvnzgupmjlom\.supabase\.co/);
  assert.match(environmentGuide, /https:\/\/ysxykikqnneuhypybjry\.supabase\.co/);
  assert.doesNotMatch(operatingRules, /Do not (?:use or maintain|operate) a separate Supabase Dev project/);
  if (gitignore !== null) {
    assert.match(gitignore, /supabase\/\*\*\/\.temp\//);
  } else {
    assert.equal(
      process.env.VERCEL,
      "1",
      ".gitignore may only be absent from Vercel's filtered deployment bundle",
    );
  }
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

test("grooming outcomes keep photos optional while preserving customer results and revenue", () => {
  const ownerMutations = readProjectFile("src/server/owner-mutations.ts");
  const ownerCalendar = readProjectFile("src/components/owner-web/calendar-management-screen.tsx");
  const tokenContract = readProjectFile("src/server/booking-access-token.ts");
  const notificationDispatch = readProjectFile("src/server/notification-dispatch.ts");
  const resultCard = readProjectFile("src/components/customer/customer-grooming-result-card.tsx");
  const mediaService = readProjectFile("src/server/media-service.ts");
  const migration = readProjectFile(
    "supabase/migrations/20260803162637_grooming_record_outcomes.sql",
  );

  assert.doesNotMatch(ownerMutations, /requiresStartPhoto/);
  assert.doesNotMatch(ownerMutations, /assertPhotoRequirementForAppointmentStatus/);
  assert.doesNotMatch(ownerMutations, /getRequiredStatusMediaKind/);
  assert.doesNotMatch(ownerCalendar, /사진은 완료할 때 등록/);
  assert.doesNotMatch(ownerCalendar, /사진 없이 바로 시작/);
  assert.doesNotMatch(ownerCalendar, /미용 완료 사진을 먼저 선택해 주세요/);
  assert.doesNotMatch(ownerCalendar, /AI 케어리포트 내용을 확인 완료해 주세요/);
  assert.match(ownerCalendar, /미용 전 사진 · 선택/);
  assert.match(ownerCalendar, /미용 후 사진 · 선택/);
  assert.match(ownerCalendar, /케어리포트는 선택 사항이며 나중에 작성해도 됩니다/);
  assert.match(ownerMutations, /final_service_price \?\? service\?\.price/);
  assert.match(ownerMutations, /actual_duration_minutes: getActualGroomingDurationMinutes/);
  assert.match(ownerMutations, /next_recommended_visit_date/);
  assert.match(tokenContract, /"reschedule" \| "result"/);
  assert.match(notificationDispatch, /isGroomingResult\s*\?\s*"result"/);
  assert.match(notificationDispatch, /24 \* 365/);
  assert.match(resultCard, /앱 설치나 회원가입 없이/);
  assert.match(resultCard, /케어리포트 작성 중/);
  assert.match(resultCard, /다시 확인하기/);
  assert.match(mediaService, /payload\.action !== "result"/);
  assert.match(mediaService, /\.eq\("appointment_id", payload\.appointmentId\)/);
  assert.match(migration, /create trigger grooming_records_sync_revenue/);
  assert.match(migration, /actual_duration_minutes/);
  assert.match(migration, /next_recommended_visit_date/);
});

test("an early-started future booking remains on its scheduled date after refresh", () => {
  const ownerCalendar = readProjectFile("src/components/owner-web/calendar-management-screen.tsx");

  assert.match(
    ownerCalendar,
    /appointment\.appointment_date !== selectedDate &&\s+actualStart &&\s+\["in_progress", "almost_done", "completed"\]\.includes\(appointment\.status\) &&\s+!actualWindow/,
  );
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
  assert.match(landing, /하루 30분만 예약 응대를 덜 해도/);
  assert.doesNotMatch(landing, /티피보다.*(?:싸|저렴)/);
});

test("customer booking dates show four days and derive the nearest available date from real slots", () => {
  const bookingPage = readProjectFile("src/components/customer/customer-booking-page.tsx");
  const bookingFlow = readProjectFile("src/components/customer/customer-first-visit-claude-flow.tsx");
  const availabilityRoute = readProjectFile("src/app/api/availability/route.ts");

  assert.match(bookingPage, /dateOptions\.slice\(0, 15\)/);
  assert.match(bookingPage, /summaryOnly: true/);
  assert.match(bookingFlow, /calc\(\(100% - 24px\) \/ 4\)/);
  assert.match(bookingFlow, /scroll-snap-type:x mandatory/);
  assert.match(bookingFlow, /예약 가능한 시간이 없어요/);
  assert.match(bookingFlow, /isEarliestAvailable \? <span className="avail">예약 가능<\/span>/);
  assert.match(availabilityRoute, /searchParams\.get\("summary"\) === "1"/);
  assert.match(availabilityRoute, /customerVisibleSlots\.slice\(0, 1\)/);
});

test("the customer entry service selection is carried into booking without a duplicate service step", () => {
  const entryPage = readProjectFile("src/components/customer/customer-booking-entry-page.tsx");
  const servicePicker = readProjectFile("src/components/customer/customer-entry-service-picker.tsx");
  const bookingPage = readProjectFile("src/components/customer/customer-booking-page.tsx");

  assert.match(servicePicker, /role="radiogroup"/);
  assert.match(servicePicker, /aria-checked=\{selected\}/);
  assert.match(entryPage, /serviceId=\$\{encodeURIComponent\(service\.serviceId\)\}/);
  assert.match(entryPage, /serviceOptionId=\$\{encodeURIComponent\(service\.id\)\}/);
  assert.match(entryPage, /서비스를 선택해 주세요/);
  assert.match(bookingPage, /firstVisitStep === 1 && serviceSelectedBeforeFlow/);
  assert.match(bookingPage, /setFirstVisitStep\(3\)/);
  assert.match(bookingPage, /firstVisitStep === 3 && serviceSelectedBeforeFlow/);
});

test("customer bookings keep the canonical service and snapshot the selected price-guide option", () => {
  const customerBookings = readProjectFile("src/server/customer-bookings.ts");
  const appointmentSchema = readProjectFile("src/server/schemas.ts");
  const ownerMutations = readProjectFile("src/server/owner-mutations.ts");
  const resultCard = readProjectFile("src/components/customer/customer-grooming-result-card.tsx");

  assert.doesNotMatch(customerBookings, /customer-booking-\$\{randomUUID\(\)\}/);
  assert.doesNotMatch(customerBookings, /createAppointment, upsertService/);
  assert.match(customerBookings, /selectedCustomerServiceOption\?\.serviceId \?\? payload\.serviceId/);
  assert.match(customerBookings, /durationMinutes: selectedCustomerServiceOption\?\.durationMinutes/);
  assert.match(customerBookings, /customerServiceOptionName:/);
  assert.match(customerBookings, /customerServiceOptionDurationMinutes:/);
  assert.match(appointmentSchema, /durationMinutes: z\.coerce\.number\(\)\.int\(\)\.min\(15\)/);
  assert.match(ownerMutations, /durationMinutesOverride: durationMinutes/);
  assert.match(ownerMutations, /buildAppointmentWindow\(payload\.appointmentDate, payload\.appointmentTime, durationMinutes\)/);
  assert.match(resultCard, /serviceOptionId: getRebookingServiceOptionId\(appointment\)/);
});

test("personalized rebooking links restore the exact guardian and pet without phone-only merging", () => {
  const tokenContract = readProjectFile("src/server/booking-access-token.ts");
  const rebookingRoute = readProjectFile("src/app/api/customer-rebooking-link/route.ts");
  const bookingEntry = readProjectFile("src/app/book/[shopId]/page.tsx");
  const bookingPage = readProjectFile("src/components/customer/customer-booking-page.tsx");
  const customerBookings = readProjectFile("src/server/customer-bookings.ts");
  const resultCard = readProjectFile("src/components/customer/customer-grooming-result-card.tsx");
  const notificationDispatch = readProjectFile("src/server/notification-dispatch.ts");

  assert.match(tokenContract, /REBOOKING_ACCESS_TOKEN_HOURS = 0\.5/);
  assert.match(tokenContract, /source\.action !== "result" && source\.action !== "rebook_source"/);
  assert.match(tokenContract, /action: "rebook"/);
  assert.match(rebookingRoute, /exchangeBookingAccessTokenForRebooking/);
  assert.match(rebookingRoute, /experience: "revisit", t: rebookingToken/);
  assert.match(bookingEntry, /access\.action === "rebook"/);
  assert.match(bookingEntry, /initialBookingProfile=\{initialBookingProfile\}/);
  assert.match(bookingPage, /rebookingAccessToken: initialAccessToken \?\? ""/);
  assert.match(bookingPage, /rebookingPetId: initialAccessToken \? selectedRebookingPetId : ""/);
  assert.match(customerBookings, /access\.shopId !== payload\.shopId \|\| access\.action !== "rebook"/);
  assert.doesNotMatch(customerBookings, /phoneOnlyActiveGuardian/);
  assert.match(resultCard, /\/api\/customer-rebooking-link/);
  assert.match(notificationDispatch, /isRevisitNotice && bookingAccessToken/);
  assert.match(notificationDispatch, /buildPersonalizedRebookingSourceUrl\(input\.shopId, bookingAccessToken\)/);
});

test("customer reservation management requires an appointment-scoped signed link", () => {
  const tokenContract = readProjectFile("src/server/booking-access-token.ts");
  const customerLookupRoute = readProjectFile("src/app/api/customer-lookup/route.ts");
  const customerBookings = readProjectFile("src/server/customer-bookings.ts");
  const managePanel = readProjectFile("src/components/customer/customer-booking-manage-panel.tsx");
  const recoveryRoute = readProjectFile("src/app/api/customer-booking-access-link/route.ts");
  const recoveryService = readProjectFile("src/server/customer-booking-access-recovery.ts");
  const bookingPage = readProjectFile("src/components/customer/customer-booking-page.tsx");

  assert.match(tokenContract, /action\?: "manage" \| "reschedule"/);
  assert.match(tokenContract, /payload\.action === "manage"[\s\S]*!payload\.appointmentId/);
  assert.match(customerBookings, /accessToken: z\.string\(\)\.trim\(\)\.min\(1\)/);
  assert.match(customerBookings, /access\.appointmentId !== payload\.appointmentId/);
  assert.doesNotMatch(customerBookings, /export async function lookupCustomerBookings\(/);
  assert.doesNotMatch(customerBookings, /export async function lookupCustomerBookingProfile\(/);
  assert.match(customerLookupRoute, /if \(!token\)/);
  assert.doesNotMatch(customerLookupRoute, /searchParams\.get\("guardianName"\)/);
  assert.match(managePanel, /accessToken: initialAccessToken/);
  assert.match(managePanel, /\/api\/customer-booking-access-link/);
  assert.doesNotMatch(managePanel, /보호자 이름 입력/);
  assert.doesNotMatch(managePanel, /반려동물 이름 입력/);
  assert.match(recoveryRoute, /NEUTRAL_MESSAGE/);
  assert.match(recoveryRoute, /"Retry-After": "900"/);
  assert.match(recoveryService, /PHONE_REQUEST_LIMIT = 3/);
  assert.match(recoveryService, /IP_REQUEST_LIMIT = 10/);
  assert.match(recoveryService, /type: "booking_manage_link_requested"/);
  assert.doesNotMatch(bookingPage, /profile: "1"/);
});
