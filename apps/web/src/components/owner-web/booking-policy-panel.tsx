"use client";
import { useEffect, useState, type ReactNode } from "react";
import { DEFAULT_BOOKING_CONSENT_ID, DEFAULT_BOOKING_POLICY, NEXT_BOOKING_RULE_LABELS, type BookingPolicy, type NextBookingRule } from "@petmanager/shared/contracts/booking-preparation";
import { fetchApiJsonWithAuth } from "@/lib/api";
const field = "h-10 w-full rounded-[8px] border border-slate-300 bg-white px-3 text-[16px] outline-none focus:ring-2 focus:ring-blue-200";
type ConsentDraft = { templateId: string | null; title: string; body: string };
const LEGACY_DEFAULT_CONSENT_BODY = `보호자는 반려동물의 질병과 과거 병력, 알레르기, 복용 중인 약, 피부·관절 상태, 최근 치료 여부를 미용 전에 정확히 알려주세요. 특히 노령이거나 기저질환이 있는 경우 미용 중 스트레스나 컨디션 변화가 생길 수 있으므로 관련 정보를 충분히 전달해 주세요.

입질, 공격성, 특정 부위를 만질 때의 거부 반응, 분리 불안 등 안전에 영향을 줄 수 있는 행동 특성도 미리 알려주세요. 미용사는 반려동물의 안전과 상태를 우선하며, 위험이 있다고 판단하면 요청한 미용을 조정하거나 중단하고 보호자에게 안내할 수 있습니다.

미용 중 이상 징후나 응급 상황이 발생하면 보호자에게 연락합니다. 긴급한 경우에는 반려동물의 안전을 위해 필요한 조치를 먼저 할 수 있으며, 이후 보호자에게 상황과 조치 내용을 알립니다. 진료 비용은 발생 원인과 책임을 확인해 별도로 협의합니다.

피모 상태나 미용 난이도에 따라 시간 또는 비용이 달라질 수 있습니다. 추가 비용이나 요청 내용 변경이 필요한 경우 보호자에게 먼저 안내하고 동의를 받은 뒤 진행합니다.

미용 후 평소와 다른 증상이나 상처가 발견되면 매장에 알려주세요. 보호자는 위 내용을 확인했으며 반려동물의 건강 및 행동 정보를 정확히 전달했음을 확인합니다.`;
const PREVIOUS_DEFAULT_CONSENT_TITLE = "반려동물 미용 사전 안내 및 동의서";
const PREVIOUS_DEFAULT_CONSENT_BODY = `1. 건강 상태와 주의사항
보호자는 반려동물의 질병과 과거 병력, 알레르기, 복용 중인 약, 피부·귀·눈·관절 상태, 최근 치료나 수술 여부를 미용 전에 정확히 알려주세요. 슬개골 탈구, 디스크, 백내장, 치주염, 관절염, 당뇨병, 심장질환 등 노령화나 기저질환과 관련된 정보도 빠짐없이 전달해 주세요.

2. 노령·질환이 있는 반려동물
노령이거나 질환이 있는 반려동물은 미용 과정에서 스트레스가 커지거나 기존 증상이 달라질 수 있습니다. 보호자와 미용사는 반려동물의 상태와 안전을 고려해 미용 방법과 범위를 상의합니다. 안전상 진행이 어렵다고 판단되면 미용을 조정하거나 중단할 수 있으며, 이때 진행된 서비스의 비용과 예약금은 사전 안내·합의 및 관련 기준에 따라 정산합니다.

3. 행동 특성과 안전한 미용
입질·공격성, 특정 부위를 만질 때의 거부 반응, 큰 소리에 대한 불안, 분리 불안 등 미용 중 안전에 영향을 줄 수 있는 행동을 미리 알려주세요. 미용사는 반려동물의 상태를 살피며, 무리라고 판단하면 보호자에게 알리고 미용 방법이나 범위를 조정하거나 작업을 중단할 수 있습니다.

4. 털 상태·요청 범위와 추가 비용
털의 엉킴·오염·모질·모량, 반려동물의 협조 정도에 따라 예상 시간과 결과가 달라질 수 있습니다. 미용 중 요청 범위 변경이나 추가 작업이 필요한 경우 사유와 추가 비용을 먼저 안내하고 보호자의 동의를 받은 뒤 진행합니다. 동의하지 않은 추가 작업은 진행하지 않습니다.

5. 미용 중 이상 상황과 응급 조치
미용 중 이상 징후가 있으면 보호자에게 먼저 연락해 상태와 대응 방법을 상의합니다. 응급 상황에서 연락이 닿지 않고 기다리는 것이 반려동물의 안전을 위협할 수 있으면, 안전을 위해 필요한 범위에서 가까운 동물병원에 도움을 요청할 수 있습니다. 매장은 조치 내용과 비용을 보호자에게 가능한 한 빨리 알립니다. 진료비와 책임은 실제 경위, 사전 협의 및 관련 법령에 따라 확인합니다.

6. 미용 후 상태 확인
미용 후 평소와 다른 증상이나 상처를 발견하면 매장에 가능한 한 빨리 알려주시고, 필요한 경우 동물병원 진료를 받아주세요. 증상의 원인과 책임은 미용 전 상태, 미용 과정의 기록과 진료 소견 등 구체적인 사실을 확인해 판단합니다. 이 동의만으로 어느 한쪽의 법적 책임을 미리 면제하거나 확정하지 않습니다.

7. 반려동물 픽업과 돌봄
미용이 끝나면 매장에서 안내한 시간에 반려동물을 데려가 주세요. 픽업이 늦어질 경우 매장에 연락해 주세요. 사전에 안내하고 합의한 경우 실제 돌봄에 필요한 비용이 발생할 수 있습니다. 연락이 되지 않거나 장시간 픽업이 어려운 상황에서는 매장이 보호자와 비상 연락처로 연락하고, 필요한 경우 관계 기관에 문의하는 등 관련 절차에 따라 대응합니다.

보호자는 위 내용을 읽고 이해했으며, 반려동물의 건강 상태와 행동 특성을 사실대로 알리고 미용 중 안전을 위해 매장과 필요한 사항을 상의하는 데 동의합니다. 이 동의서는 미용 진행과 안전 확인을 위한 문서입니다. 사진·영상의 홍보 활용 및 별도의 개인정보 이용 동의는 포함하지 않으며, 필요한 경우 별도로 선택해 동의합니다.`;
const DEFAULT_CONSENT_TEMPLATE: BookingPolicy["templates"][number] = {
  id: DEFAULT_BOOKING_CONSENT_ID,
  version: 1,
  title: "기본 동의서",
  body: `본 매장은 미용사와 반려동물의 안전을 위해 미용 서비스와 관련된 주의사항과 미용 요청자의 의무 및 책임 사항을 안내하며 다음 내용들에 대해 동의받습니다.

미용 요청자는 반려동물의 슬개골 탈구, 디스크 등 질병 정보를 미용사에게 정확하게 전달해야 합니다.

본 매장은 질병이 있는 반려동물의 미용을 중단할 수 있으며, 질병으로 인한 미용 중단에 따른 미용비 환불은 불가능합니다.

본 매장은 미용사에게 사전 고지되지 않은 질병으로 인해 발생하는 사고 및 상해에 대해 책임지지 않으며 치료비를 부담하지 않습니다.

백내장, 치주염, 관절염, 당뇨병, 심장질환 등 노령화에 따라 발생하는 질병을 가진 반려동물에게 미용은 쇼크 및 스트레스의 원인이 될 수 있으며, 관절에 무리가 오거나 일시적으로 다리를 절 수 있습니다.

노령화가 진행된 반려동물의 미용 요청자는 미용 시 발생할 수 있는 사고에 대해 충분히 인지해야 하며, 이와 관련된 사고에 대해 본 매장은 책임지지 않습니다.

미용 중 응급 처치 및 치료가 필요한 상황이 되면 미용 요청자에게 연락 및 동의 없이 근처 동물병원에서 응급 처치 및 치료를 우선으로 실시할 수 있습니다. 이때, 미용사 귀책 사유가 아닌 치료비에 대해 본 매장은 치료비를 부담하지 않습니다.

미용 요청자는 반려동물의 입질 여부, 만지면 싫어하는 부위 등 미용 거부 행동과 관련된 정보를 미용사에게 정확하게 전달해야 합니다.

본 매장은 미용 거부 행동을 보이는 반려동물의 미용은 안전을 위해 진행하지 않으며, 미용 거부로 인한 미용 중단에 따른 미용비 환불은 불가능합니다.

미용 요청자는 사전 고지되지 않은 반려동물의 미용 거부 행동으로 인해 발생하는 미용사의 상해에 대해 치료비를 지급해야 합니다.

본 매장은 미용사의 귀책 사유, 미용 도구로 인한 외상을 제외한 증상 및 상해에 대해 책임지지 않습니다.

미용사가 상담 과정에서 예상 미용 가격을 미용 요청자에게 전달했어도, 반려동물의 피모 상태(모질, 모량, 오염), 미용 거부(입질, 사나움), 미용 요청자의 단순 변심(스타일 변경, 길이 변경)으로 인해 추가 비용이 발생할 수 있으며, 미용 요청자는 추가 비용에 대해 지불해야 할 책임이 있습니다.

미용 후 연락 없이 7일 이상 반려동물을 데리러 오지 않을 경우 유기로 간주하여 관할 동물 보호소로 이송될 수 있으며, 7일 이내에 반려동물을 데리고 갈 때 돌봄 기간만큼 비용이 청구됩니다.

본 매장은 고객 관리, 계약서 작성 등의 서비스 제공을 위해 개인정보를 수집합니다.

미용 요청자는 위 내용과 미용 요청자의 의무 및 책임을 모두 확인했으며, 미용사 귀책 사유가 아닌 문제에 대해 본 매장이 책임지지 않는 것에 동의합니다.`,
  required: true,
  scope: "pet",
  enabled: true,
  audience: "unsigned",
};
function ensureDefaultConsent(policy: BookingPolicy): BookingPolicy {
  const templates = policy.templates ?? [];
  const existing = templates.find(t => t.id === DEFAULT_CONSENT_TEMPLATE.id);
  if (!existing) return { ...policy, templates: [...templates, DEFAULT_CONSENT_TEMPLATE] };
  if (existing.archivedAt) return { ...policy, templates: templates.map(t => t.id === existing.id ? { ...t, archivedAt: undefined } : t) };
  if (existing.title === PREVIOUS_DEFAULT_CONSENT_TITLE && (existing.body === LEGACY_DEFAULT_CONSENT_BODY || existing.body === PREVIOUS_DEFAULT_CONSENT_BODY)) {
    return { ...policy, templates: templates.map(t => t.id === existing.id ? { ...DEFAULT_CONSENT_TEMPLATE, version: t.version } : t) };
  }
  return { ...policy, templates };
}
function Label({ title, children }: { title: string; children: ReactNode }) { return <label className="grid min-w-0 gap-2 text-[16px]"><span className="text-slate-600">{title}</span>{children}</label>; }
export default function BookingPolicyPanel({ shopId, editable = true }: { shopId: string; editable?: boolean }) {
  const [policy, setPolicy] = useState<BookingPolicy>(() => ensureDefaultConsent(DEFAULT_BOOKING_POLICY)), [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false), [loaded, setLoaded] = useState(false), [message, setMessage] = useState("");
  const [tab, setTab] = useState("deposit");
  const [consentDraft, setConsentDraft] = useState<ConsentDraft | null>(null);
  const [selectedConsentId, setSelectedConsentId] = useState<string | null>(null);
  useEffect(() => { let active = true; setLoaded(false); fetchApiJsonWithAuth<{ policy: BookingPolicy; version: number }>(`/api/owner/booking-policy?shopId=${encodeURIComponent(shopId)}`).then(r => { if (active) { const nextPolicy = ensureDefaultConsent(r.policy); setPolicy(nextPolicy); setVersion(r.version); setLoaded(true); setMessage(""); const first = nextPolicy.templates[0]; setSelectedConsentId(first?.id ?? null); setConsentDraft(first ? { templateId: first.id, title: first.title, body: first.body } : null); } }).catch(e => { if (active) setMessage(e.message); }); return () => { active = false; }; }, [shopId]);
  function change<K extends keyof BookingPolicy>(key: K, value: BookingPolicy[K]) { setPolicy(p => ({ ...p, [key]: value })); setMessage(""); }
  async function save(nextPolicy: BookingPolicy = policy): Promise<boolean> {
    setBusy(true); setMessage("");
    try { const r = await fetchApiJsonWithAuth<{ policy: BookingPolicy; version: number }>("/api/owner/booking-policy", { method: "PUT", body: JSON.stringify({ shopId, policy: nextPolicy, version }), headers: { "Content-Type": "application/json" } }); setPolicy(ensureDefaultConsent(r.policy)); setVersion(r.version); setMessage(""); return true; }
    catch (e) { setMessage(e instanceof Error ? e.message : "저장하지 못했습니다."); return false; } finally { setBusy(false); }
  }
  async function saveConsentDraft() {
    if (!consentDraft) return;
    const title = consentDraft.title.trim(), body = consentDraft.body.trim();
    if (!title || !body) { setMessage("동의서 제목과 내용을 입력해 주세요."); return; }
    const templateId = consentDraft.templateId ?? crypto.randomUUID();
    const nextPolicy: BookingPolicy = consentDraft.templateId
      ? { ...policy, templates: policy.templates.map(t => t.id === consentDraft.templateId ? { ...t, title, body } : t) }
      : { ...policy, templates: [...policy.templates, { id: templateId, version: 1, title, body, required: true, scope: "pet", enabled: true }] };
    if (await save(nextPolicy)) { setSelectedConsentId(templateId); setConsentDraft({ templateId, title, body }); }
  }
  function consentDraftHasUnsavedChanges() {
    if (!consentDraft) return false;
    if (!consentDraft.templateId) return Boolean(consentDraft.title.trim() || consentDraft.body.trim());
    const saved = policy.templates.find(t => t.id === consentDraft.templateId);
    return !saved || consentDraft.title !== saved.title || consentDraft.body !== saved.body;
  }
  function selectConsentTemplate(template: BookingPolicy["templates"][number]) {
    if (consentDraftHasUnsavedChanges() && !window.confirm("저장하지 않은 수정 내용이 있어요. 버리고 다른 동의서로 이동할까요?")) return;
    setSelectedConsentId(template.id);
    setConsentDraft({ templateId: template.id, title: template.title, body: template.body });
    setMessage("");
  }
  function startNewConsent() {
    if (consentDraftHasUnsavedChanges() && !window.confirm("저장하지 않은 수정 내용이 있어요. 버리고 새 동의서를 작성할까요?")) return;
    setMessage("");
    setSelectedConsentId(null);
    setConsentDraft({ templateId: null, title: "", body: "" });
  }
  function cancelConsentEdit() {
    if (consentDraftHasUnsavedChanges() && !window.confirm("저장하지 않은 수정 내용이 있어요. 취소할까요?")) return;
    const template = policy.templates.find(t => t.id === selectedConsentId) ?? policy.templates[0];
    if (template) { setSelectedConsentId(template.id); setConsentDraft({ templateId: template.id, title: template.title, body: template.body }); }
    else setConsentDraft(null);
  }
  async function archiveConsentTemplate(templateId: string) {
    const target = policy.templates.find(t => t.id === templateId);
    if (!target || target.id === DEFAULT_BOOKING_CONSENT_ID || target.archivedAt) return;
    const dirty = consentDraftHasUnsavedChanges();
    const prompt = dirty
      ? "저장하지 않은 수정 내용은 버리고 이 양식을 보관할까요? 보관 후 목록에서 복구할 수 있습니다."
      : "이 양식을 보관할까요? 새 예약에서는 제외되며, 보관 목록에서 복구할 수 있습니다.";
    if (!window.confirm(prompt)) return;
    const nextPolicy = { ...policy, templates: policy.templates.map(t => t.id === templateId ? { ...t, archivedAt: new Date().toISOString() } : t) };
    if (await save(nextPolicy)) {
      const fallback = nextPolicy.templates.find(t => t.id === DEFAULT_BOOKING_CONSENT_ID) ?? nextPolicy.templates.find(t => !t.archivedAt);
      setSelectedConsentId(fallback?.id ?? null);
      setConsentDraft(fallback ? { templateId: fallback.id, title: fallback.title, body: fallback.body } : null);
    }
  }
  async function restoreConsentTemplate(templateId: string) {
    if (consentDraftHasUnsavedChanges() && !window.confirm("저장하지 않은 수정 내용은 버리고 보관된 양식을 복구할까요?")) return;
    const target = policy.templates.find(t => t.id === templateId && t.archivedAt);
    if (!target) return;
    const nextPolicy = { ...policy, templates: policy.templates.map(t => t.id === templateId ? { ...t, archivedAt: undefined } : t) };
    if (await save(nextPolicy)) {
      setSelectedConsentId(target.id);
      setConsentDraft({ templateId: target.id, title: target.title, body: target.body });
    }
  }
  const activeConsentTemplates = policy.templates.filter(t => !t.archivedAt);
  const archivedConsentTemplates = policy.templates.filter(t => Boolean(t.archivedAt));
  return <section className={`space-y-3 text-[16px] text-[#15213b] ${tab === "consent" ? "xl:flex xl:min-h-0 xl:flex-1 xl:flex-col" : ""}`}>
    <div className="-mx-3 -mt-1 shrink-0 rounded-t-[13px] rounded-b-none border-b border-[#e1e4ea] bg-white/90 px-3 py-3 backdrop-blur sm:-mx-5 sm:px-5">
      <div className="no-scrollbar flex min-h-[54px] min-w-0 items-center gap-1 overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-[14px] border border-[#d8dce3] bg-[#eef1f5] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="예약 관리 설정">{[["deposit", "예약금"], ["consent", "동의서 관리"], ["noshow", "취소·노쇼"]].map(([id, title]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`inline-flex h-10 shrink-0 items-center rounded-full px-4 text-[16px] font-medium leading-6 outline-none transition focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 ${tab === id ? "bg-white text-[#2f6bd4] shadow-[0_1px_2px_rgba(15,23,42,0.08)]" : "text-[#646a74] hover:bg-white/70 hover:text-[#181b21]"}`}>{title}</button>)}</div>
    </div>
    <div className={`px-5 pt-3 ${tab === "consent" ? "space-y-0 pb-0 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col" : "space-y-5 pb-3"}`}>
    <fieldset disabled={!loaded || busy || !editable} className={`min-w-0 space-y-4 disabled:opacity-60 ${tab === "consent" ? "xl:flex xl:min-h-0 xl:flex-1 xl:flex-col" : ""}`}>
      {tab === "deposit" && <>
        <div className="grid gap-4 sm:grid-cols-2"><Label title="예약금 사용"><select className={field} value={policy.depositMode} onChange={e => change("depositMode", e.target.value as BookingPolicy["depositMode"])}><option value="off">사용 안 함</option><option value="optional">예약별 선택</option><option value="required">대상 고객에게 필수</option></select></Label><Label title="적용 고객"><select className={field} value={policy.depositAudience} onChange={e => change("depositAudience", e.target.value as BookingPolicy["depositAudience"])}><option value="all">전체 고객</option><option value="new">첫 방문 고객</option><option value="noshow">노쇼 이력 고객</option></select></Label>
          <Label title="예약금 (원)"><input className={field} type="number" min={1} value={policy.depositAmount} onChange={e => change("depositAmount", Number(e.target.value))} /></Label><Label title="납부 기한 (예약 등록 후 시간)"><input className={field} type="number" min={1} max={720} value={policy.depositDueHours} onChange={e => change("depositDueHours", Number(e.target.value))} /></Label></div>
        <div className="grid gap-4 sm:grid-cols-3">{[["bankName", "은행"], ["bankAccount", "입금 계좌"], ["bankHolder", "예금주"]].map(([key, title]) => <Label key={key} title={title}><input className={field} value={policy[key as "bankName" | "bankAccount" | "bankHolder"]} onChange={e => change(key as "bankName" | "bankAccount" | "bankHolder", e.target.value)} /></Label>)}</div>
        <p className="text-slate-600">계좌이체 예약금은 보호자 입금 신고 후 오너가 실제 입금을 확인합니다. 기한이 지나면 오너가 유지 또는 취소를 결정합니다.</p>
      </>}
      {tab === "consent" && <>
        <div className="space-y-4 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
          <div className="grid min-h-[440px] gap-5 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(250px,0.29fr)_minmax(0,0.71fr)] xl:items-stretch">
            <aside className="flex min-h-[260px] flex-col overflow-hidden rounded-[14px] border border-[#e4e7ec] bg-white">
              <div className="flex min-h-[58px] shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-[#edf0f4] px-4 py-2 sm:px-5">
                <h3 className="font-semibold">동의서 양식</h3>
                <label className={`flex min-w-0 max-w-full flex-wrap items-center gap-x-2 gap-y-1 ${editable && !busy ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}>
                  <span className="text-[14px] font-medium">미용 전 필수 서명</span>
                  <span className={`rounded-full px-2 py-0.5 text-[13px] font-semibold ${policy.consentBeforeStart ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-600"}`}>{policy.consentBeforeStart ? "켜짐" : "꺼짐"}</span>
                  <input type="checkbox" className="peer sr-only" aria-label="미용 전 필수 서명 설정" checked={policy.consentBeforeStart} disabled={busy || !editable} onChange={e => void save({ ...policy, consentBeforeStart: e.target.checked })} />
                  <span aria-hidden="true" className="relative h-7 w-12 shrink-0 rounded-full bg-slate-300 transition-colors after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-[#1976ff] peer-checked:after:translate-x-5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#1976ff] peer-disabled:opacity-50" />
                </label>
              </div>
              <div className="min-h-0 flex-1 divide-y divide-[#edf0f4] overflow-y-auto">
                {activeConsentTemplates.map(t => <div key={t.id} className={`flex items-center gap-3 px-4 py-3 ${selectedConsentId === t.id ? "bg-[#f5f4ff]" : "hover:bg-slate-50"}`}>
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => selectConsentTemplate(t)}><span className="block truncate font-medium">{t.title || "제목 없는 동의서"}</span></button>
                  <label className="flex shrink-0 items-center gap-2 text-[14px] text-slate-600"><input type="checkbox" checked={t.enabled} disabled={busy || !editable} onChange={e => void save({ ...policy, templates: policy.templates.map(x => x.id === t.id ? { ...x, enabled: e.target.checked } : x) })} />사용</label>
                </div>)}
                {activeConsentTemplates.length === 0 && <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-4 px-5 text-center text-slate-500"><p>사용 중인 동의서가 없어요.<br />새 양식을 등록하거나 보관한 양식을 복구해 주세요.</p><button type="button" className="h-11 rounded-[9px] bg-[#1976ff] px-4 text-white" onClick={startNewConsent}>＋ 동의서 추가</button></div>}
                {archivedConsentTemplates.length > 0 && <details className="border-t border-[#edf0f4] px-4 py-3"><summary className="cursor-pointer text-[14px] font-medium text-slate-600">보관한 동의서</summary><div className="mt-2 divide-y divide-[#edf0f4]">{archivedConsentTemplates.map(t => <div key={t.id} className="flex items-center gap-3 py-3"><span className="min-w-0 flex-1 truncate text-[14px] text-slate-600">{t.title}</span><button type="button" disabled={!editable || busy} className="h-9 shrink-0 rounded-[8px] border border-slate-300 bg-white px-3 text-[14px]" onClick={() => void restoreConsentTemplate(t.id)}>복구</button></div>)}</div></details>}
              </div>
            </aside>
            <section className="flex min-h-[400px] min-w-0 flex-col overflow-hidden rounded-[14px] border border-[#e4e7ec] bg-white xl:h-full xl:min-h-0">
              <header className="flex h-auto min-h-[58px] shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#edf0f4] px-4 py-2 sm:h-[58px] sm:min-h-[58px] sm:flex-nowrap sm:gap-3 sm:px-5 sm:py-0">
                <div className="flex min-w-0 items-center gap-3"><h3 className="truncate text-[20px] font-semibold">{consentDraft?.templateId ? (consentDraft.templateId === DEFAULT_CONSENT_TEMPLATE.id ? "기본 동의서 수정" : "동의서 수정") : "새 동의서 작성"}</h3><span className="shrink-0 rounded-[7px] bg-[#e9f7ef] px-2.5 py-1 text-[14px] font-medium text-[#16834a]">{consentDraft?.templateId === DEFAULT_CONSENT_TEMPLATE.id ? "기본 양식" : "직접 작성"}</span></div>
                <button type="button" disabled={activeConsentTemplates.length >= 20 || !editable || busy} className="h-9 shrink-0 rounded-[8px] bg-[#1976ff] px-4 text-[14px] font-medium text-white disabled:opacity-50" onClick={startNewConsent}>＋ 등록</button>
              </header>
              {consentDraft ? <>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5 sm:py-4">
                  <label className="grid grid-cols-[52px_minmax(0,1fr)] items-center gap-3 text-[16px] font-medium"><span>제목:</span><input aria-label="동의서 제목" className="h-[48px] w-full min-w-0 rounded-[9px] border border-[#e1e4ea] bg-white px-4 text-[16px] font-normal outline-none focus:border-[#1976ff] focus:ring-2 focus:ring-[#1976ff]/15" placeholder="동의서 제목을 입력해 주세요." value={consentDraft.title} maxLength={100} onChange={e => setConsentDraft({ ...consentDraft, title: e.target.value })} /></label>
                  <label className="grid min-h-0 grid-cols-[52px_minmax(0,1fr)] items-start gap-3 text-[16px] font-medium"><span className="pt-3">본문:</span><textarea aria-label="동의서 본문" className="h-[300px] min-h-[260px] w-full min-w-0 resize-none rounded-[9px] border border-[#e1e4ea] bg-white px-4 py-3 text-[16px] font-normal leading-7 outline-none focus:border-[#1976ff] focus:ring-2 focus:ring-[#1976ff]/15 sm:h-[376px] sm:min-h-[300px]" placeholder="동의서 내용을 입력해 주세요." value={consentDraft.body} maxLength={12000} onChange={e => setConsentDraft({ ...consentDraft, body: e.target.value })} /></label>
                  {consentDraft.templateId === DEFAULT_CONSENT_TEMPLATE.id && <button type="button" className="text-left text-[14px] font-medium text-[#1976ff] underline underline-offset-2" onClick={() => { if (window.confirm("현재 기본 동의서 편집 내용을 표준 문안으로 바꿀까요? 변경 후 저장을 눌러야 반영됩니다.")) setConsentDraft({ ...consentDraft, title: DEFAULT_CONSENT_TEMPLATE.title, body: DEFAULT_CONSENT_TEMPLATE.body }); }}>표준 문안으로 복원</button>}
                </div>
                <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-[#edf0f4] bg-white px-4 py-3 sm:px-5"><div>{consentDraft.templateId && consentDraft.templateId !== DEFAULT_BOOKING_CONSENT_ID && <button type="button" disabled={busy || !editable} title="보관 후에도 목록에서 복구할 수 있어요." className="h-10 rounded-[9px] border border-[#e1e4ea] px-4 text-[14px] text-slate-600 disabled:opacity-50" onClick={() => void archiveConsentTemplate(consentDraft.templateId!)}>보관</button>}</div><div className="flex gap-3"><button type="button" disabled={busy} className="h-10 rounded-[9px] border border-[#e1e4ea] bg-white px-4 text-[16px] text-slate-600 disabled:opacity-50" onClick={cancelConsentEdit}>취소</button><button type="button" disabled={busy || !editable || !consentDraft.title.trim() || !consentDraft.body.trim()} className="h-10 rounded-[9px] bg-[#1976ff] px-5 text-[16px] font-medium text-white disabled:opacity-50" onClick={() => void saveConsentDraft()}>{busy ? "저장 중" : "저장"}</button></div></footer>
              </> : <div className="flex flex-1 items-center justify-center text-slate-500">왼쪽에서 동의서를 선택해 주세요.</div>}
            </section>
          </div>
        </div>
      </>}
      {tab === "noshow" && <>
        <Label title="고객 직접 취소 마감 (예약 시작 전 시간)"><input className={field} type="number" min={0} max={720} value={policy.cancellationCutoffHours} onChange={e => change("cancellationCutoffHours", Number(e.target.value))} /></Label>
        <Label title="보호자에게 안내할 취소·환불 정책"><textarea className={`${field} h-auto min-h-[120px] py-3`} value={policy.cancellationNotice} onChange={e => change("cancellationNotice", e.target.value)} /></Label>
        <div className="grid gap-4 sm:grid-cols-2">{[["firstNoshowRule", "노쇼 1회 이후"], ["repeatNoshowRule", "노쇼 2회 이상 이후"]].map(([key, title]) => <Label key={key} title={title}><select className={field} value={policy[key as "firstNoshowRule" | "repeatNoshowRule"]} onChange={e => change(key as "firstNoshowRule" | "repeatNoshowRule", e.target.value as NextBookingRule)}>{Object.entries(NEXT_BOOKING_RULE_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Label>)}</div>
        <p className="text-slate-600">정상 취소와 미납 취소는 노쇼로 집계하지 않습니다. 예약금 환불은 실제 반환 후 별도로 기록합니다.</p>
      </>}
    </fieldset>
    <div className="flex flex-wrap items-center gap-3">{tab !== "consent" && <button type="button" disabled={!loaded || busy || !editable} onClick={() => void save()} className="h-10 rounded-[8px] bg-[#1976ff] px-5 text-white disabled:opacity-50">{busy ? "저장 중" : "정책 저장"}</button>}{message && <p role="status" className="min-w-0 text-[16px] text-slate-600">{message}</p>}</div>
    </div>
  </section>;
}
