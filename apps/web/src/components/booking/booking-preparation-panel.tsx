"use client";
import { useCallback, useEffect, useState } from "react";
import { DEPOSIT_STATUS_LABELS, NEXT_BOOKING_RULE_LABELS, type NextBookingRule, type PreparationResponse, type SignaturePoint } from "@petmanager/shared/contracts/booking-preparation";
import BookingSignaturePad, { SignaturePreview } from "@petmanager/shared/components/booking-signature-pad";
import { fetchApiJson, fetchApiJsonWithAuth } from "@/lib/api";
const button = "h-10 rounded-[8px] border border-slate-300 bg-white px-3 text-[16px] disabled:opacity-50";
const field = "h-10 min-w-0 w-full rounded-[8px] border border-slate-300 bg-white px-3 text-[16px]";
export default function BookingPreparationPanel({ shopId, appointmentId, accessToken, onStatusChanged }: {
  shopId: string; appointmentId: string; accessToken?: string; onStatusChanged?: () => void;
}) {
  const owner = !accessToken, endpoint = owner ? "/api/owner/booking-preparation" : "/api/customer-booking-preparation";
  const [result, setResult] = useState<PreparationResponse | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [payerName, setPayerName] = useState(""), [amount, setAmount] = useState(0), [note, setNote] = useState("");
  const [signerName, setSignerName] = useState(""), [signature, setSignature] = useState<SignaturePoint[][]>([]), [agreed, setAgreed] = useState(false), [signingId, setSigningId] = useState("");
  const [sendConsent, setSendConsent] = useState(true), [sendDeposit, setSendDeposit] = useState(false);
  const [nextRule, setNextRule] = useState<NextBookingRule>("normal");
  const [addTemplateId, setAddTemplateId] = useState("");
  const [cancellationKind, setCancellationKind] = useState("owner");
  const load = useCallback(async () => {
    const q = new URLSearchParams({ shopId, appointmentId }); if (accessToken) q.set("t", accessToken);
    const response = await (owner ? fetchApiJsonWithAuth<PreparationResponse>(`${endpoint}?${q}`) : fetchApiJson<PreparationResponse>(`${endpoint}?${q}`));
    return response;
  }, [shopId, appointmentId, accessToken, owner, endpoint]);
  useEffect(() => { let active = true; setResult(null); setMessage(""); setSigningId(""); setSignature([]); setAgreed(false);
    load().then(r => { if (active) { setResult(r); setPayerName(r.data.deposit.payerName); setAmount(r.data.deposit.receivedAmount || r.data.deposit.amount); setNextRule(r.nextBookingRule ?? "normal"); setSendConsent(r.data.consents.some(c => c.status === "pending")); setSendDeposit(false); } }).catch(e => { if (active) setMessage(e.message); }); return () => { active = false; };
  }, [load]);
  async function act(action: string, extra: Record<string, unknown> = {}) {
    if (!result || busy) return; setBusy(true); setMessage("");
    try {
      const body = JSON.stringify({ shopId, appointmentId, accessToken, version: result.version, action, note, ...extra });
      const next = await (owner ? fetchApiJsonWithAuth<PreparationResponse>(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body }) : fetchApiJson<PreparationResponse>(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body }));
      setResult(next); setNextRule(next.nextBookingRule ?? "normal"); setSigningId(""); setSignature([]); setAgreed(false);
      if (action === "request_deposit") setSendDeposit(false);
      setMessage(action === "request_guidance" ? next.data.requests.at(-1)?.reason ?? "요청을 확인해 주세요." : "처리했습니다.");
      if (["cancel", "noshow", "correct_noshow", "approve"].includes(action)) onStatusChanged?.();
    } catch (e) { setMessage(e instanceof Error ? e.message : "처리하지 못했습니다."); } finally { setBusy(false); }
  }
  async function copyLink() {
    if (!result?.manageUrl) return;
    try { await navigator.clipboard.writeText(new URL(result.manageUrl, location.origin).toString()); setMessage("예약 확인 링크를 복사했습니다."); }
    catch { setMessage("링크를 복사하지 못했습니다. 브라우저 권한을 확인해 주세요."); }
  }
  if (!result) return <section className="space-y-2 border-t py-4 text-[16px]"><p role="status" className="text-slate-600">{message || "예약 준비를 불러오는 중입니다."}</p>{owner && message.includes("이 예약에는") && <button type="button" className={button} disabled={busy} onClick={async () => {
    setBusy(true); try { setResult(await fetchApiJsonWithAuth<PreparationResponse>(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shopId, appointmentId, action: "initialize" }) })); setMessage(""); } catch (e) { setMessage(e instanceof Error ? e.message : "요청을 만들지 못했습니다."); } finally { setBusy(false); }
  }}>이 예약에 동의서·예약금 요청 추가</button>}</section>;
  const { data } = result, d = data.deposit, active = ["pending", "confirmed"].includes(result.appointmentStatus);
  const balance = d.receivedAmount - d.refundedAmount;
  return <section className="min-w-0 space-y-4 border-t py-4 text-[16px] leading-6 text-[#15213b]" aria-label="예약금 및 동의서 관리">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-[20px] font-semibold">예약 준비</h3><button type="button" className={button} disabled={busy} onClick={() => void load().then(setResult).catch(e => setMessage(e.message))}>새로고침</button></div>
    <div className="space-y-2"><div className="flex flex-wrap justify-between gap-2"><span>예약금 · {DEPOSIT_STATUS_LABELS[d.status]}</span><span>{d.amount.toLocaleString()}원{d.required ? " · 필수" : ""}</span></div>
      {d.status !== "not_requested" && <>
        <p className="break-all text-slate-600">{data.policy.bankName} {data.policy.bankAccount} · {data.policy.bankHolder}</p>
        {d.dueAt && <p className="text-slate-600">납부 기한: {new Date(d.dueAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}{Date.parse(d.dueAt) < Date.now() && ["pending", "reported"].includes(d.status) ? " · 기한 경과" : ""}</p>}
      </>}
      {d.receivedAmount > 0 && <p>입금 확인 {d.receivedAmount.toLocaleString()}원 · 환불 {d.refundedAmount.toLocaleString()}원 · 기납부 잔액 {balance.toLocaleString()}원</p>}
      {result.remainingAmount != null && <p>서비스 금액 {result.serviceAmount?.toLocaleString()}원 · 예약금 차감 후 잔금 {result.remainingAmount.toLocaleString()}원{result.excessDeposit ? ` · 초과 입금 ${result.excessDeposit.toLocaleString()}원` : ""}</p>}
      {d.confirmedAt && <p className="text-slate-600">입금자 {d.payerName} · 확인 {new Date(d.confirmedAt).toLocaleString("ko-KR")}</p>}
      {active && ["pending", "reported"].includes(d.status) && <div className="space-y-2">
        <label className="grid gap-1">입금자명<input className={field} value={payerName} maxLength={50} onChange={e => setPayerName(e.target.value)} /></label>
        {owner ? <><label className="grid gap-1">실제 확인한 입금액 (원)<input className={field} type="number" min={0} value={amount} onChange={e => setAmount(Number(e.target.value))} /></label><button type="button" className={button} disabled={busy} onClick={() => void act("confirm_deposit", { amount, payerName })}>실제 입금 확인 완료</button></> : <><p className="text-slate-600">이체 후 입금자명을 남겨 주세요. 매장에서 실제 입금을 확인하면 완료됩니다.</p><button type="button" className={`${button} !bg-[#1976ff] !text-white`} disabled={busy} onClick={() => void act("report_deposit", { payerName })}>입금했어요</button></>}
      </div>}
    </div>
    <div className="space-y-3"><h4 className="font-medium">동의서</h4>{data.consents.length === 0 && <p className="text-slate-600">요청된 동의서가 없습니다.</p>}
      {owner && active && data.policy.templates.some(t => t.enabled && !t.archivedAt && !data.consents.some(c => c.id === t.id) && !(t.scope === "pet" && result.signedPetConsentIds?.includes(t.id))) && <div className="space-y-2"><select aria-label="추가 요청할 동의서" className={field} value={addTemplateId} onChange={e => setAddTemplateId(e.target.value)}><option value="">동의서 선택</option>{data.policy.templates.filter(t => t.enabled && !t.archivedAt && !data.consents.some(c => c.id === t.id) && !(t.scope === "pet" && result.signedPetConsentIds?.includes(t.id))).map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select><button type="button" className={button} disabled={busy || !addTemplateId} onClick={() => void act("add_consent", { templateId: addTemplateId })}>이 예약에 동의서 요청 추가</button></div>}
      {owner && active && data.policy.templates.some(t => t.enabled && !t.archivedAt && t.scope === "pet" && result.signedPetConsentIds?.includes(t.id) && !data.consents.some(c => c.id === t.id)) && <p className="text-slate-600">이 반려동물은 현재 버전의 동의서에 이미 서명했습니다. 다시 동의가 필요하면 문서를 수정해 새 버전으로 요청해 주세요.</p>}
      {data.consents.map(doc => <details key={doc.id} className="border-b pb-3" open={signingId === doc.id || undefined}>
        <summary className="cursor-pointer break-words">{doc.title} · {doc.status === "signed" ? "작성 완료" : doc.status === "waived" ? "예외 처리" : "작성 대기"}{doc.required ? " · 필수" : " · 선택"}</summary>
        <div className="mt-3 space-y-3"><p className="text-slate-600">버전 {doc.version} · {doc.scope === "pet" ? "반려동물별 1회" : "예약마다 작성"}</p><p className="whitespace-pre-wrap break-words">{doc.body}</p>
          {doc.status === "signed" && <><p>{doc.signerName} · {doc.signedAt && new Date(doc.signedAt).toLocaleString("ko-KR")}</p>{doc.signature && <SignaturePreview value={doc.signature} />}<button type="button" className={button} onClick={() => {
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 220">${(doc.signature ?? []).map(s => `<polyline points="${s.map(p => `${p.x * 600},${p.y * 220}`).join(" ")}" fill="none" stroke="black" stroke-width="3"/>`).join("")}</svg>`;
            const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
            const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(doc.title)}</title><style>body{font:16px/1.6 sans-serif;max-width:800px;padding:24px;margin:auto}p{white-space:pre-wrap;overflow-wrap:anywhere}svg{max-width:600px;width:100%}</style><h1>${escape(doc.title)}</h1><p>문서 버전 ${doc.version}</p><p>${escape(doc.body)}</p><p>서명자: ${escape(doc.signerName ?? "")}\n작성 시각: ${escape(doc.signedAt ?? "")}</p>${svg}</html>`;
            const blob = new Blob([html], { type: "text/html;charset=utf-8" });
            const url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = `동의서-${doc.id}-v${doc.version}.html`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}>동의서 내려받기</button></>}
          {!owner && active && doc.status === "pending" && <>
            {signingId !== doc.id ? <button type="button" className={button} onClick={() => { setSigningId(doc.id); setSignature([]); setAgreed(false); }}>동의서 작성</button> : <>
              <label className="grid gap-1">서명자 이름<input className={field} autoComplete="name" value={signerName} maxLength={50} onChange={e => setSignerName(e.target.value)} /></label>
              <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={agreed} onChange={e => setAgreed(e.target.checked)} />위 내용을 읽고 동의합니다.</label>
              <BookingSignaturePad value={signature} onChange={setSignature} disabled={busy} />
              <p className="text-slate-600">서명본은 매장과 보호자가 확인할 수 있도록 보관됩니다.</p>
              <button type="button" className={`${button} !bg-[#1976ff] !text-white`} disabled={busy || !agreed || !signerName.trim() || !signature.length} onClick={() => void act("sign", { templateId: doc.id, signerName, signature, agreed })}>서명 완료 및 제출</button>
            </>}
          </>}
          {owner && active && doc.status === "pending" && <button type="button" className={button} disabled={busy || !note.trim()} onClick={() => void act("waive_consent", { templateId: doc.id })}>이 예약만 예외 처리</button>}
        </div>
      </details>)}
    </div>
    <p className="whitespace-pre-wrap break-words text-slate-600">{data.policy.cancellationNotice}</p>
    {!owner && <div className="space-y-2 border-t pt-3"><h4 className="font-medium">요청 알림 수신</h4>
      {result.notificationPreferences?.enabled === false && <p className="text-slate-600">현재 이 매장의 알림톡 전체 수신이 꺼져 있습니다.</p>}
      <label className="flex items-center gap-2"><input type="checkbox" disabled={busy || result.notificationPreferences?.enabled === false} checked={result.notificationPreferences?.consent ?? true} onChange={e => void act("set_preferences", { consent: e.target.checked, deposit: result.notificationPreferences?.deposit ?? true, note: "" })} />동의서 요청 알림</label>
      <label className="flex items-center gap-2"><input type="checkbox" disabled={busy || result.notificationPreferences?.enabled === false} checked={result.notificationPreferences?.deposit ?? true} onChange={e => void act("set_preferences", { deposit: e.target.checked, consent: result.notificationPreferences?.consent ?? true, note: "" })} />예약금 요청 알림</label>
    </div>}
    {data.cancelRequest && <p className="break-words text-amber-800">취소 요청 대기: {data.cancelRequest.reason}</p>}
    {!owner && active && <div className="space-y-2"><label className="grid gap-1">취소 요청 사유<textarea className={`${field} h-auto min-h-[72px] py-2`} value={note} maxLength={2000} onChange={e => setNote(e.target.value)} /></label><button type="button" className={button} disabled={busy || !note.trim()} onClick={() => void act("request_cancel")}>매장에 취소 요청 남기기</button><p className="text-slate-600">매장 처리 전까지 예약은 유지됩니다.</p></div>}
    {owner && <fieldset disabled={busy} className="space-y-3">
      <label className="grid gap-1">처리 사유·내부 메모<textarea className={`${field} h-auto min-h-[72px] py-2`} value={note} maxLength={2000} onChange={e => setNote(e.target.value)} /></label>
      {active && <label className="grid gap-1">취소 구분<select className={field} value={data.cancelRequest ? "late_customer" : cancellationKind} onChange={e => setCancellationKind(e.target.value)} disabled={Boolean(data.cancelRequest)}><option value="owner">매장 사정으로 취소</option><option value="customer">고객 요청으로 취소</option><option value="late_customer">취소 마감 후 고객 요청</option></select></label>}
      {active && <div className="flex flex-wrap gap-2">
        {d.status === "not_requested" && <button type="button" className={button} onClick={() => void act("request_deposit")}>예약금 요청 만들기</button>}
        {balance === 0 && <button type="button" className={button} disabled={!note.trim()} onClick={() => void act("waive_deposit")}>예약금 면제</button>}
        {result.appointmentStatus === "pending" && <button type="button" className={button} onClick={() => void act("approve")}>예약 승인</button>}
        <button type="button" className={button} disabled={!note.trim()} onClick={() => { if (window.confirm("예약을 취소하시겠습니까? 입금된 금액은 별도로 환불해야 합니다.")) void act("cancel", { cancellationKind: data.cancelRequest ? "late_customer" : cancellationKind }); }}>예약 취소</button>
        <button type="button" className={button} disabled={!note.trim()} onClick={() => { if (window.confirm("고객이 방문하지 않았는지 확인하셨습니까?")) void act("noshow"); }}>노쇼 처리</button>
      </div>}
      {active && d.status === "confirmed" && d.refundedAmount === 0 && <div className="space-y-2"><label className="grid gap-1">정정할 실제 입금액 (원)<input className={field} type="number" min={0} value={amount} onChange={e => setAmount(Number(e.target.value))} /></label><label className="grid gap-1">입금자명<input className={field} value={payerName} onChange={e => setPayerName(e.target.value)} /></label><button type="button" className={button} disabled={!note.trim()} onClick={() => { if (window.confirm("입금 확인 내역을 정정합니다. 필수 예약금이 부족하면 예약이 대기로 돌아갑니다.")) void act("correct_deposit", { amount, payerName }); }}>잘못된 입금 확인 정정</button></div>}
      {balance > 0 && <div className="space-y-2"><label className="grid gap-1">실제 반환한 금액 (원)<input className={field} type="number" min={1} max={balance} value={amount} onChange={e => setAmount(Number(e.target.value))} /></label><button type="button" className={button} disabled={!note.trim()} onClick={() => { if (window.confirm("고객에게 실제로 반환한 금액을 기록합니다. 이 버튼으로 이체되지는 않습니다.")) void act("refund_record", { amount }); }}>계좌 환불 완료 기록</button></div>}
      <label className="grid gap-1">이 고객의 다음 예약 조건<select className={field} value={nextRule} onChange={e => setNextRule(e.target.value as NextBookingRule)}>{Object.entries(NEXT_BOOKING_RULE_LABELS).map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select></label>
      <div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={!note.trim()} onClick={() => void act("set_condition", { rule: nextRule })}>고객별 예외 저장</button>{result.appointmentStatus === "noshow" && <button type="button" className={button} disabled={!note.trim()} onClick={() => { if (window.confirm("노쇼 기록을 정정하고 예약을 확정 상태로 복원합니다.")) void act("correct_noshow"); }}>잘못된 노쇼 정정</button>}</div>
      <div className="space-y-2 border-t pt-3"><h4 className="font-medium">보호자에게 보낼 안내</h4><div className="flex flex-wrap gap-3"><label className="flex items-center gap-2"><input type="checkbox" checked={sendConsent} disabled={busy || !data.consents.some(c => c.status === "pending")} onChange={e => setSendConsent(e.target.checked)} />동의서 요청</label><span className="text-slate-500">예약금 알림톡은 승인 템플릿 준비 후 사용할 수 있습니다.</span></div><div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={busy || !sendConsent} onClick={() => void act("request_guidance", { consent: sendConsent, deposit: false })}>동의서 요청 알림톡 보내기</button><button type="button" className={button} onClick={() => void copyLink()}>예약 확인 링크 복사</button></div></div>
      {data.history.length > 0 && <details><summary className="cursor-pointer">처리 이력 {data.history.length}건</summary><ul className="mt-2 space-y-2">{data.history.map((h, i) => <li key={i} className="break-words text-slate-600">{new Date(h.at).toLocaleString("ko-KR")} · {({ request_deposit: "예약금 요청", report_deposit: "입금 신고", confirm_deposit: "입금 확인", waive_deposit: "예약금 면제", refund_record: "환불 기록", sign: "동의서 서명", waive_consent: "동의서 예외", cancel: "예약 취소", request_cancel: "취소 요청", noshow: "노쇼 처리", correct_noshow: "노쇼 정정", set_condition: "다음 예약 조건 변경", approve: "예약 승인", request_guidance: "안내 요청" } as Record<string, string>)[h.action] ?? "예약 처리"} {h.note}</li>)}</ul></details>}
    </fieldset>}
    {message && <p role="status" className="break-words text-[16px] text-slate-600">{message}</p>}
  </section>;
}
