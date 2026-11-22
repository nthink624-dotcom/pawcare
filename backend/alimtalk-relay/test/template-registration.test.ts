import test from "node:test";
import assert from "node:assert/strict";
import { registerTemplateSafely, TemplateRegistrationError, type RegistrationTemplateSnapshot } from "../src/template-registration.js";

const input = {
  templateCode: "PMTEST",
  templateName: "PM_PMTEST",
  templateContent: "#{보호자명}님 예약 안내입니다.",
  buttons: [{ buttonType: "WL", buttonName: "예약 확인", linkMobile: "https://example.com", linkPc: "https://example.com" }],
  requestReview: true,
};
const snapshot = (inspectionStatus: string): RegistrationTemplateSnapshot => ({
  templateCode: input.templateCode,
  templateName: input.templateName,
  templateContent: input.templateContent,
  inspectionStatus,
  buttons: [{ type: "WL", name: "예약 확인", linkMobile: "https://example.com", linkPc: "https://example.com" }],
});

test("resumes a registered template without adding it twice", async () => {
  let adds = 0, reviews = 0;
  const result = await registerTemplateSafely(input, {
    find: async () => snapshot("REG"), add: async () => { adds++; }, requestReview: async () => { reviews++; },
  });
  assert.deepEqual(result, { registered: true, reviewRequested: true, alreadySubmitted: false });
  assert.equal(adds, 0);
  assert.equal(reviews, 1);
});

test("recognizes an already requested or approved template without repeating the review request", async () => {
  for (const state of ["REQ", "ING", "APR"]) {
    let adds = 0, reviews = 0;
    const result = await registerTemplateSafely(input, {
      find: async () => snapshot(state), add: async () => { adds++; }, requestReview: async () => { reviews++; },
    });
    assert.equal(result.alreadySubmitted, true);
    assert.equal(adds, 0);
    assert.equal(reviews, 0);
  }
});

test("blocks a mismatched provider snapshot and a rejected template", async () => {
  await assert.rejects(registerTemplateSafely(input, {
    find: async () => ({ ...snapshot("REG"), templateContent: "different" }), add: async () => {}, requestReview: async () => {},
  }), (error: unknown) => error instanceof TemplateRegistrationError && error.stage === "conflict");
  await assert.rejects(registerTemplateSafely(input, {
    find: async () => snapshot("REJ"), add: async () => {}, requestReview: async () => {},
  }), (error: unknown) => error instanceof TemplateRegistrationError && error.stage === "status" && !error.retryable);
});

test("does not write when provider state lookup fails", async () => {
  let writes = 0;
  await assert.rejects(registerTemplateSafely(input, {
    find: async () => { throw new Error("provider unavailable"); }, add: async () => { writes++; }, requestReview: async () => { writes++; },
  }), (error: unknown) => error instanceof TemplateRegistrationError && error.stage === "lookup" && error.registered === null);
  assert.equal(writes, 0);
});

test("keeps registered state when the review request response is uncertain", async () => {
  await assert.rejects(registerTemplateSafely(input, {
    find: async () => snapshot("REG"), add: async () => {}, requestReview: async () => { throw new Error("timeout"); },
  }), (error: unknown) => error instanceof TemplateRegistrationError && error.stage === "review" && error.registered === true && error.retryable);
});
