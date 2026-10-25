"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BookingDepositNotice } from "../contracts/booking-deposit-notice";
import type { AlimtalkApprovalNotice } from "../contracts/alimtalk-approval-notice";
import { notifyDepositChanged, subscribeDepositChanges } from "../lib/booking-deposit-refresh";
export function useBookingDepositNotices(shopId: string, request: <T>(path: string, init?: RequestInit) => Promise<T>, enabled = true) {
  const [notices, setNotices] = useState<BookingDepositNotice[]>([]), [error, setError] = useState("");
  const generation = useRef(0), pending = useRef<Promise<void> | null>(null);
  const refresh = useCallback(() => {
    if (pending.current) return pending.current;
    const epoch = generation.current;
    const task = request<{ notices: BookingDepositNotice[] }>(`/api/owner/booking-deposits?shopId=${encodeURIComponent(shopId)}`)
      .then(r => { if (generation.current === epoch) { setNotices(r.notices); setError(""); } }).catch(() => { if (generation.current === epoch) setError("확인 알림을 불러오지 못했습니다."); }).finally(() => { if (pending.current === task) pending.current = null; });
    pending.current = task; return task;
  }, [shopId, request]);
  useEffect(() => {
    generation.current++; pending.current = null; setNotices([]); if (!enabled) return;
    void refresh(); const visible = () => { if (!document.hidden) void refresh(); };
    const changed = () => { generation.current++; pending.current = null; visible(); };
    const timer = window.setInterval(visible, 30000), stop = subscribeDepositChanges(shopId, changed);
    window.addEventListener("focus", visible); document.addEventListener("visibilitychange", visible);
    return () => { generation.current++; stop(); clearInterval(timer); window.removeEventListener("focus", visible); document.removeEventListener("visibilitychange", visible); };
  }, [enabled, refresh, shopId]);
  const acknowledge = async (n: BookingDepositNotice) => {
    await request("/api/owner/booking-deposits", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shopId, action: "acknowledge", accountId: n.accountId, noticeKey: n.key }) });
    generation.current++; pending.current = null;
    setNotices(current => current.filter(x => x.accountId !== n.accountId || x.key !== n.key)); notifyDepositChanged(shopId);
  };
  return { notices, acknowledge, error, refresh };
}
export default function BookingDepositNotices({ notices, acknowledge, error, refresh, onOpen, approvalNotices = [], acknowledgeApproval, onOpenApproval, alwaysVisible = false, triggerLabel }: ReturnType<typeof useBookingDepositNotices> & { onOpen: (notice: BookingDepositNotice) => void; approvalNotices?: AlimtalkApprovalNotice[]; acknowledgeApproval?: (notice: AlimtalkApprovalNotice) => Promise<void>; onOpenApproval?: (notice: AlimtalkApprovalNotice) => void; alwaysVisible?: boolean; triggerLabel?: string }) {
  const [open, setOpen] = useState(false), [saving, setSaving] = useState(false), [message, setMessage] = useState("");
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => { const close = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); }; document.addEventListener("pointerdown", close); return () => document.removeEventListener("pointerdown", close); }, []);
  const count = notices.length + approvalNotices.length;
  if (!count && !error && !alwaysVisible) return null;
  return <div ref={root} className="relative shrink-0 text-[14px] font-normal leading-5 text-[#15213b]" onKeyDown={e => { if (e.key === "Escape") { setOpen(false); root.current?.querySelector('button')?.focus(); } }}>
    <button type="button" data-owner-control-size="content" aria-expanded={open} aria-label={`알림 ${count}건`} onClick={() => setOpen(v => !v)} className={triggerLabel
      ? "relative inline-flex h-11 min-h-11 w-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-transparent bg-transparent text-[14px] font-medium leading-5 text-[#526175] transition-colors hover:bg-white hover:text-[#15213b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 lg:w-auto lg:px-3"
      : "relative inline-flex h-11 min-h-11 w-11 items-center justify-center rounded-[10px] border border-[#dbe2ea] bg-white text-[#475569] hover:bg-[#f8fafc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"}>
      <svg aria-hidden="true" viewBox="0 0 24 24" className={triggerLabel ? "h-4.5 w-4.5 shrink-0" : "h-5 w-5"} fill="none" stroke="currentColor" strokeWidth={triggerLabel ? "1.8" : "1.7"}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      {triggerLabel && <span className="hidden lg:inline">{triggerLabel}</span>}
      {count > 0 && <span data-owner-unread-count className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-[#a04455] px-1 text-center text-[12px] leading-[18px] text-white">{count > 99 ? "99+" : count}</span>}
    </button>
    {open && <div aria-label="알림" data-deposit-notices className="fixed left-3 right-3 top-[calc(var(--pm-safe-top,0px)+64px)] z-[80] max-h-[60dvh] overflow-y-auto rounded-[14px] border border-[#dbe2ea] bg-white p-3 shadow-lg sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-1 sm:w-[360px] [overflow-wrap:anywhere]">
      <h3 className="px-1 pb-2 text-[16px] font-semibold">알림</h3>
      {approvalNotices.map(notice => <button key={notice.id} type="button" data-template-approval-notice={notice.id} data-owner-control-size="content" disabled={saving} onClick={async () => {
        if (!acknowledgeApproval || !onOpenApproval) return;
        setSaving(true); setMessage("");
        try { await acknowledgeApproval(notice); setOpen(false); onOpenApproval(notice); }
        catch { setMessage("알림을 확인하지 못했습니다. 다시 눌러 주세요."); }
        finally { setSaving(false); }
      }} className="flex min-h-11 w-full items-center gap-2 border-t border-[#e8edf3] py-3 text-left text-[14px] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-50">
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-[#1f6b5b]" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="10" cy="10" r="8" /><path d="m6 10 3 3 5-6" /></svg><span className="min-w-0 flex-1">{notice.title}</span><span aria-hidden="true" className="text-slate-400">›</span>
      </button>)}
      {notices.length > 0 && <p className="px-1 py-2 text-[13px] leading-5 text-[#64748b]">알림을 확인해도 입금·환불 처리는 바뀌지 않습니다.</p>}
      {!count && !error && <p className="px-1 py-3 text-[14px] text-[#64748b]">새 알림이 없습니다.</p>}
      {notices.map(n => <div key={`${n.accountId}:${n.key}`} className="flex items-center gap-2 border-t border-[#e8edf3] py-2">
        <button type="button" onClick={() => { setOpen(false); onOpen(n); }} className="min-h-11 min-w-0 flex-1 rounded-[8px] p-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"><span className="block font-medium">{n.guardianName} · {n.kind === "refund" ? "환불 처리" : "입금 확인"}{n.urgent && <span className="ml-1 text-[12px] text-[#9a5e4e]">기한 경과</span>}</span><span className="block text-[13px] text-[#64748b]">{n.date} · {n.amount.toLocaleString("ko-KR")}원</span></button>
        <button type="button" disabled={saving} aria-label={`${n.guardianName} 알림 확인`} className="min-h-11 shrink-0 rounded-[8px] border border-[#dbe2ea] px-3 text-[14px] font-medium disabled:opacity-50" onClick={async () => { setSaving(true); setMessage(""); try { await acknowledge(n); } catch { setMessage("확인하지 못했습니다. 다시 눌러 주세요."); } finally { setSaving(false); } }}>확인</button>
      </div>)}
      {(message || error) && <p role="status" className="py-2 text-[13px] text-[#9a5e4e]">{message || error}<button type="button" className="min-h-11 px-2 underline" onClick={() => void refresh()}>다시 조회</button></p>}
    </div>}
  </div>;
}
