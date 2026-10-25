"use client";
import BookingDepositPolicyFields from "@/components/booking/booking-deposit-policy-fields";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { publishBookingPolicyChange, subscribeBookingPolicyChange } from "@/lib/booking-policy-events";
import { DEFAULT_BOOKING_CONSENT_ID, DEFAULT_BOOKING_POLICY, NEXT_BOOKING_RULE_LABELS, type BookingPolicy, type NextBookingRule } from "@petmanager/shared/contracts/booking-preparation";
import { fetchApiJsonWithAuth } from "@/lib/api";
import { OWNER_SETTINGS_TAB_HEADER_CLASS, OWNER_SETTINGS_TABBAR_CLASS, OWNER_SETTINGS_TAB_CLASS } from "@/components/owner-web/owner-settings-tab-header";
import { BookingDepositAlimtalkPreview } from "@/components/owner-web/booking-deposit-alimtalk-preview";
const field = "h-10 w-full rounded-[8px] border border-slate-300 bg-white px-3 text-[16px] outline-none focus:ring-2 focus:ring-blue-200";
const policyFooterClass = "flex shrink-0 items-center gap-3 border-t border-[#edf0f4] bg-white px-5 py-3";
const policyCancelButtonClass = "min-h-11 rounded-[10px] border border-[#e1e4ea] bg-white px-4 text-[16px] text-slate-600 disabled:opacity-50";
const policySaveButtonClass = "min-h-11 rounded-[10px] bg-[#1976ff] px-5 text-[16px] font-medium text-white disabled:opacity-50";
const BANK_OPTIONS = ["KB국민은행", "NH농협은행", "신한은행", "우리은행", "하나은행", "IBK기업은행", "카카오뱅크", "토스뱅크", "케이뱅크", "iM뱅크", "부산은행", "경남은행", "대구은행", "광주은행", "전북은행", "제주은행", "수협은행", "새마을금고", "신협", "우체국", "산업은행", "SC제일은행", "한국씨티은행"];
const HANGUL_INITIALS = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
function bankSearchKey(value: string) {
  return [...value.toLowerCase().replace(/[\s_-]/g, "")].map(char => {
    const code = char.charCodeAt(0) - 0xac00;
    return code >= 0 && code <= 11171 ? HANGUL_INITIALS[Math.floor(code / 588)] : char;
  }).join("");
}
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
  const [depositModeSaving, setDepositModeSaving] = useState(false);
  const [depositSetupOpen, setDepositSetupOpen] = useState(false);
  const preparingDeposit = depositSetupOpen && policy.depositMode === "off";
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [tab, setTab] = useState("deposit");
  const [depositSection, setDepositSection] = useState("settings");
  const policyDirty = useRef(false);
  const policyReadVersion = useRef(0);
  const [depositBeforeEdit, setDepositBeforeEdit] = useState<Partial<BookingPolicy> | null>(null);
  const bankPickerRef = useRef<HTMLDivElement>(null);
  const [bankMenuOpen, setBankMenuOpen] = useState(false);
  const [bankActiveIndex, setBankActiveIndex] = useState(0);
  const bankMatches = BANK_OPTIONS.filter(name => bankSearchKey(name).includes(bankSearchKey(policy.bankName)) || name.toLowerCase().includes(policy.bankName.trim().toLowerCase()));
  useEffect(() => {
    if (!bankMenuOpen) return;
    const closeOnOutside = (event: PointerEvent) => { if (!bankPickerRef.current?.contains(event.target as Node)) setBankMenuOpen(false); };
    document.addEventListener("pointerdown", closeOnOutside);
    return () => document.removeEventListener("pointerdown", closeOnOutside);
  }, [bankMenuOpen]);
  useEffect(() => {
    setDepositBeforeEdit(null);
    setDepositSetupOpen(false);
    policyDirty.current = false;
    policyReadVersion.current++;
  }, [shopId]);
  const [consentDraft, setConsentDraft] = useState<ConsentDraft | null>(null);
  const [selectedConsentId, setSelectedConsentId] = useState<string | null>(null);
  const [showReconsentPrompt, setShowReconsentPrompt] = useState(false);
  const depositHoldMinutesExceedsMax = (policy.depositHoldMinutes ?? 20) > 1440;
  useEffect(() => {
    let active = true;
    setLoaded(false);
    setMessage("");
    fetchApiJsonWithAuth<{ policy: BookingPolicy; version: number }>(`/api/owner/booking-policy?shopId=${encodeURIComponent(shopId)}`, { cache: "no-store", signal: AbortSignal.timeout(15_000) })
      .then(r => { if (active) { const nextPolicy = ensureDefaultConsent(r.policy); setPolicy(nextPolicy); setVersion(r.version); setLoaded(true); setMessage(""); const first = nextPolicy.templates[0]; setSelectedConsentId(first?.id ?? null); setConsentDraft(first ? { templateId: first.id, title: first.title, body: first.body } : null); } })
      .catch(e => { if (active) setMessage(e instanceof DOMException && e.name === "TimeoutError" ? "예약 정책을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." : e instanceof Error ? e.message : "예약 정책을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."); });
    return () => { active = false; };
  }, [shopId, loadAttempt]);
  function change<K extends keyof BookingPolicy>(key: K, value: BookingPolicy[K]) {
    policyDirty.current = true;
    if (tab === "deposit") {
      setDepositBeforeEdit(previous => previous && key in previous ? previous : { ...previous, [key]: policy[key] });
    }
    setPolicy(p => ({ ...p, [key]: value })); setMessage("");
  }
  async function save(nextPolicy: BookingPolicy = policy): Promise<boolean> {
    if (tab === "deposit" && (nextPolicy.depositHoldMinutes ?? 20) > 1440) { setMessage("최대 24시간입니다."); return false; }
    setBusy(true); setMessage("");
    try { const r = await fetchApiJsonWithAuth<{ policy: BookingPolicy; version: number }>("/api/owner/booking-policy", { method: "PUT", body: JSON.stringify({ shopId, policy: nextPolicy, version }), headers: { "Content-Type": "application/json" } }); policyReadVersion.current++; setPolicy(ensureDefaultConsent(r.policy)); setVersion(r.version); setDepositBeforeEdit(null); setDepositSetupOpen(false); policyDirty.current = false; publishBookingPolicyChange(shopId); setMessage(""); return true; }
    catch (e) { setMessage(e instanceof Error ? e.message : "저장하지 못했습니다."); return false; } finally { setBusy(false); }
  }
  async function updateDepositMode(nextMode: BookingPolicy["depositMode"]) {
    if (!loaded || busy || !editable || nextMode === policy.depositMode) return;
    if (depositBeforeEdit) {
      setDepositModeSaving(true);
      try { await save({ ...policy, depositMode: nextMode }); }
      finally { setDepositModeSaving(false); }
      return;
    }
    const previousMode = policy.depositMode;
    setBusy(true);
    setDepositModeSaving(true);
    setMessage("");
    setPolicy(current => ({ ...current, depositMode: nextMode }));
    try {
      const result = await fetchApiJsonWithAuth<{ policy: BookingPolicy; version: number }>("/api/owner/booking-policy", {
        method: "PATCH",
        body: JSON.stringify({ shopId, version, depositMode: nextMode }),
        headers: { "Content-Type": "application/json" },
      });
      policyReadVersion.current++;
      setVersion(result.version);
      setPolicy(current => ({ ...current, depositMode: result.policy.depositMode }));
      if (result.policy.depositMode === "off") setDepositSetupOpen(false);
      publishBookingPolicyChange(shopId);
    } catch (error) {
      setPolicy(current => ({ ...current, depositMode: previousMode }));
      setMessage(error instanceof Error ? error.message : "예약금 사용 설정을 저장하지 못했습니다.");
    } finally {
      setDepositModeSaving(false);
      setBusy(false);
    }
  }
  useEffect(() => {
    let active = true;
    const unsubscribe = subscribeBookingPolicyChange(shopId, () => {
      if (!loaded || busy) return;
      const readVersion = ++policyReadVersion.current;
      void fetchApiJsonWithAuth<{ policy: BookingPolicy; version: number }>(`/api/owner/booking-policy?shopId=${encodeURIComponent(shopId)}`, { cache: "no-store" }).then(result => {
        if (!active || readVersion !== policyReadVersion.current || result.version === version) return;
        if (policyDirty.current) { setMessage("다른 화면에서 설정이 변경되었습니다. 입력 내용은 유지됩니다. 최신 설정을 확인한 뒤 저장해 주세요."); return; }
        setPolicy(ensureDefaultConsent(result.policy)); setVersion(result.version); setDepositBeforeEdit(null);
      }).catch(() => { if (active) setMessage("최신 예약금 설정을 확인하지 못했습니다."); });
    });
    return () => { active = false; unsubscribe(); };
  }, [shopId, loaded, busy, version]);
  async function saveConsentDraft(reconsentExisting?: boolean) {
    if (!consentDraft) return;
    const title = consentDraft.title.trim(), body = consentDraft.body.trim();
    if (!title || !body) { setMessage("동의서 제목과 내용을 입력해 주세요."); return; }
    const previous = consentDraft.templateId ? policy.templates.find(t => t.id === consentDraft.templateId) : null;
    const contentChanged = !previous || previous.title !== title || previous.body !== body;
    if (contentChanged && reconsentExisting === undefined) { setShowReconsentPrompt(true); return; }
    const templateId = consentDraft.templateId ?? crypto.randomUUID();
    const replacedTemplateId = consentDraft.templateId ? null : selectedConsentId ?? policy.templates.find(template => template.id === DEFAULT_BOOKING_CONSENT_ID && template.enabled)?.id ?? null;
    const nextPolicy: BookingPolicy = consentDraft.templateId
      ? { ...policy, templates: policy.templates.map(t => t.id === consentDraft.templateId ? { ...t, title, body, required: true, reconsentExisting: reconsentExisting ?? t.reconsentExisting ?? true } : t) }
      : { ...policy, templates: [...policy.templates.map(t => t.id === replacedTemplateId ? { ...t, enabled: false } : t), { id: templateId, previousTemplateId: replacedTemplateId ?? undefined, version: 1, title, body, required: true, scope: "pet", enabled: true, audience: "all", reconsentExisting: reconsentExisting ?? true }] };
    if (await save(nextPolicy)) { setSelectedConsentId(templateId); setConsentDraft({ templateId, title, body }); setShowReconsentPrompt(false); }
  }
  async function setConsentTemplateEnabled(templateId: string, enabled: boolean) {
    await save({ ...policy, templates: policy.templates.map(template => template.id === templateId ? { ...template, enabled } : template) });
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
  return <section className={`space-y-3 text-[16px] text-[#15213b] ${tab !== "noshow" ? "xl:flex xl:min-h-0 xl:flex-1 xl:flex-col" : ""}`}>
    <div className={`${OWNER_SETTINGS_TAB_HEADER_CLASS} -mx-3 -mt-1 sm:-mx-5`}>
      <div className={OWNER_SETTINGS_TABBAR_CLASS} role="tablist" aria-label="예약 관리 설정">{[["deposit", "예약금"], ["consent", "동의서 관리"], ["noshow", "취소·노쇼"]].map(([id, title]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} data-owner-control-size='content' className={OWNER_SETTINGS_TAB_CLASS}>{title}</button>)}</div>
    </div>
    <div data-settings-body-container className={`rounded-[14px] border border-[#e1e4ea] bg-white px-4 py-4 ${tab !== "noshow" ? "space-y-0 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col xl:overflow-hidden" : "space-y-5"}`}>
    {loaded ? <>
    <fieldset disabled={busy || !editable} aria-busy={!loaded && !message} className={`min-w-0 space-y-4 disabled:opacity-100 ${tab !== "noshow" ? "xl:flex xl:min-h-0 xl:flex-1 xl:flex-col" : ""}`}>
      {tab === "deposit" && policy.depositMode === "off" && !depositSetupOpen && <section aria-label="예약금 사용 안내" className="space-y-3 px-3 py-4 text-[16px] leading-6 text-[#15213b]">
        <h3 className="text-[20px] font-semibold leading-7">예약금을 받을까요?</h3>
        <p className="text-slate-600">현재 사용 안 함</p>
        <p className="max-w-[560px] text-slate-600">예약금을 사용하면 처음 오는 고객이나 예약하고 오지 않은 고객에게 예약금을 받을 수 있어요.</p>
        <button type="button" disabled={busy || !editable} onClick={() => { setDepositSection("settings"); setDepositSetupOpen(true); }} className="!min-h-[44px] rounded-[10px] bg-[#111a30] px-4 text-[16px] font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-50">예약금 사용하기</button>
      </section>}
      {tab === "deposit" && (policy.depositMode !== "off" || depositSetupOpen) && <div data-deposit-editor className="grid min-h-[440px] gap-5 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_360px] xl:grid-rows-[minmax(0,1fr)] xl:items-stretch">
        <div className="grid min-h-0 min-w-0 gap-5 lg:grid-cols-[260px_minmax(0,1fr)] xl:h-full xl:items-start">
        <aside className="min-h-0 overflow-hidden rounded-[14px] border border-[#e4e7ec] bg-white xl:h-full">
          <div className="flex h-[58px] min-h-[58px] shrink-0 items-center border-b border-[#edf0f4] px-5">
            <h3 className="font-semibold">예약금 관리</h3>
          </div>
          <nav aria-label="예약금 설정 항목" className="py-0">{[["settings", "예약금 설정"], ["refund", "취소·환불 안내"]].map(([id, title]) => <button key={id} type="button" data-owner-control-size="content" aria-pressed={depositSection === id} onClick={() => setDepositSection(id)} className={`flex h-[48px] min-h-[48px] w-full items-center px-5 py-0 text-left text-[16px] font-medium leading-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 ${depositSection === id ? "bg-[#f5f4ff] text-[#15213b]" : "text-slate-600 hover:bg-slate-50"}`}>{title}</button>)}</nav>
        </aside>
        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[14px] border border-[#e4e7ec] bg-white xl:h-full">
          <header className="flex min-h-[58px] shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#edf0f4] px-5 py-2 xl:h-[58px] xl:flex-nowrap xl:py-0">
            <h3 className="text-[20px] font-semibold leading-7">{depositSection === "settings" ? "예약금 설정" : "취소·환불 안내"}</h3>
            {preparingDeposit ? <span className="text-[14px] text-slate-600">설정 후 사용</span> : <button type="button" role="switch" aria-label="예약금 사용" aria-checked={policy.depositMode !== "off"} aria-busy={depositModeSaving} disabled={busy || !editable} data-owner-control-size="content" onClick={() => void updateDepositMode(policy.depositMode === "off" ? "required" : "off")} className="flex min-h-11 items-center gap-2 rounded-[8px] text-[16px] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-60">
              <span className={`rounded-full px-2 py-1 text-[12px] font-medium leading-4 ${policy.depositMode !== "off" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{policy.depositMode !== "off" ? "켜짐" : "꺼짐"}</span>
              {depositModeSaving && <span role="status" className="text-[13px] font-normal text-slate-500">저장 중</span>}
              <span aria-hidden="true" className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full ${policy.depositMode !== "off" ? "bg-[#1976ff]" : "bg-slate-300"}`}><span className={`h-5 w-5 rounded-full bg-white transition-transform motion-reduce:transition-none ${policy.depositMode !== "off" ? "translate-x-6" : "translate-x-1"}`} /></span>
            </button>}
          </header>
          <fieldset className="m-0 flex min-h-0 min-w-0 flex-1 flex-col border-0 p-0">
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 text-[16px] font-normal leading-6 [&_input]:min-h-11 [&_select]:min-h-11">
          {depositSection === "settings" && <>
            <BookingDepositPolicyFields policy={policy} change={change} />
            <div className="divide-y divide-[#edf0f4] rounded-[14px] bg-[#f8fafc] px-4 sm:px-5 [&>label]:grid [&>label]:min-w-0 [&>label]:items-center [&>label]:gap-2 [&>label]:py-4 sm:[&>label]:grid-cols-[112px_minmax(0,1fr)] sm:[&>label]:gap-4">
              {[['bankHolder', '예금주'], ['bankName', '입금 은행'], ['bankAccount', '입금 계좌']].map(([key, title]) => <label key={key}><span className="text-slate-600">{title}</span>{key === 'bankName' ? <div ref={bankPickerRef} className="relative w-full min-w-0 max-w-[480px]"><span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10.8" cy="10.8" r="6.3"/><path d="m16 16 4 4"/></svg></span><input className={`${field} min-w-0 rounded-[10px] border-[#d7deea] bg-white pl-10 pr-11 shadow-sm transition-colors focus:border-[#1976ff] focus:bg-white focus:ring-4 focus:ring-blue-100`} role="combobox" aria-label="입금 은행" aria-autocomplete="list" aria-expanded={bankMenuOpen} aria-controls="booking-bank-options" placeholder="은행 검색 또는 초성 입력" value={policy.bankName} onFocus={() => setBankMenuOpen(true)} onChange={e => { change('bankName', e.target.value); setBankActiveIndex(0); setBankMenuOpen(true); }} onKeyDown={e => { if (e.key === 'Escape') { setBankMenuOpen(false); return; } if (e.key === 'ArrowDown') { e.preventDefault(); setBankMenuOpen(true); setBankActiveIndex(i => Math.min(i + 1, Math.max(0, bankMatches.length - 1))); } if (e.key === 'ArrowUp') setBankActiveIndex(i => Math.max(0, i - 1)); if (e.key === 'Enter' && bankMenuOpen && bankMatches.length) { e.preventDefault(); change('bankName', bankMatches[bankActiveIndex] ?? bankMatches[0]); setBankMenuOpen(false); } }} /><button type="button" aria-label="은행 목록 열기" aria-expanded={bankMenuOpen} onClick={() => setBankMenuOpen(open => !open)} className="absolute inset-y-0 right-1 flex w-10 items-center justify-center rounded-r-[10px] text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"><svg aria-hidden="true" viewBox="0 0 20 20" className={`h-4 w-4 transition-transform ${bankMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>{bankMenuOpen && <div id="booking-bank-options" role="listbox" className="absolute left-0 right-0 top-full z-30 mt-2 max-h-64 overflow-y-auto rounded-[12px] border border-slate-200 bg-white p-1.5 shadow-[0_12px_32px_rgba(15,23,42,0.14)]">{bankMatches.map((name, index) => <button key={name} type="button" role="option" aria-selected={policy.bankName === name} id={`booking-bank-option-${index}`} onMouseDown={e => e.preventDefault()} onClick={() => { change('bankName', name); setBankMenuOpen(false); }} className={`flex min-h-11 w-full items-center rounded-[9px] px-3 text-left text-[16px] transition-colors ${policy.bankName === name ? 'bg-blue-50 font-medium text-[#1769d2]' : index === bankActiveIndex ? 'bg-slate-50 text-[#15213b]' : 'text-slate-700 hover:bg-slate-50'}`}>{name}{policy.bankName === name && <span aria-hidden="true" className="ml-auto text-[14px] text-[#1769d2]">✓</span>}</button>)}{bankMatches.length === 0 && <div className="px-3 py-3 text-[14px] text-slate-500">일치하는 은행이 없어요. 입력한 이름을 그대로 사용할 수 있어요.</div>}</div>}</div> : <input className={`${field} max-w-[480px]`} placeholder={`${title} 입력`} value={policy[key as 'bankName' | 'bankAccount' | 'bankHolder']} onChange={e => change(key as 'bankName' | 'bankAccount' | 'bankHolder', e.target.value)} />}</label>)}
              <label><span className="text-slate-600">예약금</span><span className="flex min-w-0 items-center gap-3"><input aria-label="예약금 (원)" className={`${field} max-w-[480px]`} type="number" min={1} value={policy.depositAmount} onChange={e => change("depositAmount", Number(e.target.value))} /><span>원</span></span></label>
              <label><span className="text-slate-600">입금 신고 기한</span><span className="flex min-w-0 items-center gap-3"><span className="shrink-0">요청 후</span><input aria-label="입금 신고 기한 (분)" aria-invalid={depositHoldMinutesExceedsMax} aria-describedby={depositHoldMinutesExceedsMax ? "deposit-hold-minutes-error" : undefined} className={`${field} max-w-[160px]`} type="number" min={1} max={1440} step={1} value={policy.depositHoldMinutes ?? 20} onChange={e => change("depositHoldMinutes", Number(e.target.value))} /><span className="shrink-0">분</span></span></label>
            </div>
            {depositHoldMinutesExceedsMax && <p id="deposit-hold-minutes-error" role="alert" className="mt-2 text-[14px] text-[#9a5e4e]">최대 24시간입니다.</p>}
          </>}
          {depositSection === "refund" && <>
            <BookingDepositPolicyFields policy={policy} change={change} refund />
            <Label title="고객 직접 취소 마감 (예약 시작 전 시간)"><input className={field} type="number" min={0} max={720} value={policy.cancellationCutoffHours} onChange={e => change("cancellationCutoffHours", Number(e.target.value))} /></Label>
            <Label title="보호자에게 안내할 취소·환불 정책"><textarea className={`${field} h-auto min-h-[220px] py-3 leading-6`} value={policy.cancellationNotice} onChange={e => change("cancellationNotice", e.target.value)} /></Label>
            <p className="text-[13px] leading-5 text-slate-500">취소·노쇼 메뉴와 같은 설정입니다. 예약금 환불은 실제 반환 후 별도로 기록합니다.</p>
          </>}
          </div>
          </fieldset>
          <footer className={`${policyFooterClass} justify-end`}>
            <button type="button" data-owner-control-size="content" disabled={(!depositBeforeEdit && !preparingDeposit) || busy} onClick={() => { if (depositBeforeEdit) setPolicy(current => ({ ...current, ...depositBeforeEdit })); setDepositBeforeEdit(null); setDepositSetupOpen(false); setMessage(""); }} className={policyCancelButtonClass}>취소</button>
            <button type="button" data-owner-control-size="content" disabled={!loaded || busy || !editable || (!depositBeforeEdit && !preparingDeposit) || depositHoldMinutesExceedsMax} onClick={() => void save(preparingDeposit ? { ...policy, depositMode: "required" } : policy)} className={`${policySaveButtonClass} disabled:cursor-not-allowed`}>{busy ? "저장 중" : preparingDeposit ? "저장하고 사용하기" : "저장"}</button>
          </footer>
        </section>
        </div>
        <div className={`w-full max-w-[360px] justify-self-center xl:h-full xl:min-h-0 xl:max-w-none xl:justify-self-stretch ${policy.depositMode === "off" ? "opacity-50" : ""}`} aria-disabled={policy.depositMode === "off"}>
          <BookingDepositAlimtalkPreview shopId={shopId} policy={policy} loaded={loaded} />
        </div>
      </div>}
      {tab === "consent" && <>
        <div className="grid min-h-[440px] gap-5 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid min-h-[440px] gap-5 xl:min-h-0 xl:grid-cols-[260px_minmax(0,1fr)] xl:items-stretch">
            <aside className="flex min-h-[260px] flex-col overflow-hidden rounded-[14px] border border-[#e4e7ec] bg-white">
              <div className="flex h-[58px] min-h-[58px] shrink-0 items-center justify-between gap-2 border-b border-[#edf0f4] px-4 sm:px-5">
                <h3 className="font-semibold">동의서 양식</h3>
                <button type="button" disabled={activeConsentTemplates.length >= 20 || !editable || busy} className="h-[44px] min-h-[44px] shrink-0 rounded-[14px] bg-[#1976ff] px-2.5 text-[13px] font-medium text-white disabled:opacity-50" onClick={startNewConsent}>＋ 추가</button>
              </div>
              <div className="min-h-0 flex-1 divide-y divide-[#edf0f4] overflow-y-auto">
                {activeConsentTemplates.map(t => <div key={t.id} className={`flex items-center gap-3 px-4 py-3 ${selectedConsentId === t.id ? "bg-[#f5f4ff]" : "hover:bg-slate-50"}`}>
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => selectConsentTemplate(t)}><span className="block truncate font-medium">{t.title || "제목 없는 동의서"}</span></button>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium leading-4 ${t.enabled ? "bg-[#e9f7ef] text-[#1f6b5b]" : "bg-slate-100 text-slate-600"}`}>{t.enabled ? "사용 중" : "미사용"}</span>
                </div>)}
                {activeConsentTemplates.length === 0 && <div className="flex h-full min-h-[220px] flex-col items-center justify-center px-5 text-center text-slate-500"><p>사용 중인 동의서가 없어요.<br />위의 추가 버튼으로 새 양식을 만들 수 있어요.</p></div>}
                {archivedConsentTemplates.length > 0 && <details className="border-t border-[#edf0f4] px-4 py-3"><summary className="cursor-pointer text-[14px] font-medium text-slate-600">보관한 동의서</summary><div className="mt-2 divide-y divide-[#edf0f4]">{archivedConsentTemplates.map(t => <div key={t.id} className="flex items-center gap-3 py-3"><span className="min-w-0 flex-1 truncate text-[14px] text-slate-600">{t.title}</span><button type="button" disabled={!editable || busy} className="h-9 shrink-0 rounded-[8px] border border-slate-300 bg-white px-3 text-[14px]" onClick={() => void restoreConsentTemplate(t.id)}>복구</button></div>)}</div></details>}
              </div>
            </aside>
            <section className="flex min-h-[400px] min-w-0 flex-col overflow-hidden rounded-[14px] border border-[#e4e7ec] bg-white xl:h-full xl:min-h-0">
              <header className="flex h-auto min-h-[58px] shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#edf0f4] px-4 py-2 sm:h-[58px] sm:min-h-[58px] sm:flex-nowrap sm:gap-3 sm:px-5 sm:py-0">
                <div className="flex min-w-0 items-center"><h3 className="truncate text-[20px] font-semibold">{consentDraft?.templateId === DEFAULT_CONSENT_TEMPLATE.id ? "미용 동의서" : consentDraft?.templateId ? policy.templates.find(template => template.id === consentDraft.templateId)?.title || "동의서 수정" : consentDraft ? "새 동의서" : "동의서 양식"}</h3></div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  {consentDraft?.templateId && (() => {
                    const template = policy.templates.find(item => item.id === consentDraft.templateId);
                    if (!template) return null;
                    return <button type="button" role="switch" aria-label={`${template.title} 사용`} aria-checked={template.enabled} disabled={busy || !editable} onClick={() => void setConsentTemplateEnabled(template.id, !template.enabled)} className="flex min-h-11 items-center gap-2 rounded-[8px] text-[14px] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-60">
                      <span className={`rounded-full px-2 py-1 text-[12px] leading-4 ${template.enabled ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{template.enabled ? "켜짐" : "꺼짐"}</span>
                      <span aria-hidden="true" className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full ${template.enabled ? "bg-[#1976ff]" : "bg-slate-300"}`}><span className={`h-5 w-5 rounded-full bg-white transition-transform motion-reduce:transition-none ${template.enabled ? "translate-x-6" : "translate-x-1"}`} /></span>
                    </button>;
                  })()}
                </div>
              </header>
              {consentDraft ? <>
                <div className="no-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5 sm:py-4">
                  <label className="grid grid-cols-[52px_minmax(0,1fr)] items-center gap-3 text-[16px] font-medium"><span>제목:</span><input aria-label="동의서 제목" className="h-[48px] w-full min-w-0 rounded-[9px] border border-[#e1e4ea] bg-white px-4 text-[16px] font-normal outline-none focus:border-[#1976ff] focus:ring-2 focus:ring-[#1976ff]/15" placeholder="동의서 제목을 입력해 주세요." value={consentDraft.title} maxLength={100} onChange={e => setConsentDraft({ ...consentDraft, title: e.target.value })} /></label>
                  <label className="grid min-h-0 grid-cols-[52px_minmax(0,1fr)] items-start gap-3 text-[16px] font-medium"><span className="pt-3">본문:</span><textarea aria-label="동의서 본문" className="no-scrollbar h-[300px] min-h-[260px] w-full min-w-0 resize-none rounded-[9px] border border-[#e1e4ea] bg-white px-4 py-3 text-[16px] font-normal leading-7 outline-none focus:border-[#1976ff] focus:ring-2 focus:ring-[#1976ff]/15 sm:h-[376px] sm:min-h-[300px]" placeholder="동의서 내용을 입력해 주세요." value={consentDraft.body} maxLength={12000} onChange={e => setConsentDraft({ ...consentDraft, body: e.target.value })} /></label>
                  {consentDraft.templateId === DEFAULT_CONSENT_TEMPLATE.id && <button type="button" className="text-left text-[14px] font-medium text-[#1976ff] underline underline-offset-2" onClick={() => { if (window.confirm("현재 기본 동의서 편집 내용을 표준 문안으로 바꿀까요? 변경 후 저장을 눌러야 반영됩니다.")) setConsentDraft({ ...consentDraft, title: DEFAULT_CONSENT_TEMPLATE.title, body: DEFAULT_CONSENT_TEMPLATE.body }); }}>표준 문안으로 복원</button>}
                </div>
                <footer className={`${policyFooterClass} justify-between`}><div>{consentDraft.templateId && consentDraft.templateId !== DEFAULT_BOOKING_CONSENT_ID && <button type="button" disabled={busy || !editable} title="보관 후에도 목록에서 복구할 수 있어요." className="h-10 rounded-[9px] border border-[#e1e4ea] px-4 text-[14px] text-slate-600 disabled:opacity-50" onClick={() => void archiveConsentTemplate(consentDraft.templateId!)}>보관</button>}</div><div className="flex gap-3"><button type="button" disabled={busy} data-owner-control-size="content" className={policyCancelButtonClass} onClick={cancelConsentEdit}>취소</button><button type="button" disabled={busy || !editable || !consentDraft.title.trim() || !consentDraft.body.trim()} data-owner-control-size="content" className={policySaveButtonClass} onClick={() => void saveConsentDraft()}>{busy ? "저장 중" : "저장"}</button></div></footer>
              </> : <div className="flex flex-1 items-center justify-center text-slate-500">왼쪽에서 동의서를 선택해 주세요.</div>}
            </section>
          </div>
          <aside aria-label="동의서 미리보기" className="flex w-full max-w-[360px] min-h-[400px] min-w-0 flex-col justify-self-center overflow-hidden rounded-[14px] border border-[#e4e7ec] bg-white xl:h-full xl:min-h-0 xl:max-w-none xl:justify-self-stretch">
            <header className="flex min-h-[58px] shrink-0 items-center border-b border-[#edf0f4] px-4 py-2 sm:px-5">
              <h3 className="text-[18px] font-medium leading-[26px] text-[#15213b]">동의서 미리보기</h3>
            </header>
            <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto bg-[#f8fafc] p-3 sm:p-4">
              <article className="mx-auto min-h-full w-full max-w-[430px] rounded-[18px] border border-[#e4e7ec] bg-white p-4 text-[#2b241f] shadow-sm sm:p-5">
                <div className="mb-4 flex items-center gap-3 border-b border-[#f1d7d1] pb-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#fce9e4] text-[14px] font-semibold text-[#b85245]">동의</span><div className="min-w-0"><p className="text-[13px] text-[#8a7a72]">동의서 작성 요청</p><p className="truncate text-[15px] font-medium">{consentDraft?.title.trim() || "동의서 제목"}</p></div></div>
                <p className="mb-2 text-[13px] text-[#8a7a72]">문서 버전 {consentDraft?.templateId ? policy.templates.find(template => template.id === consentDraft.templateId)?.version ?? 1 : 1}</p>
                <h4 className="mb-3 break-words text-[18px] font-semibold leading-7 text-[#2b241f]">{consentDraft?.title.trim() || "동의서 제목"}</h4>
                <p className="whitespace-pre-wrap break-words text-[15px] font-normal leading-7 text-[#2b241f]">{consentDraft?.body || "작성 중인 동의서 내용이 여기에 표시됩니다."}</p>
                <div className="mt-5 space-y-4 border-t border-[#f1d7d1] pt-4">
                  <label className="flex min-h-11 cursor-pointer items-start gap-2 text-[14px] leading-6"><input type="checkbox" disabled className="mt-1 h-4 w-4 accent-[#1976ff]" />위 내용을 읽고 동의합니다.</label>
                  <button type="button" disabled className="h-11 w-full rounded-[9px] bg-[#1976ff] text-[15px] font-medium text-white opacity-60">동의하고 제출</button>
                </div>
              </article>
            </div>
          </aside>
        </div>
      </>}
      {tab === "noshow" && <>
        <Label title="고객 직접 취소 마감 (예약 시작 전 시간)"><input className={field} type="number" min={0} max={720} value={policy.cancellationCutoffHours} onChange={e => change("cancellationCutoffHours", Number(e.target.value))} /></Label>
        <Label title="보호자에게 안내할 취소·환불 정책"><textarea className={`${field} h-auto min-h-[120px] py-3`} value={policy.cancellationNotice} onChange={e => change("cancellationNotice", e.target.value)} /></Label>
        <div className="grid gap-4 sm:grid-cols-2">{[["firstNoshowRule", "노쇼 1회 이후"], ["repeatNoshowRule", "노쇼 2회 이상 이후"]].map(([key, title]) => <Label key={key} title={title}><select className={field} value={policy[key as "firstNoshowRule" | "repeatNoshowRule"]} onChange={e => change(key as "firstNoshowRule" | "repeatNoshowRule", e.target.value as NextBookingRule)}>{Object.entries(NEXT_BOOKING_RULE_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Label>)}</div>
        <p className="text-slate-600">정상 취소와 미납 취소는 노쇼로 집계하지 않습니다. 예약금 환불은 실제 반환 후 별도로 기록합니다.</p>
      </>}
    </fieldset>
    <div className="flex flex-wrap items-center gap-3">{tab === "noshow" && <button type="button" disabled={busy || !editable} onClick={() => void save()} className="h-10 rounded-[8px] bg-[#1976ff] px-5 text-white disabled:opacity-100! disabled:cursor-not-allowed">{busy ? "저장 중" : "정책 저장"}</button>}{message && <p role="status" className="min-w-0 text-[16px] text-slate-600">{message}</p>}</div>
    </> : <div className="flex min-h-[440px] flex-col items-center justify-center gap-3 py-8 text-center text-[16px] text-slate-600 xl:min-h-0 xl:flex-1" role={message ? "alert" : "status"}>
      <p>{message || "예약 정책을 불러오는 중입니다."}</p>
      {message && <button type="button" className="min-h-11 rounded-[10px] border border-[#e1e4ea] bg-white px-4 text-[16px] text-[#15213b]" onClick={() => { setMessage(""); setLoadAttempt(attempt => attempt + 1); }}>{"다시 불러오기"}</button>}
    </div>}
    </div>
    {showReconsentPrompt && consentDraft && <div className="fixed inset-0 z-[140] flex items-center justify-center bg-[#0f172a]/35 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setShowReconsentPrompt(false); }}><section role="dialog" aria-modal="true" aria-labelledby="consent-reconsent-title" className="w-full max-w-[440px] space-y-4 rounded-[14px] border border-[#dce3eb] bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.2)]"><h3 id="consent-reconsent-title" className="text-[18px] font-semibold text-[#15213b]">기존 동의서에 동의한 고객도 새 동의를 해야 하나요?</h3><p className="text-[14px] leading-5 text-slate-600">저장하면 이 동의서를 바로 사용합니다.</p><div className="grid gap-2 sm:grid-cols-2"><button type="button" disabled={busy} className="min-h-11 rounded-[9px] bg-[#1976ff] px-3 text-[14px] font-medium text-white disabled:opacity-60" onClick={() => void saveConsentDraft(true)}>네, 새로 동의받을게요</button><button type="button" disabled={busy} className="min-h-11 rounded-[9px] border border-[#d9e0e8] px-3 text-[14px] font-medium text-[#334155] disabled:opacity-60" onClick={() => void saveConsentDraft(false)}>아니요, 기존 동의로 인정할게요</button></div><button type="button" disabled={busy} className="min-h-11 px-3 text-[14px] text-slate-500" onClick={() => setShowReconsentPrompt(false)}>취소</button></section></div>}
  </section>;
}
