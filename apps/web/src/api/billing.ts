import {
  confirmOwnerSubscriptionPayment,
  fetchOwnerSubscriptionSummary,
  issueOwnerBillingKeyByApi,
  retryOwnerSubscriptionPayment,
  saveOwnerSubscriptionPreferences,
} from "@/lib/billing/owner-billing-client";

export const getOwnerBillingSummary = fetchOwnerSubscriptionSummary;
export const updateOwnerBillingPlan = saveOwnerSubscriptionPreferences;
export const retryOwnerBillingCharge = retryOwnerSubscriptionPayment;
export const confirmOwnerBillingPayment = confirmOwnerSubscriptionPayment;
export const registerOwnerBillingCard = issueOwnerBillingKeyByApi;
