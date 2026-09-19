import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("alerts use one neutral outer surface and flat internal sections", async () => {
  const source = await readFile(new URL("../../src/components/owner-web/settings-alerts-panel.tsx", import.meta.url), "utf8");

  assert.match(source, /data-pc-alerts-surface className="min-w-0 overflow-hidden rounded-\[14px\] border border-\[#e8edf3\] bg-white"/);
  assert.match(source, /data-alerts-section="global" className="px-4 py-4"/);
  assert.match(source, /data-alerts-section="revisit"[\s\S]*?\[&>div\]:!border-0/);
  assert.match(source, /data-alerts-group=\{group\.key\}[\s\S]*?className="min-w-0 px-4 py-4"/);
  assert.match(source, /data-alerts-preview className="min-w-0 border-t border-\[#e8edf3\][\s\S]*?xl:border-l xl:border-t-0"/);
  assert.match(source, /border-b border-\[#e8edf3\][\s\S]*?last:border-b-0/);
  assert.doesNotMatch(source, /shadow-\[0_6px_16px/);
});

test("alerts retain existing controls and update paths", async () => {
  const [source, settingsScreen, ownerPreview] = await Promise.all([
    readFile(new URL("../../src/components/owner-web/settings-alerts-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../src/components/owner-web/settings-management-screen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../src/components/owner-web/owner-web-preview.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(source, /<AlertSettingsSwitch[\s\S]*?aria-label="알림톡 전체 사용"/);
  assert.match(source, /<SettingsRevisitReminderDefault[\s\S]*?onDaysChange=/);
  assert.match(source, /appointmentReminder10mMode: automaticVisitReminderAvailable && checked \? "auto" : "manual"/);
  assert.match(source, /fetchApiJsonWithAuth<AlimtalkTemplatePreviewResponse>/);
  assert.match(settingsScreen, /activeTab === "alerts"[\s\S]*?<SettingsAlertsPanel/);
  assert.match(ownerPreview, /case "alerts":[\s\S]*?<SettingsManagementScreen/);
});
