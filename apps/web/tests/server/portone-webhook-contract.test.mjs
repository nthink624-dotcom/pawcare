import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("PortOne webhook keeps signature, event, payment, and error boundaries", async () => {
  const route = await readFile(new URL("../../src/app/api/webhooks/portone/route.ts", import.meta.url), "utf8");

  assert.match(route, /Webhook\.verify\(webhookSecret, rawBody, headers\)/);
  assert.match(route, /SYNCABLE_PAYMENT_EVENT_TYPES/);
  assert.match(route, /extractPaymentId/);
  assert.match(route, /syncOwnerSubscriptionFromPayment\(paymentId\)/);
  assert.match(route, /syncOwnerAlimtalkCreditPurchaseFromPayment\(paymentId\)/);
  assert.match(route, /Webhook\.WebhookVerificationError/);
  assert.match(route, /Payment webhook processing failed\./);
});
