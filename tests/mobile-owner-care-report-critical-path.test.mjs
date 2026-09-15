import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const source = await readFile(new URL("../src/lib/care-report/owner-care-report-generation.ts", import.meta.url), "utf8");
const ownerAppSource = await readFile(new URL("../src/components/owner/owner-app.tsx", import.meta.url), "utf8");
const javascript = stripTypeScriptTypes(source, { mode: "transform" });
const moduleUrl = `data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`;
const { OwnerCareReportGenerationStageError, runOwnerCareReportGeneration } = await import(moduleUrl);

test("provider generation is saved and read back as one canonical reportText", async () => {
  const calls = [];
  let preserved = "";
  const result = await runOwnerCareReportGeneration({
    generate: async () => { calls.push("generate"); return { reportText: "차분하게 미용을 마쳤어요." }; },
    preserve: (reportText) => { calls.push("preserve"); preserved = reportText; },
    save: async (reportText) => { calls.push("save"); return { reportText }; },
    readback: async () => { calls.push("readback"); return { draft: { reportText: preserved } }; },
  });
  assert.deepEqual(calls, ["generate", "preserve", "save", "readback"]);
  assert.deepEqual(result, { reportText: "차분하게 미용을 마쳤어요." });
});

test("provider failure does not fabricate or preserve a result", async () => {
  let preserved = false;
  await assert.rejects(
    runOwnerCareReportGeneration({
      generate: async () => { throw new Error("provider failed"); },
      preserve: () => { preserved = true; },
      save: async () => ({}),
      readback: async () => ({}),
    }),
    (error) => error instanceof OwnerCareReportGenerationStageError && error.stage === "generate" && error.preservedReportText === null,
  );
  assert.equal(preserved, false);
});

test("save failure preserves the generated draft", async () => {
  let preserved = "";
  await assert.rejects(
    runOwnerCareReportGeneration({
      generate: async () => ({ reportText: "보존할 초안" }),
      preserve: (value) => { preserved = value; },
      save: async () => { throw new Error("save failed"); },
      readback: async () => ({}),
    }),
    (error) => error instanceof OwnerCareReportGenerationStageError && error.stage === "save" && error.preservedReportText === "보존할 초안",
  );
  assert.equal(preserved, "보존할 초안");
});

test("readback mismatch fails closed while keeping the generated draft", async () => {
  await assert.rejects(
    runOwnerCareReportGeneration({
      generate: async () => ({ reportText: "정본 초안" }),
      preserve: () => undefined,
      save: async (reportText) => ({ reportText }),
      readback: async () => ({ draft: { reportText: "다른 내용" } }),
    }),
    (error) => error instanceof OwnerCareReportGenerationStageError && error.stage === "readback" && error.preservedReportText === "정본 초안",
  );
});

test("a never-settling provider is bounded and aborted", async () => {
  let signal;
  const startedAt = Date.now();
  await assert.rejects(
    runOwnerCareReportGeneration({
      generate: async (nextSignal) => { signal = nextSignal; return new Promise(() => {}); },
      preserve: () => undefined,
      save: async () => ({}),
      readback: async () => ({}),
      timeouts: { generate: 20 },
    }),
    (error) => error instanceof OwnerCareReportGenerationStageError && error.stage === "generate",
  );
  assert.equal(signal?.aborted, true);
  assert.ok(Date.now() - startedAt < 250);
});

test("refresh initialization can recover the canonical reportText shape", () => {
  const sheetSource = source;
  assert.match(sheetSource, /"draft" in readbackResult/);
  assert.match(sheetSource, /requireReportText\(draft\)/);
});

test("care-report entry loading is bounded and retains the existing retry flow", () => {
  const openStart = ownerAppSource.indexOf("async function openCareReport");
  const openEnd = ownerAppSource.indexOf("function closeCareReport", openStart);
  const openFlow = ownerAppSource.slice(openStart, openEnd);
  assert.match(openFlow, /withOwnerMobileTimeout\(/);
  assert.match(openFlow, /prepareOwnerCareReportInitialData/);
  assert.match(openFlow, /15_000/);
  assert.match(openFlow, /setCareReportEntryError/);
});
