"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CircleHelp } from "lucide-react";

import { AlimtalkKakaoChatPreview } from "@/components/owner-web/alimtalk-kakao-chat-preview";
import { getAlimtalkPreviewAppointmentTime } from "@/lib/alimtalk-preview-sample";
import { fetchApiJsonWithAuth } from "@/lib/api";
import { PETMANAGER_SERVICE_NAME } from "@/lib/brand";
import { getNotificationDraftBodyByAlias, type AlimtalkTemplateAlias } from "@/lib/notification-registry";
import type { NotificationType } from "@/types/domain";

type ShopTemplate = {
  id: string;
  template_alias: AlimtalkTemplateAlias;
  notification_type: NotificationType;
  template_code: string;
  template_name: string;
  template_content: string;
  category_code: string;
  template_buttons: Array<{ buttonName: string; linkMobile: string }>;
  inspection_status: string;
  service_status: string;
  submitted_at: string | null;
};

type ApprovedTemplate = {
  templateCode: string;
  templateName: string | null;
  templateContent: string | null;
  buttons: Array<{ buttonName: string; linkMobile: string }>;
  inspectionStatus: string | null;
  serviceStatus: string | null;
};

type TemplateCategory = { code: string; name: string };
type TemplateOption = { alias: AlimtalkTemplateAlias; type: NotificationType; title: string; group: string };

const REVISIT_BUTTON_NAME = "다음 예약하기";
const REVISIT_BUTTON_URL = "https://www.petmanager.co.kr/book/#{매장ID}?experience=revisit&t=#{bookingRescheduleToken}";
const CONSENT_BUTTON_URL = "https://www.petmanager.co.kr/m?access_token=#{예약관리토큰}";
const DEPOSIT_BUTTON_URL = "https://www.petmanager.co.kr/m?access_token=#{예약관리토큰}";

const notificationHelp: Partial<Record<NotificationType, string>> = {
  booking_received: "예약금이 필요한 예약의 입금 안내입니다. 예약 확인 버튼에서 예약금과 계좌, 납부 기한을 확인합니다. 버튼과 예약별 링크는 고정됩니다.",
  booking_consent_request: "동의서 요청 문구는 매장별로 작성해 검수 요청할 수 있습니다. 동의서 작성 버튼과 링크는 고정됩니다.",
  booking_confirmed: "예약이 확정되었음을 알리고, 방문 일시와 예약 서비스를 안내하는 알림입니다.",
  booking_cancelled: "매장에서 예약을 취소했음을 보호자에게 안내하는 알림입니다. 고객이 직접 취소한 경우에는 보내지 않습니다.",
  appointment_reminder_10m: "방문 시간이 가까워졌을 때 예약 일정을 다시 알려주는 알림입니다. 직전·오늘·내일 안내 중 예약에 맞는 안내만 한 번 보냅니다.",
  visit_reminder_notice: "예약 당일 방문까지 시간이 남아 있을 때 오늘 일정을 알려주는 알림입니다. 직전·오늘·내일 안내 중 예약에 맞는 안내만 한 번 보냅니다.",
  visit_schedule_notice: "예약일 하루 전에 내일 방문할 일정을 미리 알려주는 알림입니다. 직전·오늘·내일 안내 중 예약에 맞는 안내만 한 번 보냅니다.",
  grooming_started: "반려동물의 미용을 시작했음을 보호자에게 알려주는 알림입니다.",
  grooming_almost_done: "미용이 곧 끝날 예정임을 알리고, 보호자가 데리러 올 준비를 할 수 있도록 안내하는 알림입니다.",
  grooming_completed: "미용이 끝났음을 알려주는 알림입니다. 케어리포트를 작성한 경우에는 리포트 확인도 안내합니다.",
  revisit_notice: "설정한 시점에 보호자에게 다음 미용과 예약을 안내하는 알림입니다.",
};

const statusNames: Record<string, string> = {
  draft: "임시 저장",
  submitting: "요청 중",
  requested: "검수 접수",
  reviewing: "검수 중",
  approved: "승인",
  rejected: "수정 필요",
  unknown: "상태 확인 필요",
};

const inputClass = "min-h-11 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[16px] leading-6 text-[#15213b] outline-none placeholder:text-[#94a3b8] focus:border-[#64748b] focus:ring-2 focus:ring-[#64748b]/15";
const templateVariables = [
  { label: "매장명", token: "#{매장명}" },
  { label: "반려동물명", token: "#{반려동물명}" },
  { label: "보호자명", token: "#{보호자명}" },
  { label: "예약일시", token: "#{예약일시}" },
  { label: "서비스명", token: "#{서비스명}" },
] as const;

