import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const source = await readFile(new URL("../src/components/owner/owner-app.tsx", import.meta.url), "utf8");
const gateSource = await readFile(new URL("../src/lib/appointments/owner-status-mutation-gate.ts", import.meta.url), "utf8");
const gateJavaScript = stripTypeScriptTypes(gateSource, { mode: "transform" });
const gateModuleUrl = `data:text/javascript;base64,${Buffer.from(gateJavaScript).toString("base64")}`;
const { createOwnerStatusMutationGate } = await import(gateModuleUrl);

test("status commit uses the authoritative PATCH row and does not await a full bootstrap", () => {
  const start = source.indexOf("if (\"status\" in payload && !(\"mode\" in payload))");
  const end = source.indexOf("await mutate(\"/api/appointments\"", start);
  const branch = source.slice(start, end);
  assert.match(branch, /fetchJson<Appointment>\("\/api\/appointments"/);
  assert.match(branch, /updated\.id !== appointmentId \|\| updated\.status !== payload\.status/);
  assert.match(branch, /appointment\.id === appointmentId \? updated : appointment/);
  assert.match(branch, /void refreshSilently\(\)/);
  assert.doesNotMatch(branch, /await refresh\(/);
});

test("duplicate taps are blocked before React can rerender", async () => {
  const gate = createOwnerStatusMutationGate();
  let calls = 0;
  let release;
  const first = gate.run(async () => {
    calls += 1;
    return new Promise((resolve) => { release = resolve; });
  });
  const duplicate = await gate.run(async () => {
    calls += 1;
    return "duplicate";
  });
  assert.deepEqual(duplicate, { accepted: false });
  assert.equal(calls, 1);
  release("committed");
  assert.deepEqual(await first, { accepted: true, value: "committed" });
  assert.match(source, /statusMutationGateRef\.current\.run/);
});

test("a failed status commit releases the gate for an explicit retry", async () => {
  const gate = createOwnerStatusMutationGate();
  await assert.rejects(gate.run(async () => { throw new Error("commit failed"); }), /commit failed/);
  assert.deepEqual(await gate.run(async () => "retried"), { accepted: true, value: "retried" });
});

test("completion opens care-report preparation without delaying committed status success", () => {
  assert.match(source, /const committed = await updateAppointment\(appointmentId, \{ status: "completed" \}/);
  assert.match(source, /if \(committed\) void openCareReport\(appointmentId\)/);
  assert.match(source, /if \(nextStatus === "completed"\) void openCareReport\(appointment\.id\)/);
});

test("all three visible transition buttons expose a progress label while locked", () => {
  assert.match(source, /saving \? "시작하는 중…"/);
  assert.match(source, /saving \? "변경하는 중…"/);
  assert.match(source, /saving \? "완료하는 중…"/);
});
