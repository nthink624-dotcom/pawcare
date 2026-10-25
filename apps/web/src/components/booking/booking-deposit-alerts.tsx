"use client";
import { useBookingDepositNotices } from "@petmanager/shared/components/booking-deposit-notices";
export { default } from "@petmanager/shared/components/booking-deposit-notices";
import { fetchApiJsonWithAuth } from "@/lib/api";
export function useOwnerDepositNotices(shopId: string, enabled = true) { return useBookingDepositNotices(shopId, fetchApiJsonWithAuth, enabled); }
