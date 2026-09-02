import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("care report completion choice and composer remain mutually exclusive", () => {
  const calendar = readProjectFile("src/components/owner-web/calendar-management-screen.tsx");
  const choice = readProjectFile("src/components/owner-web/calendar-care-report-choice-dialog.tsx");

  assert.match(calendar, /const careReportFlowOverlayOpen = Boolean\(careReportChoiceBooking \|\| photoStatusAction\)/);
  assert.match(calendar, /setPhotoStatusAction\(null\);\s+setBasicCareReportError\(""\);\s+setCareReportChoiceBooking\(targetBooking\);/);
  assert.match(calendar, /setCareReportChoiceBooking\(null\);\s+const selectedPet = booking\.petId/);
  assert.match(calendar, /careReportChoiceTransitionRef\.current = true/);
  assert.match(calendar, /photoStatusAction && !careReportChoiceBooking/);
  assert.match(calendar, /inert=\{careReportFlowOverlayOpen \? true : undefined\}/);
  assert.match(calendar, /role="dialog"\s+aria-modal="true"\s+aria-labelledby="completion-care-report-title"/);
  assert.match(calendar, /function handleDialogKeyDown/);
  assert.match(calendar, /function getVisibleDialogFocusableElements\(dialog: HTMLElement \| null\)/);
  assert.match(calendar, /element\.type === "file" && element\.classList\.contains\("hidden"\)/);
  assert.match(calendar, /!element\.closest\("\[inert\], \[aria-hidden=\\"true\\"\], \[hidden\]"\)/);
  assert.match(calendar, /focusTrapSuspended=\{careReportFlowOverlayOpen\}/);
  assert.match(calendar, /if \(!selectedBooking\?\.id \|\| focusTrapSuspended\) return;/);
  assert.match(calendar, /const focusable = getVisibleDialogFocusableElements\(dialogRef\.current\)/);
  assert.match(choice, /role="dialog"\s+aria-modal="true"\s+aria-labelledby="care-report-choice-title"/);
  assert.match(choice, /function handleKeyDown/);
  assert.match(choice, /onClose: \(\) => void/);
  assert.match(choice, /focus-visible:outline-\[#2563eb\]/);
});

test("completion close and autosave share one in-flight draft write", () => {
  const calendar = readProjectFile("src/components/owner-web/calendar-management-screen.tsx");
  const draftHook = readProjectFile("src/components/owner-web/use-grooming-record-draft.ts");

  assert.match(calendar, /const saveAndCloseInFlightRef = useRef\(false\)/);
  assert.match(
    calendar,
    /if \(saveAndCloseInFlightRef\.current \|\| busy \|\| \(!allowCareReportBusy && careReportBusy\)\) return;\s+\s*saveAndCloseInFlightRef\.current = true;\s+\s*setCompleting\(true\)/,
  );
  assert.match(calendar, /finally \{\s+setCompleting\(false\);\s+saveAndCloseInFlightRef\.current = false;/);

  assert.match(draftHook, /const persistInFlightRef = useRef<Promise<boolean> \| null>\(null\)/);
  assert.match(draftHook, /if \(persistInFlightRef\.current\) return persistInFlightRef\.current;/);
  assert.match(draftHook, /persistInFlightRef\.current = persistPromise;/);
  assert.match(draftHook, /const flushDraft = useCallback\(\(\) => \{\s+if \(saveTimerRef\.current\)/);
  assert.match(draftHook, /flushDraft,/);
});

test("care report authoring keeps every small control reachable at 44px", () => {
  const calendar = readProjectFile("src/components/owner-web/calendar-management-screen.tsx");
  const completionFields = readProjectFile("src/components/owner-web/calendar-grooming-completion-fields.tsx");
  const noteInput = readProjectFile("src/components/owner-web/calendar-care-note-input.tsx");
  const completionPanel = readProjectFile("src/components/owner-web/calendar-care-report-completion-panel.tsx");
  const photoCard = readProjectFile("src/components/owner-web/calendar-care-report-photo-card.tsx");
  const completionPreview = readProjectFile(
    "src/app/dev/owner-care-report-completion-preview/owner-care-report-completion-preview-client.tsx",
  );

  assert.match(calendar, /inline-flex h-11 min-w-11 items-center/);
  assert.match(calendar, /type="checkbox"[\s\S]{0,500}className="h-4 w-4/);
  assert.match(calendar, /inline-flex min-h-11[\s\S]{0,80}cursor-pointer items-center[\s\S]{0,240}focus-within:outline-\[#2563eb\]/);
  assert.match(completionPreview, /inline-flex h-11 min-w-11 items-center/);
  assert.match(completionPreview, /inline-flex min-h-11 items-center.*focus-within:outline-\[#2563eb\]/);
  assert.match(completionFields, /aria-label="예약 서비스 수정"[\s\S]{0,500}h-11/);
  assert.match(completionFields, /aria-label="오늘 몸무게"[\s\S]{0,600}height: "44px"/);
  assert.match(completionFields, /grid-cols-\[minmax\(0,1fr\)_auto\]/);
  assert.match(completionFields, /aria-label="오늘 몸무게"[\s\S]{0,700}w-full min-w-0 max-w-full/);
  assert.doesNotMatch(completionFields, /오늘 몸무게[\s\S]{0,900}flex-none/);
  assert.match(completionFields, /type="date"[\s\S]{0,500}h-11/);
  assert.match(completionFields, /aria-pressed=\{reminderEnabled\}[\s\S]{0,500}min-h-11/);
  assert.match(completionFields, /gridTemplateColumns: "repeat\(auto-fit, minmax\(min\(100%, 10rem\), 1fr\)\)"/);
  assert.match(completionFields, /flex flex-wrap items-center gap-2/);
  assert.match(completionFields, /w-\[150px\] max-w-full/);
  assert.match(calendar, /flex flex-wrap items-center gap-3/);
  assert.match(calendar, /role="tablist" aria-label="미용 사진 선택"/);
  assert.equal((noteInput.match(/grid h-11 w-11/g) ?? []).length, 2);
  assert.equal((completionPanel.match(/inline-flex h-11 items-center/g) ?? []).length, 2);
  assert.match(completionPanel, /sticky bottom-0 z-\[95\] -mx-2[\s\S]{0,180}px-3 py-2/);
  assert.doesNotMatch(completionPanel, /sticky bottom-0 z-\[95\] -mx-3/);
  assert.match(calendar, /h-4 w-4 accent-\[#2f6fd6\] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-\[#2563eb\] focus-visible:ring-2 focus-visible:ring-\[#2563eb\] focus-visible:ring-offset-2/);
  assert.match(photoCard, /focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-\[#2563eb\]/);
  for (const textareaScope of [noteInput, completionPanel]) {
    assert.match(textareaScope, /data-textarea-input-modality=\{textareaInputModality\}/);
    assert.match(textareaScope, /onPointerDownCapture=\{\(\) => setTextareaInputModality\("pointer"\)\}/);
    assert.match(textareaScope, /onMouseDownCapture=\{\(\) => setTextareaInputModality\("pointer"\)\}/);
    assert.match(textareaScope, /onKeyDownCapture=\{markKeyboardTextareaFocus\}/);
    assert.match(textareaScope, /event\.key === "Tab"\) setTextareaInputModality\("keyboard"\)/);
    assert.match(textareaScope, /textareaFocused && textareaInputModality === "keyboard"/);
    assert.match(textareaScope, /outline: "2px solid #2563eb", outlineOffset: 2/);
    assert.match(textareaScope, /onFocus=\{\(\) => setTextareaFocused\(true\)\}/);
    assert.match(textareaScope, /onBlur=\{\(\) => setTextareaFocused\(false\)\}/);
    assert.match(textareaScope, /outline-none focus:outline-none focus:ring-0/);
  }
  assert.match(completionFields, /onRetrySave \? <button[\s\S]{0,360}inline-flex min-h-11 shrink-0 items-center justify-center/);
});
