import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [page, fixture, sheet] = await Promise.all([
  readFile(new URL("../src/app/dev/care-report-preview/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/owner/owner-care-report-dev-preview.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/owner/owner-ai-care-report-sheet.tsx", import.meta.url), "utf8"),
]);

test("care-report dev preview is unreachable in Production and mounts the real sheet", () => {
  assert.match(page, /process\.env\.NODE_ENV === "production" \|\| process\.env\.VERCEL_ENV === "production"/);
  assert.match(page, /<OwnerCareReportDevPreview \/>/);
  assert.match(fixture, /<OwnerAiCareReportSheet/);
  assert.match(fixture, /status: "completed" as const/);
  assert.match(fixture, /const developmentFixture = useMemo\(\(\) => \(\{ items: \[\], draft: null, visitWeightKg: 3\.2 \}\), \[\]\)/);
  assert.match(fixture, /publishedCareReport=\{null\}/);
  assert.match(fixture, /developmentFixture=\{developmentFixture\}/);
});

test("development fixture blocks every remote care-report path but keeps local draft recovery", () => {
  assert.match(sheet, /export type OwnerCareReportDevelopmentFixture/);
  assert.match(sheet, /if \(developmentFixture\) \{[\s\S]*setItems\(items\)[\s\S]*return;/);
  assert.match(sheet, /if \(developmentFixture\) \{ setSignedUrl\(""\); return; \}/);
  assert.match(sheet, /개발 미리보기에서는 사진을 추가할 수 없습니다/);
  assert.match(sheet, /개발 미리보기에서는 서버 저장을 실행하지 않습니다/);
  assert.match(sheet, /개발 미리보기에서는 케어리포트를 만들지 않습니다/);
  assert.match(sheet, /개발 미리보기에서는 발행하지 않습니다/);
  assert.match(sheet, /readOwnerCareReportLocalDraft\(shopId, appointment\.id\)/);
  assert.match(sheet, /fetchOwnerAppointmentVisitWeight\(shopId, appointment\.id\)/);
  assert.match(sheet, /currentWeightKg: visitWeightKg \?\? undefined/);
  assert.doesNotMatch(sheet, /inputMode="decimal" value=\{weight\}/);
  assert.match(sheet, /예약 정보 수정/);
  assert.match(sheet, /if \(developmentFixture\) \{[\s\S]*if \(hasEdited\) \{[\s\S]*writeOwnerCareReportLocalDraft\(shopId, appointment\.id,/);
  assert.match(fixture, /clearOwnerCareReportLocalDraft\(fixtureShopId, fixtureAppointmentId\)/);
});
