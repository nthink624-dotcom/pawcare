"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchApiJsonWithAuth } from "@/lib/api";
import { getNotificationDraftBody } from "@/lib/notification-registry";
import type { NotificationType } from "@/types/domain";

type ShopTemplate = {
  id: string;
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
type TemplateOption = { type: NotificationType; title: string; group: string };

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
  notificationType,
  notificationTitle,
  options,
  onSelectType,
}: {
  shopId: string;
  shopName: string;
  notificationType: NotificationType;
  notificationTitle: string;
  options: TemplateOption[];
  onSelectType: (type: NotificationType) => void;
}) {
  const [templates, setTemplates] = useState<ShopTemplate[]>([]);
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [templateContent, setTemplateContent] = useState(() => getNotificationDraftBody(notificationType) ?? "");
  const editedContentKey = useRef("");
  const [categoryCode, setCategoryCode] = useState("");
  const [buttonName, setButtonName] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [newVersion, setNewVersion] = useState(false);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetchApiJsonWithAuth<{ templates: ShopTemplate[]; categories: TemplateCategory[] }>(
        `/api/owner/alimtalk-templates?shopId=${encodeURIComponent(shopId)}`,
        { cache: "no-store" },
      );
      setTemplates(response.templates);
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
    const current = templates.find((template) => template.notification_type === notificationType);
    const contentKey = `${shopId}:${notificationType}:${newVersion}`;
    if (editedContentKey.current !== contentKey) {
      editedContentKey.current = "";
      setTemplateContent(current?.template_content ?? getNotificationDraftBody(notificationType) ?? "");
    }
    setNotice("");
    setError("");
    if (!current || newVersion) {
      setTemplateId("");
      setButtonName(current?.template_buttons?.[0]?.buttonName ?? "");
      setButtonUrl(current?.template_buttons?.[0]?.linkMobile ?? "");
      setCategoryCode(current?.category_code || categories[0]?.code || "");
      return;
    }
    setTemplateId(current.id);
    setButtonName(current.template_buttons?.[0]?.buttonName ?? "");
    setButtonUrl(current.template_buttons?.[0]?.linkMobile ?? "");
    setCategoryCode(current.category_code || categories[0]?.code || "");
  }, [templates, notificationType, categories, newVersion, shopId]);

  const currentTemplate = templates.find((template) => template.notification_type === notificationType);
  const editable = !currentTemplate || currentTemplate.inspection_status === "draft" || newVersion;
  const canCreateVersion = currentTemplate && ["approved", "rejected"].includes(currentTemplate.inspection_status);
  const needsButton = ["booking_confirmed", "appointment_reminder_10m", "visit_schedule_notice", "visit_reminder_notice", "grooming_completed"].includes(notificationType);
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
        body: JSON.stringify({ shopId, notificationType, templateName, templateContent, categoryCode, buttonName, buttonUrl, action, ...(templateId ? { id: templateId } : {}) }),
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
                          const selected = option.type === notificationType;
                          const template = templates.find((item) => item.notification_type === option.type);
                          return <button key={option.type} type="button" onClick={() => { setNewVersion(false); onSelectType(option.type); }} aria-current={selected ? "page" : undefined} className={`flex min-h-11 shrink-0 items-center justify-between gap-2 rounded-[9px] border px-2.5 py-1.5 text-left transition lg:w-full ${selected ? "border-[#b8c9c2] bg-[#f3f8f6]" : "border-[#e8edf3] bg-white hover:bg-[#f8fafc]"}`}>
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
                <div className="mb-3 flex items-start justify-between gap-3"><h3 className="text-[18px] font-medium leading-[26px] text-[#15213b]">{notificationTitle}</h3>{currentTemplate ? <span className="shrink-0 rounded-full bg-[#f1f5f9] px-2.5 py-1 text-[12px] text-[#475569]">{statusNames[currentTemplate.inspection_status] ?? "상태 확인 필요"}</span> : null}</div>
                <p data-template-policy className="mb-3 flex items-start gap-2 rounded-[8px] bg-[#fff9e8] px-3 py-2 text-[13px] leading-5 text-[#8a6417]"><span aria-hidden="true" className="shrink-0">ⓘ</span><span>카카오 정책상 홍보·이벤트 등 비정보성 내용은 입력할 수 없고, 검수 후 적용됩니다.</span></p>
                {loading ? <p className="mb-3 text-[16px] leading-6 text-[#64748b]">매장 템플릿을 불러오는 중입니다.</p> : null}
                {currentTemplate && !editable ? <div className="rounded-[10px] border border-[#e8edf3] bg-[#f8fafc] p-4"><p className="text-[18px] font-medium leading-[26px] text-[#15213b]">{currentTemplate.template_name}</p><p className="mt-2 whitespace-pre-wrap text-[16px] leading-6 text-[#475569]">{currentTemplate.template_content}</p>{currentTemplate.template_buttons?.map((button) => <p key={button.buttonName} className="mt-2 text-[16px] leading-6 text-[#475569]">버튼 · {button.buttonName}</p>)}<p className="mt-3 text-[16px] leading-6 text-[#64748b]">승인 전까지 기존 알림 문구가 유지됩니다.</p>{canCreateVersion ? <button type="button" onClick={() => setNewVersion(true)} className="mt-3 min-h-11 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[16px] font-medium text-[#15213b]">새 문구 작성</button> : null}</div> : <div className="space-y-3">
                  <div>
                    <label className="block"><span className="mb-1 block text-[16px] font-medium leading-6 text-[#475569]">보호자에게 보낼 내용</span><textarea value={templateContent} onChange={(event) => { editedContentKey.current = `${shopId}:${notificationType}:${newVersion}`; setTemplateContent(event.target.value); }} maxLength={1000} rows={10} className="min-h-[220px] w-full resize-y rounded-[8px] border border-[#dbe2ea] px-3 py-2.5 text-[16px] leading-6 text-[#15213b] outline-none placeholder:text-[#94a3b8] focus:border-[#64748b] focus:ring-2 focus:ring-[#64748b]/15" placeholder="원하는 문구를 적어주세요. 예약일시, 반려동물명 등 필요한 정보를 함께 적을 수 있습니다." /></label>
                    <div data-template-content-meta className="mt-1 flex items-start justify-between gap-3 text-[#64748b]">
                      <p className="min-w-0 break-words text-[13px] leading-5">자동 입력 값: {"#{매장명}"}, {"#{반려동물명}"}, {"#{보호자명}"}, {"#{예약일시}"}, {"#{서비스명}"}</p>
                      <span className="shrink-0 whitespace-nowrap text-[12px] leading-5">{templateContent.length} / 1,000</span>
                    </div>
                  </div>
                  <details><summary className="flex min-h-11 cursor-pointer items-center text-[16px] font-medium leading-6 text-[#475569]">버튼 설정{needsButton ? " · 필수" : " · 선택"}</summary>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="block"><span className="mb-1 block text-[16px] font-medium leading-6 text-[#475569]">버튼 이름{needsButton ? " · 필수" : " · 선택"}</span><input value={buttonName} onChange={(event) => setButtonName(event.target.value)} maxLength={14} className={inputClass} placeholder="예약 확인" /></label><label className="block"><span className="mb-1 block text-[16px] font-medium leading-6 text-[#475569]">버튼 링크</span><input type="url" value={buttonUrl} onChange={(event) => setButtonUrl(event.target.value)} className={inputClass} placeholder="https://" /></label></div>
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

      {editable ? <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[#e8edf3] bg-white px-4 py-2.5 sm:px-6"><button type="button" disabled={saving || loading || !categories.length} onClick={() => void save("save")} className="min-h-11 rounded-[9px] border border-[#dbe2ea] bg-white px-4 text-[16px] font-medium leading-6 text-[#15213b] disabled:opacity-50">임시 저장</button><button type="button" disabled={saving || loading || !categories.length} onClick={() => void save("submit")} className="min-h-11 rounded-[9px] bg-[#5850f5] px-5 text-[16px] font-medium leading-6 text-white disabled:opacity-50">{saving ? "요청 중…" : "검수 요청"}</button></footer> : null}
    </section>
  );
}
