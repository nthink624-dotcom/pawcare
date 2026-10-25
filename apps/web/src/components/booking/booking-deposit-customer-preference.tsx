"use client";
import { useCallback } from "react";
import Preference, { type DepositCustomerPreference } from "@petmanager/shared/components/booking-deposit-customer-preference";
import { fetchApiJsonWithAuth } from "@/lib/api";
export default function BookingDepositCustomerPreference({ shopId, guardianId }: { shopId: string; guardianId: string }) {
  const load = useCallback(() => fetchApiJsonWithAuth<DepositCustomerPreference>(`/api/owner/booking-deposits?${new URLSearchParams({ shopId, guardianId })}`), [shopId, guardianId]);
  const persist = useCallback((next: DepositCustomerPreference) => fetchApiJsonWithAuth("/api/owner/booking-deposits", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shopId, guardianId, depositException: next.deposit_exception, establishedCustomer: next.established_customer }) }), [shopId, guardianId]);
  return <Preference load={load} persist={persist} />;
}
