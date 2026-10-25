"use client";
import { useEffect, useState } from "react";
import { fetchApiJsonWithAuth } from "@/lib/api";
import type { ConsentRecord } from "@petmanager/shared/contracts/booking-preparation";
type State = { enabled: boolean; policyVersion: number; documents: ConsentRecord[]; legacyRecognitionRequiresReview?: boolean };
export default function CustomerConsentCard({ shopId, guardianId, petId }: { shopId: string; guardianId: string; petId: string }) {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({ shopId, guardianId, petId });
    void fetchApiJsonWithAuth<State>(`/api/owner/customer-consents?${query}`, { cache: "no-store" })
      .then(value => { if (active) setState(value); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : "동의서 상태를 확인하지 못했습니다."); });
    return () => { active = false; };
  }, [shopId, guardianId, petId]);
  async function recognize(doc: ConsentRecord) {
    if (!state || busy || !window.confirm(`${doc.title} (버전 ${doc.version})과 같은 내용의 동의를 이 고객에게 이미 받았음을 확인하시겠습니까?\n고객 전자서명이 아닌 오너의 기존 동의 인정으로 기록됩니다.`)) return;
    setBusy(true); setError("");
    try {
      setState(await fetchApiJsonWithAuth<State>("/api/owner/customer-consents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shopId, guardianId, petId, policyVersion: state.policyVersion, templateId: doc.id, templateVersion: doc.version, confirmedExistingConsent: true }) }));
    } catch (e) { setError(e instanceof Error ? e.message : "기존 동의 인정을 저장하지 못했습니다."); }
    finally { setBusy(false); }
  }
  if (!error && (!state || !state.enabled || !state.documents.length)) return null;
  return <section aria-label="고객 동의서" className="mt-3 space-y-2 rounded-[10px] border border-[#e2e8f0] p-3 text-[14px] text-[#475569]">
    <h3 className="text-[16px] font-semibold text-[#15213b]">미용 동의서</h3>
    {state?.legacyRecognitionRequiresReview && <p className="text-[#64748b]">이전 이관 인정 기록은 있지만 현재 문서에 대한 확인이 필요합니다. 기존에 받은 문서를 확인한 뒤 인정해 주세요.</p>}
    {state?.documents.map(doc => <details key={`${doc.id}:${doc.version}`} className="border-b border-[#eef1f4] pb-2 last:border-0">
      <summary className="min-h-11 cursor-pointer py-2">{doc.title} · {doc.status === "signed" ? "전자서명 완료" : doc.status === "recognized" ? "기존 동의 인정" : "동의서 미완료"}</summary>
      <p className="whitespace-pre-wrap break-words leading-6">{doc.body}</p>
      {doc.status === "recognized" && doc.recognizedAt && <p className="mt-2 text-[#64748b]">{doc.recognitionSource === "prior_signature" ? "이전 문서의 전자서명으로 인정" : "오너가 확인한 기존 동의"} · {new Date(doc.recognizedAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}</p>}
      {doc.status === "pending" && (doc.scope === "pet" ? <button type="button" disabled={busy} className="mt-2 min-h-11 rounded-[8px] border border-[#dbe2ea] px-3 disabled:opacity-50" onClick={() => void recognize(doc)}>기존 동의 인정</button> : <p className="mt-2 text-[#64748b]">예약마다 고객이 직접 작성하는 문서입니다.</p>)}
    </details>)}
    {error && <p role="alert" className="text-[#9a5e4e]">{error}</p>}
  </section>;
}
