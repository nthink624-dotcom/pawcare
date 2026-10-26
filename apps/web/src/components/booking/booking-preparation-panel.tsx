"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { DEPOSIT_STATUS_LABELS, type PreparationResponse, type SignaturePoint } from "@petmanager/shared/contracts/booking-preparation";
import BookingSignaturePad, { SignaturePreview } from "@petmanager/shared/components/booking-signature-pad";
import BookingDepositLedgerPanel from "@/components/booking/booking-deposit-ledger-panel";
import BookingDepositCarry from "@/components/booking/booking-deposit-carry";
import { fetchApiJson, fetchApiJsonWithAuth } from "@/lib/api";
import DepositInitialSummary from "@petmanager/shared/components/booking-deposit-initial-summary";
import type { BookingDepositPreview } from "@petmanager/shared/contracts/booking-deposit-preview";
import { useBookingPreparationRead } from "@petmanager/shared/lib/use-booking-preparation-read";
import { notifyDepositChanged } from "@petmanager/shared/lib/booking-deposit-refresh";
import { canRetryConsentRequest } from "@petmanager/shared/lib/booking-consent-guidance";
const button = "h-10 rounded-[8px] border border-slate-300 bg-white px-3 text-[16px] disabled:opacity-50";
const field = "h-10 min-w-0 w-full rounded-[8px] border border-slate-300 bg-white px-3 text-[16px]";
function askForReason(prompt: string) {
  const reason = window.prompt(prompt)?.trim();
  return reason || null;
}
function hasCurrentConsent(result: PreparationResponse, templateId: string, templateVersion: number) {
  return result.data.consents.some(document => document.id === templateId && document.version === templateVersion && document.status !== "superseded");
}
export default function BookingPreparationPanel({ shopId, appointmentId, accessToken, onStatusChanged, onDepositReady, cancelAction, initialDeposit, initialStatus, initialServiceAmount }: {
  shopId: string; appointmentId: string; accessToken?: string; onStatusChanged?: (status: string) => void;
  onDepositReady?: (ready: boolean) => void;
  cancelAction?: { kind: "owner" | "customer"; nonce: number } | null;
  initialDeposit?: BookingDepositPreview | null; initialStatus?: string; initialServiceAmount?: number | null;
}) {
  const owner = !accessToken, endpoint = owner ? "/api/owner/booking-preparation" : "/api/customer-booking-preparation";
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [hidden, setHidden] = useState(false);
  const [payerName, setPayerName] = useState(""), [amount, setAmount] = useState(0), [note, setNote] = useState("");
  const [signerName, setSignerName] = useState(""), [signature, setSignature] = useState<SignaturePoint[][]>([]), [agreed, setAgreed] = useState(false), [signingId, setSigningId] = useState("");
  const [sendConsent, setSendConsent] = useState(true), [sendDeposit, setSendDeposit] = useState(false);
  const lastCancelNonce = useRef<number | null>(null);
  const [now, setNow] = useState(Date.now);
  const request = useCallback(async (details: boolean) => {
    const q = new URLSearchParams({ shopId, appointmentId, ...(details ? { details: "1" } : {}) });
    const response = await (owner ? fetchApiJsonWithAuth<PreparationResponse>(`${endpoint}?${q}`) : fetchApiJson<PreparationResponse>(`${endpoint}?${q}`, { headers: { "x-booking-access-token": accessToken ?? "" } }));
    return response;
  }, [shopId, appointmentId, accessToken, owner, endpoint]);
  const { result, setResult, load } = useBookingPreparationRead(shopId, appointmentId, busy, request);
  const statusSeen = useRef<{ id: string; status: string } | null>(null);
  useEffect(() => { if (!result) return; const previous = statusSeen.current; statusSeen.current = { id: result.appointmentId, status: result.appointmentStatus }; if (previous?.id === result.appointmentId && previous.status !== result.appointmentStatus) onStatusChanged?.(result.appointmentStatus); }, [result?.appointmentId, result?.appointmentStatus, onStatusChanged]);
  useEffect(() => { onDepositReady?.(Boolean(result?.ledger && (result.ledger.state === "pending" || result.ledger.state === "reported" || result.ledger.unverified))); }, [result?.ledger?.state, result?.ledger?.unverified, result?.ledger?.id, onDepositReady]);
  useEffect(() => { let active = true; setResult(null); setMessage(""); setHidden(false); setSigningId(""); setSignature([]); setAgreed(false);
    load().then(r => { if (active) { setResult(r); setPayerName(r.data.deposit.payerName); setAmount(r.data.deposit.receivedAmount || r.data.deposit.amount); setSendConsent(r.data.consents.some(c => c.status === "pending")); setSendDeposit(false); } }).catch(async e => {
      if (!active) return;
      if (owner) {
        try {
          const current = await fetchApiJsonWithAuth<{ policy: { depositMode: "off" | "optional" | "required"; consentBeforeStart: boolean } }>(`/api/owner/booking-policy?shopId=${encodeURIComponent(shopId)}`);
          if (active && current.policy.depositMode === "off" && !current.policy.consentBeforeStart) { setHidden(true); return; }
        } catch { /* Keep the visible error when feature state cannot be read. */ }
      }
      if (active) setMessage(e.message);
    }); return () => { active = false; };
  }, [load, owner, shopId]);
  const releaseDeadline = result?.data.deposit.releaseIfUnreported && result.data.deposit.status === "pending"
    && ["pending", "confirmed"].includes(result.appointmentStatus) ? result.data.deposit.dueAt : null;
  const deadlinePassed = Boolean(releaseDeadline && Date.parse(releaseDeadline) <= now);
  useEffect(() => {
    if (!releaseDeadline) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [releaseDeadline]);
  useEffect(() => {
    if (!releaseDeadline || !deadlinePassed || busy) return;
    let active = true;
    const refresh = () => void load().then(next => { if (active) setResult(next); }).catch(e => { if (active) setMessage(e.message); });
    refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [releaseDeadline, deadlinePassed, busy, load, onStatusChanged]);
  async function act(action: string, extra: Record<string, unknown> = {}) {
    if (!result || busy) return; setBusy(true); setMessage("");
    try {
      const body = JSON.stringify({ shopId, appointmentId, accessToken, version: result.version, action, note, ...extra });
      const next = await (owner ? fetchApiJsonWithAuth<PreparationResponse>(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body }) : fetchApiJson<PreparationResponse>(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body }));
      setResult(next); setSigningId(""); setSignature([]); setAgreed(false);
      notifyDepositChanged(shopId, next.ledger?.id);
      if (action === "request_deposit") setSendDeposit(false);
      setMessage(action === "request_guidance"
        ? next.data.requests.slice(-Math.max(1, Number(Boolean(extra.deposit)) + Number(Boolean(extra.consent)))).map(request => request.reason).filter(Boolean).join(" / ") || "요청을 확인해 주세요."
        : action === "retry_deposit" ? next.depositDelivery?.message ?? "재요청 결과를 확인하지 못했습니다. 발송 이력을 확인해 주세요."
        : owner && next.ledger ? "" : action === "revoke_deposit" ? "입금 확인을 취소했습니다. 예약금 대기 상태로 돌아갔습니다." : "처리했습니다.");
      if (next.appointmentStatus !== result.appointmentStatus || ["cancel", "noshow", "correct_noshow", "approve"].includes(action)) onStatusChanged?.(next.appointmentStatus);
    } catch (e) {
      const message = e instanceof Error ? e.message : "처리하지 못했습니다.";
      if (message.includes("다른 화면에서 변경")) {
        try { setResult(await load()); setMessage("최신 입금 상태를 불러왔습니다. 금액을 확인하고 다시 눌러 주세요. 중복 처리하지 않았습니다."); }
        catch { setMessage(message); }
      } else setMessage(message);
    } finally { setBusy(false); }
  }
  useEffect(() => {
    if (!cancelAction || !result || busy || lastCancelNonce.current === cancelAction.nonce) return;
    lastCancelNonce.current = cancelAction.nonce;
    const kind = cancelAction.kind;
    void act("cancel", { cancellationKind: kind, note: "예약 취소" });
  }, [cancelAction?.nonce, cancelAction?.kind, result, busy, act]);
  async function reschedule(date: string, time: string, transfer?: boolean) {
    if (!owner || !result?.schedule || busy) return;
    setBusy(true); setMessage("");
    try {
      const s = result.schedule;
      await fetchApiJsonWithAuth("/api/appointments", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shopId, appointmentId, serviceId: s.serviceId, staffId: s.staffId, appointmentDate: date, appointmentTime: time, durationMinutes: s.durationMinutes, memo: s.memo, notifyCustomer: false, preserveStatus: true, depositTransfer: transfer }) });
      const next = await load(); setResult(next); notifyDepositChanged(shopId, next.ledger?.id); onStatusChanged?.(next.appointmentStatus); setMessage("예약 일정을 변경했습니다. 최초 입금 기한은 연장하지 않습니다.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "일정을 변경하지 못했습니다. 기존 예약은 유지됩니다."); } finally { setBusy(false); }
  }
  async function recognizeExistingConsent() {
    if (!owner || !result || busy) return;
    const documents = result.consentStatus?.pendingDocuments?.filter(doc => doc.scope === "pet") ?? [];
    if (!documents.length || !result.consentStatus?.policyVersion) return;
    if (!window.confirm(`다음 동의서와 같은 내용의 동의를 이 고객에게 이미 받으셨나요?\n${documents.map(doc => `· ${doc.title} (버전 ${doc.version})`).join("\n")}\n고객 전자서명이 아닌 ‘기존 동의 인정’으로 기록합니다.`)) return;
    setBusy(true); setMessage("");
    try {
      await fetchApiJsonWithAuth("/api/owner/customer-consents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        shopId, guardianId: result.guardianId, petId: result.petId, policyVersion: result.consentStatus.policyVersion,
        documents: documents.map(({ id, version }) => ({ id, version })), confirmedExistingConsent: true,
      }) });
      const next = await load();
      setResult(next); notifyDepositChanged(shopId, next.ledger?.id);
      setMessage("기존에 받은 동의서로 기록했습니다. 고객 전자서명과 구분해 보관합니다.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "기존 동의 인정을 저장하지 못했습니다."); }
    finally { setBusy(false); }
  }
  if (hidden) return null;
  async function carry(source: string, amount: number, requestKey: string, refundNote?: string) {
    if (!owner || busy) return; setBusy(true); setMessage("");
    try {
      const next = await fetchApiJsonWithAuth<PreparationResponse>("/api/owner/booking-deposits", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shopId, appointmentId, action: refundNote === undefined ? "carry" : "refund_source", sourceAccountId: source, amount, requestKey, note: refundNote }) });
      setResult(next); notifyDepositChanged(shopId, next.ledger?.id); onStatusChanged?.(next.appointmentStatus); setMessage(refundNote === undefined ? "미사용 예약금을 이 예약에 승계했습니다." : "기존 날짜 예약금의 직접 환불을 기록했습니다.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "예약금을 승계하지 못했습니다."); } finally { setBusy(false); }
  }
  if (!result) return message ? <section className="space-y-2 py-4 text-[16px]"><p role="status" className="text-slate-600">{message}</p>{owner && message.includes("이 예약에는") && <button type="button" className={button} disabled={busy} onClick={async () => {
    setBusy(true); try { setResult(await fetchApiJsonWithAuth<PreparationResponse>(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shopId, appointmentId, action: "initialize" }) })); setMessage(""); } catch (e) { setMessage(e instanceof Error ? e.message : "요청을 만들지 못했습니다."); } finally { setBusy(false); }
  }}>예약금 관리 준비하기</button>}</section> : owner ? <section className="min-w-0 space-y-3 pb-2"><DepositInitialSummary preview={initialDeposit} appointmentStatus={initialStatus} serviceAmount={initialServiceAmount} /></section> : <p role="status" className="py-3 text-[14px] text-slate-600">예약 준비 정보 확인 중…</p>;
  const { data } = result, d = data.deposit, active = ["pending", "confirmed"].includes(result.appointmentStatus);
  const currentPolicyFeatures = result.currentPolicyFeatures;
  const showDeposit = !result.ledger && (d.required || d.status !== "not_requested" || d.receivedAmount > 0);
  const activeConsentTemplates = (currentPolicyFeatures?.consentEnabled === false ? [] : currentPolicyFeatures?.consentTemplates ?? data.policy.templates).filter(template => template.enabled && !template.archivedAt);
  const hasPendingConsent = data.consents.some(consent => consent.status === "pending"
    && activeConsentTemplates.some(template => template.id === consent.id && template.version === consent.version));
  const hasManualConsentTemplate = activeConsentTemplates.some(template =>
    template.audience === "manual" && !hasCurrentConsent(result, template.id, template.version)
    && !(template.scope === "pet" && result.signedPetConsentIds?.includes(template.id)));
  // Documents and signing belong to the customer's existing consent flow, not owner reservation detail.
  const showConsent = !owner && activeConsentTemplates.length > 0 && (hasPendingConsent || hasManualConsentTemplate);
  const showPreparation = showDeposit;
  const latestConsentRequest = [...data.requests].reverse().find(request => request.purposes.includes("consent"));
  const consentRequestBlocked = data.requests.some(request => request.purposes.includes("consent") && !canRetryConsentRequest(request));
  const consentDeliveryBlockReason = result.consentStatus?.deliveryBlockReason;
  const consentDeliveryMessage = consentDeliveryBlockReason || (data.requests.some(request => request.purposes.includes("consent") && request.status === "sent") ? "작성 요청을 보냈습니다. 고객의 작성을 기다립니다."
    : consentRequestBlocked ? "발송 결과를 확인 중입니다. 발송 이력을 확인해 주세요. 중복 발송하지 않습니다."
    : latestConsentRequest?.reason.includes("테스트 모드") ? "개발 환경 모의 발송입니다. 실제 메시지는 보내지 않았습니다."
    : latestConsentRequest ? "이전 요청은 발송되지 않았습니다. 설정을 확인한 뒤 다시 보낼 수 있습니다." : "");
  const canRecognizeConsent = result.consentStatus?.pendingDocuments?.some(doc => doc.scope === "pet") === true;
  const hasOtherDateDeposits = (result.availableDeposits ?? []).some(source => source.available > 0);
  const balance = d.receivedAmount - d.refundedAmount;
  const hasOwnerActions = (active && showPreparation) || (result.appointmentStatus === "pending" && !(d.required && !["confirmed", "waived"].includes(d.status)))
    || (!result.ledger && ((active && (showDeposit && d.status === "not_requested" || d.status === "confirmed" && d.refundedAmount === 0)) || balance > 0))
    || result.appointmentStatus === "noshow";
  return <section className={`min-w-0 space-y-3 ${owner ? "pb-2" : "py-2"} text-[16px] leading-6 text-[#15213b]`} aria-label={owner ? "예약금 관리" : "예약 준비"}>
    {owner && result.consentStatus?.enabled && <div data-owner-consent-actions className="space-y-2 rounded-[10px] border border-[#e2e8f0] p-3">
      <p className="text-[16px] font-medium leading-6">{result.consentStatus.pendingCount > 0 ? "동의서 미완료" : result.consentStatus.recognizedCount > 0 ? "기존 동의 인정" : result.consentStatus.signedCount > 0 ? "전자서명 완료" : "적용할 동의서 없음"}</p>
      {result.consentStatus.pendingCount > 0 && <>
        {consentDeliveryMessage && <p role="status" className="text-[14px] leading-5 text-[#64748b]">{consentDeliveryMessage}</p>}
        {active && <div className="flex flex-wrap gap-2">
          {canRecognizeConsent && <button type="button" data-owner-control-size="content" className="min-h-11 rounded-[10px] border border-[#dbe2ea] bg-white px-3 text-[14px] font-medium leading-5 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500" disabled={busy} onClick={() => void recognizeExistingConsent()}>기존 동의 인정</button>}
          <button type="button" data-owner-control-size="content" className="min-h-11 rounded-[10px] bg-[#111a30] px-3 text-[14px] font-medium leading-5 text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500" disabled={busy || consentRequestBlocked || Boolean(consentDeliveryBlockReason)} onClick={() => {
            if (window.confirm("이 고객에게 미용 동의서 작성 알림톡을 보내시겠어요?\n고객이 직접 작성해야 동의가 완료됩니다.")) void act("request_guidance", { consent: true, deposit: false });
          }}>미용 동의서 발송하기</button>
        </div>}
      </>}
    </div>}
    {owner && !result.ledger && hasOtherDateDeposits && d.receivedAmount === 0 && !["confirmed", "refunded"].includes(d.status) && <BookingDepositCarry sources={result.availableDeposits ?? []} busy={busy} canCarry={active} onCarry={carry} onRefund={carry} />}
    {result.ledger && <BookingDepositLedgerPanel key={appointmentId} ledger={result.ledger} owner={owner} busy={busy} appointmentStatus={result.appointmentStatus} serviceAmount={result.serviceAmount} remainingAmount={result.remainingAmount} onLoadDetails={async () => setResult(await load(true))} additionalDetails={owner ? <><BookingDepositCarry sources={result.availableDeposits ?? []} busy={busy} canCarry={active} onCarry={carry} onRefund={carry} />{(result.previousDepositRefunds ?? []).map((refund, i) => <p key={i} className="text-slate-600">기존 {refund.date} 예약금 직접 환불 완료 · {refund.amount.toLocaleString()}원</p>)}</> : undefined} onAct={act} schedule={result.schedule} onReschedule={owner && active ? reschedule : undefined} onRefresh={async () => { try { setResult(await load()); setMessage(""); } catch (e) { setMessage(e instanceof Error ? e.message : "불러오지 못했습니다."); } }} />}
    {showPreparation && <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-[20px] font-semibold">예약금</h3><button type="button" className={button} disabled={busy} onClick={() => void load().then(setResult).catch(e => setMessage(e.message))}>새로고침</button></div>}
    {showDeposit && <div className="space-y-2"><div className="flex flex-wrap justify-between gap-2"><span>예약금 · {DEPOSIT_STATUS_LABELS[d.status]}</span><span>{d.amount.toLocaleString()}원{d.required ? " · 필수" : ""}</span></div>
      {d.status !== "not_requested" && <>
        <p className="break-all text-slate-600">{data.policy.bankName} {data.policy.bankAccount} · {data.policy.bankHolder}</p>
        {d.dueAt && <p className="text-slate-600">{d.releaseIfUnreported ? "입금 신고 기한" : "납부 기한"}: {new Date(d.dueAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}{Date.parse(d.dueAt) < now && d.status === "pending" ? " · 기한 경과" : ""}</p>}
      </>}
      {d.receivedAmount > 0 && <p>입금 확인 {d.receivedAmount.toLocaleString()}원 · 환불 {d.refundedAmount.toLocaleString()}원 · 기납부 잔액 {balance.toLocaleString()}원</p>}
      {result.remainingAmount != null && <p>서비스 금액 {result.serviceAmount?.toLocaleString()}원 · 예약금 차감 후 잔금 {result.remainingAmount.toLocaleString()}원{result.excessDeposit ? ` · 초과 입금 ${result.excessDeposit.toLocaleString()}원` : ""}</p>}
      {d.confirmedAt && <p className="text-slate-600">입금자 {d.payerName} · 확인 {new Date(d.confirmedAt).toLocaleString("ko-KR")}</p>}
      {d.releaseIfUnreported && d.status === "pending" && <p className="text-slate-600">안내된 납부 기한 안에 이체 후 입금 신고를 해 주세요. 신고 없이 기한이 지나면 예약이 취소되고 다른 고객이 해당 시간을 예약할 수 있습니다.{d.dueAt && Date.parse(d.dueAt) > now ? ` 남은 시간 ${Math.floor((Date.parse(d.dueAt) - now) / 60000)}분 ${Math.floor((Date.parse(d.dueAt) - now) / 1000) % 60}초` : " 기한 경과 여부를 확인하고 있습니다. 이체하지 말고 기다려 주세요."}</p>}
      {d.releaseIfUnreported && d.status === "reported" && <p role="status" className="text-slate-600">입금 신고를 받았습니다. 예약 시간을 유지하며 매장의 실제 입금 확인을 기다립니다.</p>}
      {data.cancellation?.kind === "deposit_expired" && <p role="status" className="text-slate-600">입금 신고 기한이 지나 예약이 취소되었습니다. 이체하지 말고 매장에 문의해 주세요.</p>}
      {active && ["pending", "reported"].includes(d.status) && !(d.releaseIfUnreported && d.status === "pending" && d.dueAt && Date.parse(d.dueAt) <= now) && <div className="space-y-2">
        <label className="grid gap-1">입금자명<input className={field} value={payerName} maxLength={50} onChange={e => setPayerName(e.target.value)} /></label>
        {owner ? <><label className="grid gap-1">실제 확인한 입금액 (원)<input className={field} type="number" min={0} value={amount} onChange={e => setAmount(Number(e.target.value))} /></label><button type="button" className={button} disabled={busy} onClick={() => void act("confirm_deposit", { amount, payerName })}>실제 입금 확인 완료</button></> : <><p className="text-slate-600">이체 후 입금자명을 남겨 주세요. 매장에서 실제 입금을 확인하면 완료됩니다.</p><button type="button" className={`${button} !bg-[#1976ff] !text-white`} disabled={busy} onClick={() => void act("report_deposit", { payerName })}>입금했어요</button></>}
      </div>}
    </div>}
    {showConsent && <div className="space-y-3"><h4 className="font-medium">동의서</h4>{data.consents.length === 0 && <p className="text-slate-600">요청된 동의서가 없습니다.</p>}
      {/* Preserve each customer's actual signature state; hiding owner documents never signs or waives consent. */}
      {data.consents.map(doc => {
        const documentKey = `${doc.id}:${doc.version}`;
        return <details key={documentKey} className="border-b border-[#eef0f2] pb-3" open={signingId === documentKey || undefined}>
        <summary className="cursor-pointer break-words">{doc.title} · {doc.status === "signed" ? "동의 완료" : doc.status === "waived" ? "예외 처리" : doc.status === "superseded" ? "새 버전으로 변경" : "확인 대기"}{doc.required ? " · 필수" : " · 선택"}</summary>
        <div className="mt-3 space-y-3"><p className="text-slate-600">버전 {doc.version} · {doc.scope === "pet" ? "반려동물별 1회" : "예약마다 작성"}</p><p className="whitespace-pre-wrap break-words">{doc.body}</p>
          {doc.status === "signed" && <><p>{doc.signerName ?? data.guardianName ?? "보호자"} · {doc.signedAt && new Date(doc.signedAt).toLocaleString("ko-KR")}</p><p className="text-slate-600">동의 방식: {doc.acceptanceMethod ?? (doc.signature ? "직접 서명" : "체크박스 동의")}</p>{doc.signature && <SignaturePreview value={doc.signature} />}<button type="button" className={button} onClick={() => {
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 220">${(doc.signature ?? []).map(s => `<polyline points="${s.map(p => `${p.x * 600},${p.y * 220}`).join(" ")}" fill="none" stroke="black" stroke-width="3"/>`).join("")}</svg>`;
            const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
            const consentMethod = doc.acceptanceMethod ?? (doc.signature ? "직접 서명" : "체크박스 동의");
            const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(doc.title)}</title><style>body{font:16px/1.6 sans-serif;max-width:800px;padding:24px;margin:auto}p{white-space:pre-wrap;overflow-wrap:anywhere}svg{max-width:600px;width:100%}</style><h1>${escape(doc.title)}</h1><p>문서 버전 ${doc.version}</p><p>${escape(doc.body)}</p><p>동의자: ${escape(doc.signerName ?? data.guardianName ?? "보호자")}\n동의 방식: ${escape(consentMethod)}\n동의 시각: ${escape(doc.signedAt ?? "")}</p>${svg}</html>`;
            const blob = new Blob([html], { type: "text/html;charset=utf-8" });
            const url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = `동의서-${doc.id}-v${doc.version}.html`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}>동의서 내려받기</button></>}
          {!owner && active && doc.status === "pending" && <>
            {signingId !== documentKey ? <button type="button" className={button} onClick={() => { setSigningId(documentKey); setSignature([]); setAgreed(false); }}>동의서 작성</button> : <>
              <label className="grid gap-1">서명자 이름<input className={field} autoComplete="name" value={signerName} maxLength={50} onChange={e => setSignerName(e.target.value)} /></label>
              <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={agreed} onChange={e => setAgreed(e.target.checked)} />위 내용을 읽고 동의합니다.</label>
              <BookingSignaturePad value={signature} onChange={setSignature} disabled={busy} />
              <p className="text-slate-600">서명본은 매장과 보호자가 확인할 수 있도록 보관됩니다.</p>
              <button type="button" className={`${button} !bg-[#1976ff] !text-white`} disabled={busy || !agreed || !signerName.trim() || !signature.length} onClick={() => void act("sign", { templateId: doc.id, templateVersion: doc.version, signerName, signature, agreed })}>서명 완료 및 제출</button>
            </>}
          </>}
        </div>
      </details>})}
    </div>}
    {!owner && showDeposit && <div className="space-y-2 border-t pt-3"><h4 className="font-medium">예약금 요청 알림</h4>
      {result.notificationPreferences?.enabled === false && <p className="text-slate-600">현재 이 매장의 알림톡 전체 수신이 꺼져 있습니다.</p>}
      <label className="flex items-center gap-2"><input type="checkbox" disabled={busy || result.notificationPreferences?.enabled === false} checked={result.notificationPreferences?.deposit ?? true} onChange={e => void act("set_preferences", { deposit: e.target.checked, consent: result.notificationPreferences?.consent ?? true, note: "" })} />예약금 요청 알림</label>
    </div>}
    {data.cancelRequest && <p className="break-words text-amber-800">취소 요청 대기: {data.cancelRequest.reason}</p>}
    {!owner && active && <div className="space-y-2"><label className="grid gap-1">취소 요청 사유<textarea className={`${field} h-auto min-h-[72px] py-2`} value={note} maxLength={2000} onChange={e => setNote(e.target.value)} /></label><button type="button" className={button} disabled={busy || !note.trim()} onClick={() => void act("request_cancel")}>매장에 취소 요청 남기기</button><p className="text-slate-600">매장 처리 전까지 예약은 유지됩니다.</p></div>}
    {owner && hasOwnerActions && <fieldset disabled={busy} className="space-y-3 text-[16px] leading-6 text-[#15213b]">
      {active && <div className="flex flex-wrap gap-2">
        {showDeposit && d.status === "not_requested" && <button type="button" className={button} onClick={() => void act("request_deposit")}>예약금 요청 만들기</button>}
        {result.appointmentStatus === "pending" && !(d.required && !["confirmed", "waived"].includes(d.status)) && <button type="button" className={button} onClick={() => void act("approve")}>예약 승인</button>}
      </div>}
      {!result.ledger && active && d.status === "confirmed" && d.refundedAmount === 0 && <div className="space-y-2"><label className="grid gap-1">정정할 실제 입금액 (원)<input className={field} type="number" min={0} value={amount} onChange={e => setAmount(Number(e.target.value))} /></label><label className="grid gap-1">입금자명<input className={field} value={payerName} onChange={e => setPayerName(e.target.value)} /></label><button type="button" className={button} disabled={busy} onClick={() => { if (!window.confirm("입금 확인 내역을 정정합니다. 필수 예약금이 부족하면 예약이 대기로 돌아갑니다.")) return; const reason = askForReason("입금 정정 사유를 입력해 주세요."); if (reason) void act("correct_deposit", { amount, payerName, note: reason }); }}>잘못된 입금 확인 정정</button></div>}
      {!result.ledger && balance > 0 && <div className="space-y-2"><label className="grid gap-1">실제 반환한 금액 (원)<input className={field} type="number" min={1} max={balance} value={amount} onChange={e => setAmount(Number(e.target.value))} /></label><button type="button" className={button} disabled={busy} onClick={() => { if (!window.confirm("고객에게 실제로 반환한 금액을 기록합니다. 이 버튼으로 이체되지는 않습니다.")) return; const reason = askForReason("환불 기록 사유를 입력해 주세요."); if (reason) void act("refund_record", { amount, note: reason }); }}>계좌 환불 완료 기록</button></div>}
      {result.appointmentStatus === "noshow" && <button type="button" className={button} disabled={busy} onClick={() => { if (!window.confirm("노쇼 기록을 정정하고 예약을 확정 상태로 복원합니다.")) return; const reason = askForReason("노쇼 정정 사유를 입력해 주세요."); if (reason) void act("correct_noshow", { note: reason }); }}>잘못된 노쇼 정정</button>}
      {active && showPreparation && <div className="space-y-2 border-t pt-3"><h4 className="font-medium">보호자에게 보낼 안내</h4><div className="flex flex-wrap gap-3">{showDeposit && <label className="flex items-center gap-2"><input type="checkbox" checked={sendDeposit} disabled={busy || !["pending", "reported"].includes(d.status) || !d.dueAt || Date.parse(d.dueAt) <= Date.now()} onChange={e => setSendDeposit(e.target.checked)} />예약금 요청</label>}{showConsent && <label className="flex items-center gap-2"><input type="checkbox" checked={sendConsent} disabled={busy || !data.consents.some(c => c.status === "pending")} onChange={e => setSendConsent(e.target.checked)} />동의서 요청</label>}</div><div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={busy || (!sendConsent && !sendDeposit)} onClick={() => void act("request_guidance", { consent: showConsent && sendConsent, deposit: showDeposit && sendDeposit })}>선택한 안내 알림톡 보내기</button></div></div>}
    </fieldset>}
    {message && <p role="status" className="break-words text-[16px] text-slate-600">{message}</p>}
  </section>;
}
