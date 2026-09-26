import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("owner billing plan, consent, and card registration stay in one accessible modal flow", async () => {
  const [modal, screen, picker, consent, cardForm, paymentSheet] = await Promise.all([
    source("src/components/owner/owner-billing-modal.tsx"),
    source("src/components/owner/owner-billing-screen.tsx"),
    source("src/components/owner/owner-billing-plan-picker.tsx"),
    source("src/features/billing/BillingConsent.tsx"),
    source("src/features/billing/OwnerBillingCardRegistrationForm.tsx"),
    source("src/features/billing/PaymentMethodSheet.tsx"),
  ]);

  assert.match(modal, /createPortal\(/);
  assert.match(modal, /role="dialog"/);
  assert.match(modal, /aria-modal="true"/);
  assert.match(modal, /document\.body\.style\.overflow = "hidden"/);
  assert.match(modal, /event\.key === "Escape"/);
  assert.match(modal, /event\.key !== "Tab"/);
  assert.match(modal, /max-h-\[calc\(100dvh-32px\)\]/);

  assert.match(screen, /<OwnerBillingModal[\s\S]*labelledBy="owner-billing-card-registration-title"/);
  assert.match(screen, /<OwnerBillingModal[\s\S]*labelledBy="owner-billing-consent-title"/);
  assert.match(screen, /<OwnerBillingModal[\s\S]*labelledBy="owner-billing-plan-picker-title"/);
  assert.match(screen, /<OwnerBillingCardRegistrationForm\s+variant="modal"/);
  assert.match(screen, /<BillingConsent\s+variant="modal"/);
  assert.match(screen, /<OwnerBillingPlanPicker\s+variant="modal"/);
  assert.doesNotMatch(screen, /if \(cardRegistrationOpen\) \{\s*return/);
  assert.doesNotMatch(screen, /if \(isSelectingPlan\) \{\s*return/);

  assert.match(picker, /variant\?: "page" \| "modal"/);
  assert.match(picker, /repeat\(auto-fit,minmax\(min\(100%,280px\),1fr\)\)/);
  assert.match(consent, /variant === "page"/);
  assert.match(cardForm, /variant === "page"/);
  assert.match(paymentSheet, /z-\[80\]/);

  assert.doesNotMatch(picker, /모든 플랜에 기본 제공/);
  assert.doesNotMatch(picker, />이용 기준</);
  assert.doesNotMatch(consent, /선택한 요금제와 결제 조건을 확인한 뒤/);
  assert.doesNotMatch(consent, /안전한 카드 등록/);
  assert.doesNotMatch(consent, /consentLines/);
  assert.doesNotMatch(cardForm, /카드 명세서와 결제대행 과정에는/);
  assert.doesNotMatch(paymentSheet, /등록된 카드로 바로 결제하거나/);
});
