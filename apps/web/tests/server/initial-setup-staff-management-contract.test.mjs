import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("staff setup uses a responsive one-row header and left-aligned three-step rail", async () => {
  const guide = await source("src/components/owner-web/owner-initial-setup-guide.tsx");
  assert.match(guide, /key: "staff", label: "직원 관리", railLabel: "직원 관리"/);
  assert.equal([...guide.matchAll(/\{ key: "(?:hours|staff|pricing)"/g)].length, 3);
  assert.match(guide, /items-center justify-start gap-2\.5[^\n]+text-left/);
  assert.match(guide, /data-testid="owner-initial-setup-title-row"/);
  assert.match(guide, /className="flex min-w-0 flex-wrap items-center gap-2"/);
  assert.match(guide, /flex-1 basis-\[160px\]/);
  assert.match(guide, /data-testid="owner-initial-setup-title-actions"/);
  assert.match(guide, /w-full flex-wrap items-center justify-end gap-1 sm:w-auto sm:flex-1/);
  assert.doesNotMatch(guide, /data-testid="owner-initial-setup-action-row"/);
  assert.match(guide, /data-testid="owner-initial-setup-header-actions"/);
  assert.doesNotMatch(guide, /mt-3 flex min-h-11 min-w-0 justify-end empty:hidden/);
  assert.match(guide, /저장하고 나중에[\s\S]*data-testid="owner-initial-setup-header-actions"[\s\S]*초기 설정 닫기/);
  assert.match(guide, /\{previousItem \? \([\s\S]*?onClick=\{\(\) => onNavigate\(previousItem\.screen\)\}[\s\S]*?aria-label="이전 단계로"[\s\S]*?\) : null\}/);
  assert.equal([...guide.matchAll(/whitespace-nowrap/g)].length >= 3, true);
  assert.match(guide, /id="owner-initial-setup-title"[\s\S]*?\[overflow-wrap:anywhere\][^"\n]*\[word-break:keep-all\]/);
  assert.doesNotMatch(guide, /grid-cols-\[minmax\(0,1fr\)_auto\]|absolute left-1\/2 top-1\/2|truncate/);
  assert.doesNotMatch(guide, /직원·근무시간/);
});

test("staff setup keeps explicit Save and Next actions independent", async () => {
  const [panel, screen, preview] = await Promise.all([
    source("src/components/owner-web/initial-setup-staff-management-panel.tsx"),
    source("src/components/owner-web/staff-management-screen.tsx"),
    source("src/components/owner-web/owner-web-preview.tsx"),
  ]);
  assert.match(panel, /<OwnerInitialSetupSaveNextActions onSave=\{onSave\} onNext=\{onNext\} saving=\{isSaving\} \/>/);
  assert.doesNotMatch(panel, /저장하고 다음/);
  assert.match(screen, /onSave=\{saveInitialSetupStaff\}/);
  assert.match(screen, /onNext=\{\(\) => onInitialSetupNext\?\.\(\)\}/);
  const saveHandlerStart = preview.indexOf("function handleInitialSetupStepSaved");
  const saveHandlerEnd = preview.indexOf("\n  function handleInitialSetupHoursNext", saveHandlerStart);
  assert.doesNotMatch(preview.slice(saveHandlerStart, saveHandlerEnd), /setInitialSetupScreen/);
  assert.match(preview, /function handleInitialSetupStaffNext\(\) \{[\s\S]*?getBootstrapOwnerInitialSetupReadiness\(ownerDataRef\.current\)\.steps\.staff[\s\S]*?setInitialSetupScreen\("services"\)/);
});

test("staff setup persists honest session drafts, optional contact, and schedule fields", async () => {
  const [panel, screen, model, preview] = await Promise.all([
    source("src/components/owner-web/initial-setup-staff-management-panel.tsx"),
    source("src/components/owner-web/staff-management-screen.tsx"),
    source("src/components/owner-web/staff-management-model.ts"),
    source("src/components/owner-web/owner-web-preview.tsx"),
  ]);
  assert.match(panel, /연락처 \(선택\)/);
  assert.match(panel, /formatInitialSetupStaffPhone/);
  assert.match(panel, /저장하지 않은 변경사항이 있습니다/);
  assert.match(panel, /저장된 직원 정보입니다/);
  assert.match(panel, /\{name\} \/ \{staffRole\(staffMember, ownerStaffId\)\}/);
  assert.doesNotMatch(panel.match(/<section[^>]+aria-label="직원 목록"[\s\S]*?<\/section>/)?.[0] ?? "", /phone|연락처/);
  assert.match(screen, /persistInitialSetupStaffDraft/);
  assert.match(screen, /onPhotoUploadPending:[\s\S]*pendingUpload/);
  assert.match(screen, /syncInitialSetupSession\(currentDraft, photoForRetry, "error"\)/);
  assert.match(model, /photo\.pendingUpload \?\? null/);
  assert.match(model, /onPhotoUploadPending\?\.\(pendingUpload\)/);
  assert.match(preview, /const refreshed = await fetchApiJsonWithAuth<BootstrapPayload>\([\s\S]*?phase=essential[\s\S]*?\{ cache: "no-store" \}[\s\S]*?setLiveStaffMembers\(refreshed\.staffMembers\)[\s\S]*?applyOwnerData\(refreshed\)/);
  assert.doesNotMatch(preview, /setLiveStaffMembers\(nextStaff\)/);
  assert.match(model, /phone: draft\.phone\.trim\(\)/);
  assert.match(model, /defaultDays: nextDays/);
  assert.match(model, /startTime: draft\.startTime/);
  assert.match(model, /endTime: draft\.endTime/);
  assert.match(preview, /useState<InitialSetupStaffSessionDraft \| null>/);
  assert.equal([...panel.matchAll(/min-h-11/g)].length >= 5, true);
});

test("DB-free fixture saves staff locally but Next alone never saves", async () => {
  const [fixture, client] = await Promise.all([
    source("src/app/dev/initial-setup-guide-preview/initial-setup-fixture-form.tsx"),
    source("src/app/dev/initial-setup-guide-preview/initial-setup-guide-preview-client.tsx"),
  ]);
  assert.match(fixture, /fixture-staff-profile-/);
  assert.match(fixture, /DB·Storage 호출 없음/);
  assert.match(fixture, /window\.sessionStorage\.setItem\(FIXTURE_STAFF_STORAGE_KEY/);
  assert.match(fixture, /window\.sessionStorage\.getItem\(FIXTURE_STAFF_STORAGE_KEY/);
  assert.match(fixture, /onSave=\{saveFixtureStaff\}/);
  assert.match(fixture, /onNext=\{\(\) => onStaffNext\?\.\(\)\}/);
  assert.doesNotMatch(fixture, /fetch\(|fetchApiJsonWithAuth|createOwnerStaffProfileImageFromFile/);
  assert.match(client, /name: "대표자"/);
  assert.match(client, /role: "대표"/);
  assert.match(client, /저장 여부와 관계없이 서비스·가격 단계로 이동했습니다/);
});
