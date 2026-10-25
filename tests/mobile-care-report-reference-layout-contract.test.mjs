import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [sheet, ownerApp] = await Promise.all([
  readFile(new URL("../src/components/owner/owner-ai-care-report-sheet.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/owner/owner-app.tsx", import.meta.url), "utf8"),
]);

test("care-report reference layout uses live appointment data and real media assets", () => {
  assert.match(sheet, />케어리포트 작성</);
  assert.match(sheet, /\{pet\.name\} · \{staffName \|\| "담당 디자이너"\} · \{selectedService\?\.name \?\? "서비스 확인 필요"\}/);
  assert.doesNotMatch(sheet, /콩이|서연 디자이너/);
  assert.match(sheet, /const photoItems = useMemo\(\(\) => items\.filter/);
  assert.match(sheet, /media_kind === "grooming_before" \|\| item\.mediaAsset\.media_kind === "grooming_after"/);
  assert.match(sheet, /Promise\.all\(photoItems\.map/);
  assert.match(sheet, /getOwnerMediaSignedUrl\(shopId, item\.mediaAsset\.id, "provider_ready"\)/);
  assert.match(sheet, /role="list" aria-label="등록된 미용 사진"/);
  assert.match(sheet, /\{photoItems\.map\(\(item\) =>/);
  assert.match(sheet, /aria-label="미용 사진 촬영"/);
  assert.match(sheet, /aria-label="미용 사진 선택"/);
  assert.match(sheet, /onClick=\{\(\) => \{ setSelectedIds\(\(current\) => \(\{ \.\.\.current, grooming_after: id \}\)\); setHasEdited\(true\); \}\}/);
  assert.doesNotMatch(sheet, /picsum|placehold\.co|data:image\//i);
});

test("care-report reference layout keeps one reportText result and real actions", () => {
  const generateFlow = sheet.slice(sheet.indexOf("async function generate"), sheet.indexOf("async function publish"));
  const draftStart = sheet.indexOf('data-testid="care-report-draft"');
  const draftSurface = sheet.slice(draftStart, sheet.indexOf('{error ?', draftStart));
  assert.doesNotMatch(sheet, />AI 정리 결과|h-px flex-1/);
  assert.match(sheet, /data-testid="care-report-user-memo"[\s\S]*\{sourceText\.trim\(\)\}/);
  assert.match(sheet, /action === "generate" \? <div data-testid="care-report-generation-loading"/);
  assert.match(draftSurface, /rounded-\[18px\] border border-\[#d8e5f4\] bg-\[#f6f9fd\]/);
  assert.match(draftSurface, /h-1\.5 w-1\.5[\s\S]*AI가 정리한 케어리포트/);
  assert.match(draftSurface, /text-\[14px\] font-medium leading-5/);
  assert.match(draftSurface, /role="region" aria-label="AI 케어리포트 본문" tabIndex=\{0\}[\s\S]*max-h-72 overflow-y-auto whitespace-pre-wrap[\s\S]*text-\[16px\] font-normal leading-6/);
  assert.doesNotMatch(draftSurface, /방금 생성/);
  assert.match(sheet, /value=\{report\.reportText\}/);
  assert.match(sheet, /setReport\(\{ reportText: event\.target\.value\.slice\(0, 4000\) \}\)/);
  assert.match(sheet, />\{isReportEditing \? "수정 완료" : "직접 수정"\}<\/button>/);
  assert.match(sheet, />다시 정리<\/button>/);
  assert.doesNotMatch(draftSurface, /이대로 보내기/);
  assert.match(generateFlow, /currentReportText: report\.reportText, revisionRequest: revisionText/);
  assert.match(generateFlow, /sourceText: input, photoConsent/);
  assert.match(generateFlow, /setReport\(\{ reportText: result\.reportText \}\)/);
  assert.match(sheet, /if \(generationInFlightRef\.current\) return/);
  assert.doesNotMatch(generateFlow, /setTimeout|sent\s*=|setSent/);
  assert.doesNotMatch(sheet, /디자이너의 한마디|피부·피모 상태|홈케어 팁/);
});

test("care-report footer is one flat region with publish before draft save", () => {
  const footerStart = sheet.indexOf('<footer data-testid="care-report-footer-unified"');
  const footerSurface = sheet.slice(footerStart, sheet.indexOf("</footer>", footerStart));
  const inputSurfaceStart = footerSurface.indexOf('data-testid="care-report-composer-input-surface"');
  const composerControlsStart = footerSurface.indexOf('data-testid="care-report-composer-controls"');
  const actionRowStart = footerSurface.indexOf('data-testid="care-report-keyboard-aware-actions"');
  const actionRow = footerSurface.slice(actionRowStart);
  const publishIndex = actionRow.indexOf("이대로 보내기");
  const saveIndex = actionRow.indexOf("임시저장");

  assert.ok(footerStart >= 0);
  assert.match(footerSurface, /className="shrink-0 border-t border-\[#d7e4f2\] bg-white/);
  assert.equal([...footerSurface.matchAll(/\bborder-t\b/g)].length, 1);
  assert.ok(inputSurfaceStart >= 0 && inputSurfaceStart < composerControlsStart && composerControlsStart < actionRowStart);
  assert.match(footerSurface, /<textarea ref=\{composerTextareaRef\}/);
  assert.match(footerSurface, /data-testid="care-report-composer-input-surface" className="overflow-hidden rounded-\[14px\] bg-\[#f7f9fc\]/);
  const inputSurface = footerSurface.slice(inputSurfaceStart, actionRowStart);
  const inputSurfaceOpening = footerSurface.slice(inputSurfaceStart, footerSurface.indexOf(">", inputSurfaceStart) + 1);
  assert.doesNotMatch(inputSurfaceOpening, /\bborder\b/);
  assert.doesNotMatch(inputSurface, /border-t|border-b|divide-y|divide-x/);
  assert.ok(publishIndex >= 0 && publishIndex < saveIndex);
  assert.match(actionRow, /onClick=\{\(\) => setShowPublishConfirm\(true\)\}/);
  assert.match(actionRow, /onClick=\{\(\) => void saveDraft\(\)\}/);
  assert.equal((sheet.match(/이대로 보내기/g) ?? []).length, 1);
  assert.doesNotMatch(sheet, /\{\{\s*memoHint\s*\}\}/);
});

test("today photos and revisit summary do not add duplicate outer dividers", () => {
  assert.match(sheet, /<div data-testid="care-report-summary">/);
  assert.match(sheet, /<section className="pb-0 pt-3" aria-label="미용 사진">/);
  assert.doesNotMatch(sheet, /data-testid="care-report-summary" className="[^"]*border-b/);
  assert.doesNotMatch(sheet, /<section className="[^"]*border-b[^"]*" aria-label="미용 사진">/);
  assert.match(sheet, /aria-label="예약 정보"[\s\S]*border border-\[#e8edf3\]/);
  assert.match(sheet, /data-testid="care-report-revisit-row"[\s\S]*border-x border-b border-\[#e8edf3\]/);
});

test("care-report result and summary stay compact without shrinking photos or touch targets", () => {
  assert.match(sheet, /aria-label="미용 사진"[\s\S]*className="flex h-24 w-\[108px\]/);
  assert.match(sheet, /className="h-24 w-24 shrink-0"/);
  assert.match(sheet, /className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1[^\"]*px-3 py-px" aria-label="예약 정보"/);
  assert.match(sheet, /data-testid="care-report-revisit-row"[\s\S]*style=\{\{ fontWeight: 400 \}\}[\s\S]*min-h-11[\s\S]*px-3 py-0 text-left font-normal/);
  assert.match(sheet, /onClick=\{onReturnToDetail\}[\s\S]*min-h-11/);
  assert.match(sheet, /\{report \? <h2 className="sr-only">수정 요청<\/h2> : <h2[^>]*>케어리포트 내용<\/h2>\}/);
  assert.doesNotMatch(sheet, /<h2 className="text-\[16px\][^>]*>\{report \? "수정 요청"/);
});

test("care-report keeps existing save, publish, re-entry, and appointment edit contracts", () => {
  assert.match(sheet, /JSON\.stringify\(\{ shopId, appointmentId: appointment\.id, reportText: report\.reportText, photoConsent, action: "save_draft" \}\)/);
  assert.match(sheet, /JSON\.stringify\(\{ shopId, appointmentId: appointment\.id, reportText: report\.reportText, photoConsent, action: "publish" \}\)/);
  assert.match(sheet, /writeOwnerCareReportLocalDraft\(shopId, appointment\.id/);
  assert.match(sheet, /if \(!\(await persistDraft\(\)\)\) return/);
  assert.match(sheet, /if \(hasEdited\) \{[\s\S]*setShowExitConfirm\(true\)/);
  assert.match(sheet, /onClick=\{onReturnToDetail\} aria-label="예약 정보 수정"/);
  assert.match(ownerApp, /onReturnToDetail=\{\(\) => \{ closeCareReport\(\); setModal\(\{ type: "appointment", appointment \}\); void refresh\(\); \}\}/);
});

test("care-report keyboard handling preserves the memo caret and hides footer actions", () => {
  const footerStart = sheet.indexOf('<footer data-testid="care-report-footer-unified"');
  const footerOpening = sheet.slice(footerStart, sheet.indexOf(">", footerStart) + 1);
  const actionRowStart = sheet.indexOf('data-testid="care-report-keyboard-aware-actions"', footerStart);
  const actionRow = sheet.slice(actionRowStart, sheet.indexOf(">", actionRowStart) + 1);
  assert.match(sheet, /const viewport = window\.visualViewport/);
  assert.match(sheet, /viewport\?\.addEventListener\("resize", syncViewport\)/);
  assert.match(sheet, /document\.addEventListener\("focusin", syncAfterFocusChange\)/);
  assert.match(sheet, /activeElement\.scrollIntoView\(\{ block: "center" \}\)/);
  assert.match(sheet, /data-testid="care-report-keyboard-aware-actions"/);
  assert.doesNotMatch(footerOpening, /isKeyboardOpen|hidden/);
  assert.match(actionRow, /data-keyboard-hidden=\{isKeyboardOpen \? "true" : "false"\}/);
  assert.match(actionRow, /\$\{isKeyboardOpen \? "hidden" : ""\}/);
  assert.ok(sheet.indexOf("composerTextareaRef", footerStart) < actionRowStart);
  assert.match(sheet, /h-\[100dvh\]/);
  assert.match(sheet, /env\(safe-area-inset-top\)/);
  assert.match(sheet, /env\(safe-area-inset-bottom\)/);
  assert.doesNotMatch(sheet, /h-\[860px\]|height:\s*["']860px/);
});

test("care-report reference layout follows the mobile typography and touch contract", () => {
  assert.doesNotMatch(sheet, /text-\[11px\]|font-bold|font-extrabold|font-black/);
  assert.match(sheet, /text-\[16px\] font-normal leading-6 text-\[#526b84\]">재예약 알림 설정<\/span>/);
  assert.match(sheet, /text-right text-\[16px\] font-normal leading-6 text-\[#64748b\][\s\S]*매장 기본값/);
  assert.match(sheet, /aria-label="미용 사진 촬영" className=\{`flex h-11 w-11/);
  assert.match(sheet, /aria-label="미용 사진 선택" className=\{`flex h-11 w-11/);
  assert.match(sheet, /text-\[16px\] font-normal leading-6/);
  assert.match(sheet, /max-w-\[430px\]/);
});
