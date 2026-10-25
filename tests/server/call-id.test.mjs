import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { CALL_ID_FLAGS, maskPhone, matchGuardianIds, normalizePhone, transitionCallStatus } from "../../src/lib/call-id-contract.ts";

const guardians = [{ id: "g1", phone: "010-1234-5678" }, { id: "g2", phone: "+82 10 9999 0000" }, { id: "g3", phone: "01099990000" }];
test("normalizes, masks and distinguishes single, missing and multiple matches", () => { assert.equal(normalizePhone("+82 10-1234-5678"), "01012345678"); assert.equal(maskPhone("01012345678"), "010-****-5678"); assert.deepEqual(matchGuardianIds(guardians, "01012345678"), ["g1"]); assert.deepEqual(matchGuardianIds(guardians, "01000001111"), []); assert.deepEqual(matchGuardianIds(guardians, "01099990000"), ["g2", "g3"]); });
test("applies answered, ended and missed transitions safely", () => { assert.equal(transitionCallStatus("ringing", "answered"), "answered"); assert.equal(transitionCallStatus("answered", "ended"), "ended"); assert.equal(transitionCallStatus("ringing", "missed"), "missed"); assert.equal(transitionCallStatus("ended", "answered"), "ended"); });
test("store deduplicates events and creates one callback for a missed call", () => { const source = readFileSync(new URL("../../src/server/call-id-store.ts", import.meta.url), "utf8"); assert.match(source, /eventIds\.includes/); assert.match(source, /!current\.callbacks\.some/); });
test("callback updates support result, status and booking draft linkage", () => { const source = readFileSync(new URL("../../src/server/call-id-store.ts", import.meta.url), "utf8"); assert.match(source, /bookingDraftId/); assert.match(source, /Object\.assign\(task, patch\)/); });
test("keeps drafts separate and never creates an appointment before confirmation", () => { const source = readFileSync(new URL("../../src/server/call-id-store.ts", import.meta.url), "utf8"); assert.match(source, /appointmentCreated: false/); assert.match(source, /ready_for_booking/); assert.doesNotMatch(source, /api\/appointments/); });
test("keeps every external capability fail-closed and preview has no send control", () => { assert.deepEqual(CALL_ID_FLAGS, { callDetectionEnabled: false, alimtalkSendEnabled: false, externalExecution: false }); const ui = readFileSync(new URL("../../src/components/owner-web/owner-call-intake-screen.tsx", import.meta.url), "utf8"); assert.doesNotMatch(ui, /\/api\/notifications/); assert.doesNotMatch(ui, /발송하기/); });
