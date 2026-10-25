import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
const source = await readFile(new URL("../src/components/owner/owner-settings-panel.tsx", import.meta.url), "utf8");
const start = source.indexOf("  const settingsGroups: OwnerSettingsOverviewGroup[] = [");
const end = source.indexOf("\n  ];", start) + 5;
assert.ok(start >= 0 && end > start);
const js = ts.transpileModule(source.slice(start, end) + "\nreturn settingsGroups;", { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
function groups(onLogout) {
  const calls = [];
  const names = ["onLogout", "Store", "CalendarDays", "Camera", "UserRound", "Bell", "BellRing", "MessageSquarePlus", "FileText", "updateActiveScreen", "setIsPriceGuideOpen", "feedbackTriggerRef", "isTesterFeedback", "onOpenFeedback"];
  const result = new Function(...names, js)(onLogout, ...Array(8).fill(null), v => calls.push(v), v => calls.push(v), null, false, undefined);
  return { result, calls };
}
test("account appears first, legal appears alone last, existing actions stay intact", () => {
  const { result, calls } = groups(() => {});
  assert.deepEqual(result.map(g => g.title), ["계정", "매장 운영", "알림·고객 응대", "약관 및 정책"]);
  assert.deepEqual(result.map(g => g.items.map(i => i.key)), [["account"], ["shop", "closures", "price", "staff"], ["notifications", "appNotifications", "feedback"], ["legal"]]);
  result[0].items[0].onClick(); result[3].items[0].onClick(); assert.deepEqual(calls, ["account", "legal"]);
});
test("no logout capability omits the entire account group without empty groups", () => {
  const { result } = groups(undefined);
  assert.deepEqual(result.map(g => g.title), ["매장 운영", "알림·고객 응대", "약관 및 정책"]);
  assert.ok(result.every(g => g.items.length > 0));
});
