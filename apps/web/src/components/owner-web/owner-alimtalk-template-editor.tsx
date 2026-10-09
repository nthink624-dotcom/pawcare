"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CircleHelp } from "lucide-react";

import { fetchApiJsonWithAuth } from "@/lib/api";
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

type TemplateCategory = { code: string; name: string };
type TemplateOption = { alias: AlimtalkTemplateAlias; type: NotificationType; title: string; group: string };
type TemplateButton = { buttonName: string; linkMobile: string };
type ButtonDefaults = Partial<Record<AlimtalkTemplateAlias, TemplateButton[]>>;
const requiredButtonAliases: AlimtalkTemplateAlias[] = [
  "booking_confirmed",
  "appointment_reminder_10m",
  "visit_schedule_notice",
  "visit_reminder_notice",
  "grooming_completed",
  "revisit_notice",
  "booking_consent_request",
];

const notificationHelp: Partial<Record<NotificationType, string>> = {
  booking_consent_request: "예약별 동의서 작성 요청을 보낼 때 사용합니다. 카카오 심사 규칙에 맞춰 본문과 버튼이 고정되어 있습니다.",
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

export function OwnerAlimtalkTemplateEditor({
  shopId,
  shopName,
  selectedAlias,
  options,
  onSelectAlias,
}: {
  shopId: string;
  shopName: string;
  selectedAlias: AlimtalkTemplateAlias;
  options: TemplateOption[];
  onSelectAlias: (alias: AlimtalkTemplateAlias) => void;
}) {
  const selectedOption = options.find((option) => option.alias === selectedAlias) ?? options[0];
  const notificationType = selectedOption.type;
  const notificationTitle = selectedOption.title;
  const [templates, setTemplates] = useState<ShopTemplate[]>([]);
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [buttonDefaults, setButtonDefaults] = useState<ButtonDefaults>({});
  const [templateId, setTemplateId] = useState("");
  const [templateContent, setTemplateContent] = useState(() => getNotificationDraftBodyByAlias(selectedAlias) ?? "");
  const editedContentKey = useRef("");
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
      const response = await fetchApiJsonWithAuth<{ templates: ShopTemplate[]; categories: TemplateCategory[]; buttonDefaults: ButtonDefaults }>(
        `/api/owner/alimtalk-templates?shopId=${encodeURIComponent(shopId)}`,
        { cache: "no-store" },
      );
      setTemplates(response.templates);
      setCategories(response.categories);
      setButtonDefaults(response.buttonDefaults ?? {});
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
    const defaultButton = buttonDefaults[selectedAlias]?.[0];
    const contentKey = `${shopId}:${selectedAlias}:${newVersion}`;
    if (editedContentKey.current !== contentKey) {
      editedContentKey.current = "";
      setTemplateContent(current?.template_content ?? getNotificationDraftBodyByAlias(selectedAlias) ?? "");
    }
    setNotice("");
    setError("");
    if (!current || newVersion) {
      setTemplateId("");
      setButtonName(defaultButton?.buttonName ?? "");
      setButtonUrl(defaultButton?.linkMobile ?? "");
      setCategoryCode(current?.category_code || categories[0]?.code || "");
      return;
    }
    setTemplateId(current.id);
    setButtonName(defaultButton?.buttonName ?? current.template_buttons?.[0]?.buttonName ?? "");
    setButtonUrl(defaultButton?.linkMobile ?? current.template_buttons?.[0]?.linkMobile ?? "");
    setCategoryCode(current.category_code || categories[0]?.code || "");
  }, [templates, buttonDefaults, selectedAlias, categories, newVersion, shopId]);

  const currentTemplate = templates.find((template) => template.template_alias === selectedAlias);
  const selectedButtonDefaults = buttonDefaults[selectedAlias] ?? [];
  const editable = !currentTemplate || currentTemplate.inspection_status === "draft" || newVersion;
  const canCreateVersion = currentTemplate && ["approved", "rejected"].includes(currentTemplate.inspection_status);
  const needsButton = requiredButtonAliases.includes(selectedAlias) || selectedButtonDefaults.length > 0;
  const unsupportedButtonCount = selectedButtonDefaults.length > 1;
  const fixedContract = selectedAlias === "booking_consent_request";
  const sampleMessage = templateContent
    .replaceAll("#{매장명}", shopName)
    .replaceAll("#{반려동물명}", "반려동물")
    .replaceAll("#{보호자명}", "보호자")
    .replaceAll("#{예약일시}", "예약 일시")
    .replaceAll("#{서비스명}", "예약 서비스");

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
        body: JSON.stringify({ shopId, templateAlias: selectedAlias, templateName, templateContent, categoryCode, action, ...(templateId ? { id: templateId } : {}) }),
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
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_320px] xl:overflow-hidden">
              <nav aria-label="알림 종류" className="min-w-0 border-b border-[#e8edf3] bg-white p-3 lg:overflow-y-auto lg:border-b-0 lg:border-r lg:p-3">
                <div className="flex gap-4 overflow-x-auto pb-1 lg:flex-col lg:gap-4 lg:overflow-visible">
                  {Object.entries(groupedOptions).map(([group, groupOptions]) => (
                    <section key={group} className="min-w-[190px] lg:min-w-0">
                      <h3 className="mb-1.5 px-1 text-[18px] font-medium leading-[26px] text-[#15213b]">{group}</h3>
                      <div className="flex gap-1.5 lg:flex-col">
                        {groupOptions.map((option) => {
                          const selected = option.alias === selectedAlias;
                          const template = templates.find((item) => item.template_alias === option.alias);
                          return <button key={option.alias} type="button" onClick={() => { setHelpType(null); setNewVersion(false); onSelectAlias(option.alias); }} aria-current={selected ? "page" : undefined} className={`flex min-h-11 shrink-0 items-center justify-between gap-2 rounded-[9px] border px-2.5 py-1.5 text-left transition lg:w-full ${selected ? "border-[#b8c9c2] bg-[#f3f8f6]" : "border-[#e8edf3] bg-white hover:bg-[#f8fafc]"}`}>
                            <span className="text-[16px] font-medium leading-6 text-[#334155]">{option.title}</span>
                            <span className="shrink-0 text-[12px] leading-4 text-[#64748b]">{template ? statusNames[template.inspection_status] ?? "상태 확인 필요" : "미작성"}</span>
                          </button>;
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              </nav>

              <main className="min-w-0 bg-white p-4 sm:p-5 lg:overflow-y-auto lg:border-r lg:border-[#e8edf3] xl:border-[#e8edf3]">
                <div className="mb-3 flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-1"><h3 className="text-[18px] font-medium leading-[26px] text-[#15213b]">{notificationTitle}</h3><button type="button" aria-label={`${notificationTitle} 역할 도움말`} aria-expanded={helpOpen} aria-controls="owner-template-role-help" onClick={() => setHelpType(helpOpen ? null : selectedAlias)} onKeyDown={(event) => { if (event.key === "Escape") setHelpType(null); }} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] text-[#64748b] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"><CircleHelp className="h-4 w-4" aria-hidden="true" /></button></div>{currentTemplate ? <span className="shrink-0 rounded-full bg-[#f1f5f9] px-2.5 py-1 text-[12px] text-[#475569]">{statusNames[currentTemplate.inspection_status] ?? "상태 확인 필요"}</span> : null}</div>
                <p id="owner-template-role-help" hidden={!helpOpen} className="mb-3 min-w-0 whitespace-normal break-words rounded-[8px] bg-[#f8fafc] px-3 py-2 text-[14px] leading-5 text-[#475569] [overflow-wrap:anywhere]">{notificationHelp[notificationType]}</p>
                <p data-template-policy className="mb-3 flex items-start gap-2 rounded-[8px] bg-[#fff9e8] px-3 py-2 text-[13px] leading-5 text-[#8a6417]"><span aria-hidden="true" className="shrink-0">ⓘ</span><span>카카오 정책상 홍보·이벤트 등 비정보성 내용은 입력할 수 없고, 검수 후 적용됩니다.</span></p>
                {loading ? <p className="mb-3 text-[16px] leading-6 text-[#64748b]">매장 템플릿을 불러오는 중입니다.</p> : null}
                {currentTemplate && !editable ? <div className="rounded-[10px] border border-[#e8edf3] bg-[#f8fafc] p-4"><p className="text-[18px] font-medium leading-[26px] text-[#15213b]">{currentTemplate.template_name}</p><p className="mt-2 whitespace-pre-wrap text-[16px] leading-6 text-[#475569]">{currentTemplate.template_content}</p>{currentTemplate.template_buttons?.map((button) => <p key={button.buttonName} className="mt-2 text-[16px] leading-6 text-[#475569]">버튼 · {button.buttonName}</p>)}<p className="mt-3 text-[16px] leading-6 text-[#64748b]">승인 전까지 기존 알림 문구가 유지됩니다.</p>{canCreateVersion ? <button type="button" onClick={() => setNewVersion(true)} className="mt-3 min-h-11 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[16px] font-medium text-[#15213b]">새 문구 작성</button> : null}</div> : <div className="space-y-3">
                  <div>
                    <label className="block"><span className="mb-1 block text-[16px] font-medium leading-6 text-[#475569]">보호자에게 보낼 내용</span><textarea value={templateContent} readOnly={fixedContract} onChange={(event) => { editedContentKey.current = `${shopId}:${selectedAlias}:${newVersion}`; setTemplateContent(event.target.value); }} maxLength={1000} rows={10} className="min-h-[220px] w-full resize-y rounded-[8px] border border-[#dbe2ea] px-3 py-2.5 text-[16px] leading-6 text-[#15213b] outline-none placeholder:text-[#94a3b8] focus:border-[#64748b] focus:ring-2 focus:ring-[#64748b]/15 read-only:bg-[#f8fafc]" placeholder="원하는 문구를 적어주세요. 예약일시, 반려동물명 등 필요한 정보를 함께 적을 수 있습니다." /></label>
                    <div data-template-content-meta className="mt-1 flex items-start justify-between gap-3 text-[#64748b]">
                      <p className="min-w-0 break-words text-[13px] leading-5">자동 입력 값: {"#{매장명}"}, {"#{반려동물명}"}, {"#{보호자명}"}, {"#{예약일시}"}, {"#{서비스명}"}</p>
                      <span className="shrink-0 whitespace-nowrap text-[12px] leading-5">{templateContent.length} / 1,000</span>
                    </div>
                  </div>
                  <details><summary className="flex min-h-11 cursor-pointer items-center text-[16px] font-medium leading-6 text-[#475569]">버튼 설정{needsButton ? " · 필수" : " · 선택"}</summary>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="block"><span className="mb-1 block text-[16px] font-medium leading-6 text-[#475569]">버튼 이름{needsButton ? " · 필수" : " · 선택"}</span><input value={buttonName} readOnly maxLength={14} className={`${inputClass} read-only:bg-[#f8fafc]`} placeholder={loading ? "승인된 버튼을 불러오는 중" : needsButton ? "승인된 버튼 확인 필요" : "버튼 없음"} /></label><label className="block"><span className="mb-1 block text-[16px] font-medium leading-6 text-[#475569]">버튼 링크 · 고정</span><input type="url" value={buttonUrl} readOnly className={`${inputClass} read-only:bg-[#f8fafc]`} placeholder={loading ? "승인된 링크를 불러오는 중" : needsButton ? "승인된 링크 확인 필요" : "버튼 없음"} /></label></div>
                  <p className="text-[13px] leading-5 text-[#64748b]">승인된 공통 템플릿의 버튼을 그대로 사용합니다.</p>
                  {needsButton && !loading && (!buttonName || !buttonUrl) ? <p role="alert" className="text-[13px] leading-5 text-[#9a5e4e]">승인된 공통 버튼을 불러오지 못해 저장할 수 없습니다.</p> : null}
                  {unsupportedButtonCount ? <p role="alert" className="text-[13px] leading-5 text-[#9a5e4e]">공통 템플릿에 버튼이 여러 개 있어 요청할 수 없습니다. 관리자에게 확인해 주세요.</p> : null}
                  </details>
                  <p className="text-[16px] leading-6 text-[#64748b]">검수가 완료되면 이 매장의 {notificationTitle} 알림에 적용됩니다.</p>
                </div>}
                {error ? <p role="alert" className="mt-3 text-[16px] leading-6 text-[#9a5e4e]">{error}</p> : null}{notice ? <p role="status" className="mt-3 text-[16px] leading-6 text-[#1f6b5b]">{notice}</p> : null}
              </main>

              <aside aria-label="카카오 미리보기" className="min-w-0 bg-[#9bb7d0] p-4 sm:p-5 lg:col-span-2 xl:col-span-1 xl:overflow-y-auto">
                <div className="mb-3"><p className="text-[18px] font-medium leading-[26px] text-[#15213b]">카카오 미리보기</p></div>
                <div className="mx-auto max-w-[320px] rounded-[14px] border border-white/60 bg-white p-3 shadow-sm">
                  <div className="mb-3 flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fff0c2] text-[12px] font-medium text-[#9a6b00]">톡</span><span className="truncate text-[16px] font-medium leading-6 text-[#334155]">{shopName || "내 매장"}</span></div>
                  <div className="overflow-hidden rounded-[10px] border border-[#ececec]">
                    <div className="bg-[#ffe500] px-3 py-2.5 text-[16px] font-medium leading-6 text-[#1f2937]">알림톡 도착</div>
                    <div className="whitespace-pre-wrap break-words px-3 py-3 text-[16px] leading-6 text-[#334155]">{preview}</div>
                    {buttonName && buttonUrl ? <div className="border-t border-[#eee] bg-[#fafafa] px-3 py-2.5 text-center text-[16px] font-medium leading-6 text-[#475569]">{buttonName}</div> : null}
                  </div>
                </div>
              </aside>
      </div>

      {editable ? <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[#e8edf3] bg-white px-4 py-2.5 sm:px-6"><button type="button" disabled={saving || loading || !categories.length || unsupportedButtonCount || (needsButton && (!buttonName || !buttonUrl))} onClick={() => void save("save")} className="min-h-11 rounded-[9px] border border-[#dbe2ea] bg-white px-4 text-[16px] font-medium leading-6 text-[#15213b] disabled:opacity-50">임시 저장</button><button type="button" disabled={saving || loading || !categories.length || unsupportedButtonCount || (needsButton && (!buttonName || !buttonUrl))} onClick={() => void save("submit")} className="min-h-11 rounded-[9px] bg-[#5850f5] px-5 text-[16px] font-medium leading-6 text-white disabled:opacity-50">{saving ? "요청 중…" : "검수 요청"}</button></footer> : null}
    </section>
  );
}
