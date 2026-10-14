import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFile(path.join(mobileRoot, relativePath), "utf8");

test("registered-call reservation tap opens a focused reservation entry instead of CatchCall settings", async () => {
  const ownerApp = await read("src/components/owner/owner-app.tsx");
  assert.match(ownerApp, /setPendingCallReservationAction\(action\);/);
  assert.doesNotMatch(ownerApp.slice(ownerApp.indexOf("const openCatchCallReservation"), ownerApp.indexOf("void getOwnerCallReservationAction")), /setActiveTab\("settings"\)|setSettingsEntryScreen\("catchcall"\)/);
  assert.match(ownerApp, /<OwnerCallReservationQuickEntry[\s\S]*?action=\{pendingCallReservationAction\}/);
});

test("quick call reservation matches the caller automatically and offers only the booking choices", async () => {
  const quickEntry = await read("src/components/owner/owner-call-reservation-quick-entry.tsx");
  assert.match(quickEntry, /phoneNormalize\(guardian\.phone\) === normalizedNumber/);
  assert.match(quickEntry, /setPetId\(pets\[0\]\.id\)/);
  assert.match(quickEntry, /fieldset[\s\S]*?서비스[\s\S]*?aria-pressed/);
  assert.match(quickEntry, /type="date"[\s\S]*?type="time"/);
  assert.match(quickEntry, /staffId: null,[\s\S]*?memo: ""/);
  assert.doesNotMatch(quickEntry, /고객 검색|고객 선택/);
});

test("quick reservation checks an already-uploaded call before attempting background sync", async () => {
  const quickEntry = await read("src/components/owner/owner-call-reservation-quick-entry.tsx");
  assert.match(quickEntry, /let events = \(await listEvents\(\)\)\.events \?\? \[\];[\s\S]*?if \(!events\.some\(\(event\) => event\.providerEventId === providerEventId\)\)[\s\S]*?syncOwnerCallScreeningEvents/);
  assert.match(quickEntry, /api\/owner\/call-events\/\$\{callEvent\.id\}\/reservation/);
});
