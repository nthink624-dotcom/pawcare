"use client";
import { useCallback, useEffect, useState } from "react";
import Ledger from "@petmanager/shared/components/booking-deposit-ledger-panel";
import Preference, { type DepositCustomerPreference } from "@petmanager/shared/components/booking-deposit-customer-preference";
import type { PreparationResponse } from "@petmanager/shared/contracts/booking-preparation";
import { fetchApiJsonWithAuth } from "@/lib/api";
import DepositInitialSummary from "@petmanager/shared/components/booking-deposit-initial-summary";
import type { BookingDepositPreview } from "@petmanager/shared/contracts/booking-deposit-preview";
import { useBookingPreparationRead } from "@petmanager/shared/lib/use-booking-preparation-read";
import { notifyDepositChanged } from "@petmanager/shared/lib/booking-deposit-refresh";

export default function OwnerBookingDepositPanel({ shopId, appointmentId, guardianId, onReload, onLedger, initialDeposit, initialStatus, initialServiceAmount }: {
  shopId: string; appointmentId: string; guardianId: string; onReload?: () => Promise<void>; onLedger?: (exists: boolean) => void;
  initialDeposit?: BookingDepositPreview | null; initialStatus?: string; initialServiceAmount?: number | null;
}) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const request = useCallback((details: boolean) => fetchApiJsonWithAuth<PreparationResponse>(`/api/owner/booking-preparation?${new URLSearchParams({ shopId, appointmentId, ...(details ? { details: "1" } : {}) })}`, { cache: "no-store" }), [shopId, appointmentId]);
  const { result, setResult, load } = useBookingPreparationRead(shopId, appointmentId, busy, request);
  useEffect(() => {
    let active = true; setMessage("");
    void load().then(next => { if (active) setResult(next); }).catch(error => { if (active && error.message !== "STALE_PREPARATION_READ") setMessage("예약금 정보를 불러오지 못했습니다. 다시 열어 주세요."); });
    return () => { active = false; };
  }, [load, setResult]);
  useEffect(() => { if (result) onLedger?.(Boolean(result.ledger)); }, [result, onLedger]);
  async function act(action: string, fields: Record<string, unknown>) {
    if (!result || busy) return; setBusy(true); setMessage("");
    try {
      const next = await fetchApiJsonWithAuth<PreparationResponse>("/api/owner/booking-preparation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shopId, appointmentId, version: result.version, action, note: "", ...fields }) });
      setResult(next); notifyDepositChanged(shopId, next.ledger?.id); await onReload?.();
      setMessage(action === "retry_deposit" ? next.depositDelivery?.message ?? "재요청 결과를 확인하지 못했습니다. 발송 이력을 확인해 주세요." : "");
    } catch (error) { setMessage(error instanceof Error ? error.message : "처리하지 못했습니다."); }
    finally { setBusy(false); }
  }
  async function reschedule(date: string, time: string, transfer?: boolean) {
    if (!result?.schedule || busy) return; setBusy(true); setMessage("");
    try {
      const s = result.schedule;
      await fetchApiJsonWithAuth("/api/appointments", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shopId, appointmentId, serviceId: s.serviceId, staffId: s.staffId, appointmentDate: date, appointmentTime: time, durationMinutes: s.durationMinutes, memo: s.memo, notifyCustomer: false, preserveStatus: true, depositTransfer: transfer }) });
      const next = await load(); setResult(next); notifyDepositChanged(shopId, next.ledger?.id); await onReload?.(); setMessage("예약 일정을 변경했습니다. 최초 입금 기한은 연장하지 않습니다.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "일정을 변경하지 못했습니다."); }
    finally { setBusy(false); }
  }
  const loadPreference = useCallback(() => fetchApiJsonWithAuth<DepositCustomerPreference>(`/api/owner/booking-deposits?${new URLSearchParams({ shopId, guardianId })}`), [shopId, guardianId]);
  const savePreference = useCallback((next: DepositCustomerPreference) => fetchApiJsonWithAuth("/api/owner/booking-deposits", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shopId, guardianId, depositException: next.deposit_exception, establishedCustomer: next.established_customer }) }), [shopId, guardianId]);
  return <section className="min-w-0 space-y-3" aria-label="모바일 예약금 처리">
    {!result && !message && <DepositInitialSummary preview={initialDeposit} appointmentStatus={initialStatus} serviceAmount={initialServiceAmount} />}
    {result?.ledger && <Ledger key={appointmentId} ledger={result.ledger} owner busy={busy} appointmentStatus={result.appointmentStatus} serviceAmount={result.serviceAmount} remainingAmount={result.remainingAmount} schedule={result.schedule} onLoadDetails={async () => setResult(await load(true))} onReschedule={["pending", "confirmed"].includes(result.appointmentStatus) ? reschedule : undefined} onAct={act} onRefresh={async () => { try { setResult(await load()); setMessage(""); } catch (error) { setMessage(error instanceof Error ? error.message : "예약금 상태를 불러오지 못했습니다."); } }} />}
    {message && <p role="status" className="text-[14px] leading-5 text-[#64748b] [overflow-wrap:anywhere]">{message}</p>}
    <details><summary className="min-h-11 py-2 text-[16px] font-medium">이 고객의 다음 예약금 설정</summary><Preference load={loadPreference} persist={savePreference} /></details>
  </section>;
}