export function OwnerAlimtalkTemplateEditor({
  shopId,
  shopName,
  senderName = PETMANAGER_SERVICE_NAME,
  selectedAlias,
  options,
  onSelectAlias,
}: {
  shopId: string;
  shopName: string;
  senderName?: string;
  selectedAlias: AlimtalkTemplateAlias;
  options: TemplateOption[];
  onSelectAlias: (alias: AlimtalkTemplateAlias) => void;
}) {
  const selectedOption = options.find((option) => option.alias === selectedAlias) ?? options[0];
  const notificationType = selectedOption.type;
  const notificationTitle = selectedOption.title;
  const [templates, setTemplates] = useState<ShopTemplate[]>([]);
  const [approvedTemplates, setApprovedTemplates] = useState<Partial<Record<AlimtalkTemplateAlias, ApprovedTemplate>>>({});
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [templateContent, setTemplateContent] = useState(() => getNotificationDraftBodyByAlias(selectedAlias) ?? "");
  const editedContentKey = useRef("");
  const templateContentRef = useRef<HTMLTextAreaElement>(null);
  const [categoryCode, setCategoryCode] = useState("");
  const [buttonName, setButtonName] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [newVersion, setNewVersion] = useState(false);
  const [helpType, setHelpType] = useState<AlimtalkTemplateAlias | null>(null);
  const helpOpen = helpType === selectedAlias;

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetchApiJsonWithAuth<{
        templates: ShopTemplate[];
        categories: TemplateCategory[];
        approvedTemplates?: Partial<Record<AlimtalkTemplateAlias, ApprovedTemplate>>;
      }>(
        `/api/owner/alimtalk-templates?shopId=${encodeURIComponent(shopId)}`,
        { cache: "no-store" },
      );
      setTemplates(response.templates);
      setApprovedTemplates(response.approvedTemplates ?? {});
      setCategories(response.categories);
      setCategoryCode((current) => current || response.categories[0]?.code || "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "템플릿을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    const current = templates.find((template) => template.template_alias === selectedAlias);
    const contentKey = `${shopId}:${selectedAlias}:${newVersion}`;
    if (editedContentKey.current !== contentKey) {
      editedContentKey.current = "";
      const connectedContent = approvedTemplates[selectedAlias]?.templateContent;
      const baseContent = current?.inspection_status === "approved" && connectedContent
        ? connectedContent
        : current?.template_content ?? connectedContent ?? getNotificationDraftBodyByAlias(selectedAlias) ?? "";
      setTemplateContent(baseContent);
    }
    setNotice("");
    setError("");
    if (!current || newVersion) {
      setTemplateId("");
      setButtonName(selectedAlias === "booking_received" ? "예약 확인" : current?.template_buttons?.[0]?.buttonName ?? (selectedAlias === "revisit_notice" ? REVISIT_BUTTON_NAME : selectedAlias === "booking_consent_request" ? "동의서 작성" : ""));
      setButtonUrl(selectedAlias === "booking_received" ? DEPOSIT_BUTTON_URL : current?.template_buttons?.[0]?.linkMobile ?? (selectedAlias === "revisit_notice" ? REVISIT_BUTTON_URL : selectedAlias === "booking_consent_request" ? CONSENT_BUTTON_URL : ""));
      setCategoryCode(current?.category_code || categories[0]?.code || "");
      return;
    }
    setTemplateId(current.id);
    setButtonName(selectedAlias === "booking_received" ? "예약 확인" : current.template_buttons?.[0]?.buttonName ?? "");
    setButtonUrl(selectedAlias === "booking_received" ? DEPOSIT_BUTTON_URL : current.template_buttons?.[0]?.linkMobile ?? "");
    setCategoryCode(current.category_code || categories[0]?.code || "");
  }, [templates, approvedTemplates, selectedAlias, categories, newVersion, shopId]);

  const currentTemplate = templates.find((template) => template.template_alias === selectedAlias);
  const approvedTemplate = approvedTemplates[selectedAlias];
  const editable = !currentTemplate || currentTemplate.inspection_status === "draft" || newVersion;
  const canCreateVersion = currentTemplate && ["approved", "rejected"].includes(currentTemplate.inspection_status);
  const needsButton = ["booking_received", "booking_confirmed", "appointment_reminder_10m", "visit_schedule_notice", "visit_reminder_notice", "grooming_completed", "revisit_notice", "booking_consent_request"].includes(selectedAlias);
  const fixedButtonContract = ["booking_consent_request", "booking_received"].includes(selectedAlias);
  const sampleMessage = templateContent
    .replaceAll("#{매장명}", shopName)
    .replaceAll("#{반려동물명}", "반려동물")
    .replaceAll("#{보호자명}", "보호자")
    .replaceAll("#{예약일시}", getAlimtalkPreviewAppointmentTime())
    .replaceAll("#{서비스명}", "전체 미용")
    .replaceAll("#{픽업예상시간}", "5")
    .replaceAll("#{픽업예상분}", "5");

  function insertTemplateVariable(token: string) {
    const textarea = templateContentRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const nextContent = `${templateContent.slice(0, start)}${token}${templateContent.slice(end)}`;
    if (nextContent.length > 1000) return;

    editedContentKey.current = `${shopId}:${selectedAlias}:${newVersion}`;
    setTemplateContent(nextContent);
    requestAnimationFrame(() => {
      const editor = templateContentRef.current;
      if (!editor) return;
      const nextCaret = start + token.length;
      editor.focus();
      editor.setSelectionRange(nextCaret, nextCaret);
    });
  }

  async function save(action: "save" | "submit") {
    const templateName = currentTemplate?.template_name?.trim() || notificationTitle;
    if (!templateContent.trim()) {
      setError("보호자에게 보낼 내용을 입력해 주세요.");
      return;
    }
    if (!categoryCode) {
      setError("알림 분류를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetchApiJsonWithAuth<{ template: ShopTemplate }>("/api/owner/alimtalk-templates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shopId, templateAlias: selectedAlias, templateName, templateContent, categoryCode, buttonName, buttonUrl, action, ...(templateId ? { id: templateId } : {}) }),
      });
      setTemplates((current) => [response.template, ...current.filter((item) => item.id !== response.template.id)]);
      setTemplateId(response.template.id);
      setNewVersion(false);
      setNotice(action === "submit" ? "검수 요청을 보냈습니다." : "임시 저장했습니다.");
      if (action === "submit") await loadTemplates();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  const preview = templateContent.trim() ? sampleMessage : "작성한 알림 문구가 여기에 표시됩니다.";
  const groupedOptions = options.reduce<Record<string, TemplateOption[]>>((groups, option) => {
    (groups[option.group] ??= []).push(option);
    return groups;
  }, {});

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col bg-white" data-owner-template-editor>
      <div className="no-scrollbar mx-3 my-3 grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto sm:mx-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:overflow-hidden">
        <div data-settings-body-container className="grid min-h-0 min-w-0 overflow-hidden rounded-[14px] border border-[#e1e4ea] bg-white lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)]">
              <nav aria-label="알림 종류" className="no-scrollbar min-w-0 border-b border-[#e8edf3] bg-white p-3 lg:overflow-y-auto lg:border-b-0 lg:border-r lg:p-3">
                <div className="flex gap-4 overflow-x-auto pb-1 lg:flex-col lg:gap-4 lg:overflow-visible">
                  {Object.entries(groupedOptions).map(([group, groupOptions]) => (
                    <section key={group} className="min-w-[190px] lg:min-w-0">
                      <h3 className="mb-1.5 px-1 text-[18px] font-medium leading-[26px] text-[#15213b]">{group}</h3>
                      <div className="flex gap-1.5 lg:flex-col">
                        {groupOptions.map((option) => {
                          const selected = option.alias === selectedAlias;
                          const template = templates.find((item) => item.template_alias === option.alias);
                          return <button key={option.alias} type="button" onClick={() => { setHelpType(null); setNewVersion(false); onSelectAlias(option.alias); }} aria-current={selected ? "page" : undefined} className={`flex min-h-11 shrink-0 items-center justify-between gap-2 rounded-[9px] border px-2.5 py-1.5 text-left transition lg:w-full ${selected ? "border-[#b8c9c2] bg-[#f3f8f6]" : "border-[#e8edf3] bg-white hover:bg-[#f8fafc]"}`}>
                            <span className="text-[16px] font-normal leading-6 text-[#334155]">{option.title}</span>
                            {template ? <span className="shrink-0 text-[12px] leading-4 text-[#64748b]">{statusNames[template.inspection_status] ?? "상태 확인 필요"}</span> : null}
                          </button>;
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              </nav>

              <main className="no-scrollbar min-w-0 bg-white p-4 sm:p-5 lg:overflow-y-auto">
                <div className="mb-3 flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-1"><h3 className="text-[18px] font-medium leading-[26px] text-[#15213b]">{notificationTitle}</h3><button type="button" aria-label={`${notificationTitle} 역할 도움말`} aria-expanded={helpOpen} aria-controls="owner-template-role-help" onClick={() => setHelpType(helpOpen ? null : selectedAlias)} onKeyDown={(event) => { if (event.key === "Escape") setHelpType(null); }} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] text-[#64748b] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"><CircleHelp className="h-4 w-4" aria-hidden="true" /></button></div>{currentTemplate ? <span className="shrink-0 rounded-full bg-[#f1f5f9] px-2.5 py-1 text-[12px] text-[#475569]">{statusNames[currentTemplate.inspection_status] ?? "상태 확인 필요"}</span> : null}</div>
                <p id="owner-template-role-help" hidden={!helpOpen} className="mb-3 min-w-0 whitespace-normal break-words rounded-[8px] bg-[#f8fafc] px-3 py-2 text-[14px] leading-5 text-[#475569] [overflow-wrap:anywhere]">{notificationHelp[notificationType]}</p>
                <p data-template-policy className="mb-3 flex min-w-0 items-center gap-2 rounded-[8px] border border-[#f4e7bf] bg-[#fffaf0] px-3 py-1.5 text-[13px] leading-5 text-[#80631f]"><span aria-hidden="true" className="shrink-0 text-[14px]">ⓘ</span><span className="min-w-0">{!currentTemplate && !approvedTemplate?.templateContent ? "공통 초안" : currentTemplate ? "매장 초안" : "승인 문안 참고"} · 예시 시간 포함 · 홍보·이벤트 문구 제외 · 검수 승인 후 발송</span></p>
                {loading ? <p className="mb-3 text-[16px] leading-6 text-[#64748b]">매장 템플릿을 불러오는 중입니다.</p> : null}
                {!currentTemplate && approvedTemplate?.templateContent ? <p className="mb-3 rounded-[8px] bg-[#eef7f2] px-3 py-2 text-[14px] leading-5 text-[#276749]">실제 승인 문구 · {approvedTemplate.templateName || approvedTemplate.templateCode} · 이 원문을 새 매장 문구의 시작 내용으로 불러왔습니다.</p> : null}
                {currentTemplate && !editable ? <div className="rounded-[10px] border border-[#e8edf3] bg-[#f8fafc] p-4">{approvedTemplate?.templateContent ? <p className="mb-2 text-[13px] leading-5 text-[#276749]">실제 승인 문구 · {approvedTemplate.templateName || approvedTemplate.templateCode}</p> : null}<p className="text-[18px] font-medium leading-[26px] text-[#15213b]">{approvedTemplate?.templateName || currentTemplate.template_name}</p><p className="mt-2 whitespace-pre-wrap text-[16px] leading-6 text-[#475569]">{approvedTemplate?.templateContent || currentTemplate.template_content}</p>{(approvedTemplate?.buttons ?? currentTemplate.template_buttons)?.map((button) => <p key={button.buttonName} className="mt-2 text-[16px] leading-6 text-[#475569]">버튼 · {button.buttonName}</p>)}<p className="mt-3 text-[16px] leading-6 text-[#64748b]">승인 전까지 기존 알림 문구가 유지됩니다.</p>{canCreateVersion ? <button type="button" onClick={() => setNewVersion(true)} className="mt-3 min-h-11 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[16px] font-medium text-[#15213b]">새 문구 작성</button> : null}</div> : <div className="space-y-3">
                  <div>
                    <label className="block"><span className="mb-1 block text-[16px] font-medium leading-6 text-[#475569]">보호자에게 보낼 내용</span><textarea ref={templateContentRef} value={templateContent} onChange={(event) => { editedContentKey.current = `${shopId}:${selectedAlias}:${newVersion}`; setTemplateContent(event.target.value); }} maxLength={1000} rows={10} className="min-h-[220px] w-full resize-y rounded-[8px] border border-[#dbe2ea] px-3 py-2.5 text-[16px] leading-6 text-[#15213b] outline-none placeholder:text-[#94a3b8] focus:border-[#64748b] focus:ring-2 focus:ring-[#64748b]/15" placeholder="원하는 문구를 적어주세요. 예약일시, 반려동물명 등 필요한 정보를 함께 적을 수 있습니다." /></label>
                    <div data-template-content-meta className="mt-2 flex min-w-0 flex-col gap-1.5 text-[#64748b]">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="mr-0.5 text-[13px] font-medium leading-5 text-[#526171]">자동 입력 변수</span>
                        {templateVariables.map(({ label, token }) => (
                          <button
                            key={token}
                            type="button"
                            title={`${label} ${token} 변수를 입력란에 삽입`}
                            aria-label={`${label} 변수 삽입`}
                            onClick={() => insertTemplateVariable(token)}
                            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-[#d9e3ef] bg-[#f5f8fc] px-2.5 text-[13px] font-medium leading-5 text-[#36516f] transition hover:border-[#b9cde3] hover:bg-[#edf4fb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
                          >
                            <span className="shrink-0 whitespace-nowrap">{label}</span>
                            <span aria-hidden="true" className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#e7eef8] font-mono text-[11px] font-normal leading-none text-[#58708c]">#</span>
                          </button>
                        ))}
                      </div>
                      <span className="self-end whitespace-nowrap text-[12px] leading-5">{templateContent.length} / 1,000</span>
                    </div>
                  </div>
                  <details><summary className="flex min-h-11 cursor-pointer items-center text-[16px] font-medium leading-6 text-[#475569]">버튼 설정{needsButton ? " · 필수" : " · 선택"}</summary>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="block"><span className="mb-1 block text-[16px] font-medium leading-6 text-[#475569]">버튼 이름{needsButton ? " · 필수" : " · 선택"}</span><input value={buttonName} readOnly={fixedButtonContract} onChange={(event) => setButtonName(event.target.value)} maxLength={14} className={inputClass} placeholder="예약 확인" /></label><label className="block"><span className="mb-1 block text-[16px] font-medium leading-6 text-[#475569]">버튼 링크</span><input type="url" value={buttonUrl} readOnly={fixedButtonContract} onChange={(event) => setButtonUrl(event.target.value)} className={inputClass} placeholder="https://" /></label></div>
                  <p className="mt-2 text-[13px] leading-5 text-[#64748b]">{fixedButtonContract ? (selectedAlias === "booking_received" ? "예약 확인 버튼과 예약별 예약금 안내 링크는 자동 연결되며 수정할 수 없습니다." : "동의서 작성 버튼과 예약별 서명 링크는 자동 연결되며 수정할 수 없습니다.") : needsButton ? "버튼 이름과 HTTPS 링크를 본문과 함께 카카오 검수 요청합니다. 승인 전에는 기존 승인 버튼이 유지됩니다." : "버튼은 선택 사항입니다. 입력하면 본문과 함께 카카오 검수 요청합니다."}</p>
                  </details>
                  <p className="text-[16px] leading-6 text-[#64748b]">검수가 완료되면 이 매장의 {notificationTitle} 알림에 적용됩니다.</p>
                </div>}
                {error ? <p role="alert" className="mt-3 text-[16px] leading-6 text-[#9a5e4e]">{error}</p> : null}{notice ? <p role="status" className="mt-3 text-[16px] leading-6 text-[#1f6b5b]">{notice}</p> : null}
              </main>
        </div>

              <aside aria-label="카카오톡 알림톡 수신 화면" className="no-scrollbar min-w-0 rounded-[14px] border border-[#e1e4ea] bg-white p-4 sm:p-5 xl:overflow-y-auto">
                <div className="mb-3"><p className="text-[18px] font-medium leading-[26px] text-[#15213b]">카카오톡 수신 화면</p></div>
                <AlimtalkKakaoChatPreview
                  message={preview}
                  buttons={buttonName && buttonUrl ? [buttonName] : []}
                  senderName={senderName}
                />
              </aside>
      </div>

      {editable ? <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[#e8edf3] bg-white px-4 py-2.5 sm:px-6"><button type="button" disabled={saving || loading || !categories.length} onClick={() => void save("save")} className="min-h-11 rounded-[9px] border border-[#dbe2ea] bg-white px-4 text-[16px] font-medium leading-6 text-[#15213b] disabled:opacity-50">임시 저장</button><button type="button" disabled={saving || loading || !categories.length} onClick={() => void save("submit")} className="min-h-11 rounded-[9px] bg-[#5850f5] px-5 text-[16px] font-medium leading-6 text-white disabled:opacity-50">{saving ? "요청 중…" : "검수 요청"}</button></footer> : null}
    </section>
  );
}
