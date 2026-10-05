"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchApiJsonWithAuth } from "@/lib/api";
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

const statusNames: Record<string, string> = {
  draft: "임시 저장",
  submitting: "요청 중",
  requested: "검수 접수",
  reviewing: "검수 중",
  approved: "승인",
  rejected: "수정 필요",
  unknown: "상태 확인 필요",
};

export function OwnerAlimtalkTemplateEditor({
  shopId,
  shopName,
  notificationType,
  notificationTitle,
}: {
  shopId: string;
  shopName: string;
  notificationType: NotificationType;
  notificationTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<ShopTemplate[]>([]);
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateContent, setTemplateContent] = useState("");
  const [categoryCode, setCategoryCode] = useState("");
  const [buttonName, setButtonName] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [newVersion, setNewVersion] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

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
    if (!open) return;
    void loadTemplates();
  }, [open, loadTemplates]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = document.querySelector<HTMLElement>("[role='dialog'][aria-labelledby='owner-alimtalk-template-title']");
      const focusable = dialog?.querySelectorAll<HTMLElement>(
        "a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])",
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    closeButtonRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      triggerRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    const current = templates.find((template) => template.notification_type === notificationType);
    if (!current || newVersion) {
      setTemplateId("");
      setTemplateName(current?.template_name ?? "");
      setTemplateContent(current?.template_content ?? "");
      setButtonName(current?.template_buttons?.[0]?.buttonName ?? "");
      setButtonUrl(current?.template_buttons?.[0]?.linkMobile ?? "");
      return;
    }
    setTemplateId(current.id);
    setTemplateName(current.template_name);
    setTemplateContent(current.template_content);
    setButtonName(current.template_buttons?.[0]?.buttonName ?? "");
    setButtonUrl(current.template_buttons?.[0]?.linkMobile ?? "");
    setCategoryCode(current.category_code || categories[0]?.code || "");
  }, [templates, notificationType, categories, newVersion]);

  const currentTemplate = templates.find((template) => template.notification_type === notificationType);
  const editable = !currentTemplate || currentTemplate.inspection_status === "draft" || newVersion;
  const canCreateVersion = currentTemplate && ["approved", "rejected"].includes(currentTemplate.inspection_status);
  const needsButton = [
    "booking_confirmed", "appointment_reminder_10m", "visit_schedule_notice",
    "visit_reminder_notice", "grooming_completed",
  ].includes(notificationType);
  const sampleMessage = templateContent
    .replaceAll("#{매장명}", shopName)
    .replaceAll("#{반려동물명}", "반려동물")
    .replaceAll("#{보호자명}", "보호자")
    .replaceAll("#{예약일시}", "예약 일시")
    .replaceAll("#{서비스명}", "예약 서비스");

  async function save(action: "save" | "submit") {
    if (!templateName.trim() || !templateContent.trim() || !categoryCode) {
      setError("템플릿 이름, 내용, 카테고리를 입력해 주세요.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetchApiJsonWithAuth<{ template: ShopTemplate }>("/api/owner/alimtalk-templates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          shopId,
          notificationType,
          templateName,
          templateContent,
          categoryCode,
          buttonName,
          buttonUrl,
          action,
          ...(templateId ? { id: templateId } : {}),
        }),
      });
      setTemplates((current) => [response.template, ...current.filter((item) => item.id !== response.template.id)]);
      setTemplateId(response.template.id);
      setNewVersion(false);
      setNotice(action === "submit" ? "쏘다에 검수 요청을 보냈습니다." : "임시 저장했습니다.");
      if (action === "submit") await loadTemplates();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-3 rounded-[10px] border border-[#e8edf3] bg-white p-3" data-owner-template-editor>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-medium leading-5 text-[#15213b]">내 알림 문구</p>
          <p className="mt-0.5 text-[12px] leading-4 text-[#64748b]">
            {currentTemplate ? statusNames[currentTemplate.inspection_status] ?? "상태 확인 필요" : "매장에 맞는 문구를 작성해 검수를 요청할 수 있어요."}
          </p>
        </div>
        <button
          type="button"
          ref={triggerRef}
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="min-h-11 shrink-0 rounded-[8px] border border-[#dbe2ea] px-3 text-[14px] font-medium text-[#15213b] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#94a3b8]"
        >
          {open ? "닫기" : currentTemplate ? "문구 보기" : "직접 작성"}
        </button>
      </div>
      {open ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#101a31]/35 sm:items-center sm:p-5" onClick={() => setOpen(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="owner-alimtalk-template-title"
            className="flex max-h-[94dvh] w-full max-w-[680px] flex-col overflow-hidden rounded-t-[16px] bg-white shadow-[0_16px_48px_rgba(15,23,42,0.18)] sm:max-h-[min(88dvh,860px)] sm:rounded-[14px]"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[#e8edf3] px-4 py-3.5 sm:px-5">
              <div className="min-w-0">
                <h2 id="owner-alimtalk-template-title" className="text-[18px] font-semibold leading-6 text-[#15213b]">내 알림 문구</h2>
                <p className="mt-0.5 text-[13px] leading-5 text-[#64748b]">{notificationTitle}에 사용할 문구를 작성합니다.</p>
              </div>
              <button ref={closeButtonRef} type="button" onClick={() => setOpen(false)} className="min-h-11 shrink-0 rounded-[8px] border border-[#dbe2ea] px-3 text-[14px] font-medium text-[#15213b] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#94a3b8]">
                닫기
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {loading ? <p className="text-[13px] text-[#64748b]">매장 템플릿을 불러오는 중입니다.</p> : null}
          {currentTemplate && !editable ? (
            <div className="rounded-[8px] bg-[#f8fafc] p-3">
              <p className="text-[14px] font-medium text-[#15213b]">{currentTemplate.template_name}</p>
              <p className="mt-1 whitespace-pre-wrap text-[14px] leading-5 text-[#475569]">{currentTemplate.template_content}</p>
              {currentTemplate.template_buttons?.map((button) => <p key={button.buttonName} className="mt-2 text-[13px] text-[#475569]">버튼 · {button.buttonName}</p>)}
              <p className="mt-2 text-[12px] text-[#64748b]">승인 전까지 기존 알림 문구가 유지됩니다.</p>
              {canCreateVersion ? <button type="button" onClick={() => setNewVersion(true)} className="mt-2 min-h-11 rounded-[8px] border border-[#dbe2ea] px-3 text-[14px] font-medium text-[#15213b]">새 문구 작성</button> : null}
            </div>
          ) : (
            <>
              <label className="block">
                <span className="mb-1 block text-[13px] font-medium text-[#475569]">템플릿 이름</span>
                <input value={templateName} onChange={(event) => setTemplateName(event.target.value)} maxLength={100} className="min-h-11 w-full rounded-[8px] border border-[#dbe2ea] px-3 text-[14px] text-[#15213b] outline-none focus:border-[#64748b]" placeholder={`${notificationTitle} 안내`} />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-[13px] font-medium text-[#475569]">버튼 이름</span>
                  <input value={buttonName} onChange={(event) => setButtonName(event.target.value)} maxLength={14} className="min-h-11 w-full rounded-[8px] border border-[#dbe2ea] px-3 text-[14px] text-[#15213b] outline-none focus:border-[#64748b]" placeholder="예약 확인" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[13px] font-medium text-[#475569]">버튼 링크</span>
                  <input type="url" value={buttonUrl} onChange={(event) => setButtonUrl(event.target.value)} className="min-h-11 w-full rounded-[8px] border border-[#dbe2ea] px-3 text-[14px] text-[#15213b] outline-none focus:border-[#64748b]" placeholder="https://" />
                </label>
              </div>
              {needsButton ? <p className="text-[12px] leading-4 text-[#64748b]">이 알림은 쏘다 심사용 버튼이 필요합니다.</p> : null}
              <label className="block">
                <span className="mb-1 block text-[13px] font-medium text-[#475569]">카테고리</span>
                <select value={categoryCode} onChange={(event) => setCategoryCode(event.target.value)} className="min-h-11 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] text-[#15213b] outline-none focus:border-[#64748b]">
                  {categories.map((category) => <option key={category.code} value={category.code}>{category.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[13px] font-medium text-[#475569]">보호자에게 보낼 내용</span>
                <textarea value={templateContent} onChange={(event) => setTemplateContent(event.target.value)} maxLength={1000} rows={6} className="w-full resize-y rounded-[8px] border border-[#dbe2ea] px-3 py-2.5 text-[14px] leading-5 text-[#15213b] outline-none focus:border-[#64748b]" placeholder="원하는 문구를 적어주세요. 예약일시, 반려동물명 등 필요한 정보를 함께 적을 수 있습니다." />
                <span className="mt-1 block text-right text-[12px] text-[#64748b]">{templateContent.length} / 1,000</span>
              </label>
              <p className="text-[12px] leading-4 text-[#64748b]">자동으로 바뀌는 값: {"#{매장명}"}, {"#{반려동물명}"}, {"#{보호자명}"}, {"#{예약일시}"}, {"#{서비스명}"}</p>
              {templateContent ? (
                <div className="rounded-[8px] border border-[#e8edf3] bg-[#f8fafc] p-3" aria-label="작성 중인 문구 미리보기">
                  <p className="mb-1 text-[12px] text-[#64748b]">미리보기</p>
                  <p className="whitespace-pre-wrap text-[14px] leading-5 text-[#15213b]">{sampleMessage}</p>
                  {buttonName && buttonUrl ? <p className="mt-2 border-t border-[#e8edf3] pt-2 text-center text-[13px] font-medium text-[#475569]">{buttonName}</p> : null}
                </div>
              ) : null}
              <p className="text-[12px] leading-4 text-[#64748b]">검수 요청 뒤 승인되면 이 매장의 {notificationTitle} 알림에 사용됩니다.</p>
              {error ? <p role="alert" className="text-[13px] text-[#9a5e4e]">{error}</p> : null}
              {notice ? <p role="status" className="text-[13px] text-[#1f6b5b]">{notice}</p> : null}
            </>
          )}
          {error && !editable ? <p role="alert" className="text-[13px] text-[#9a5e4e]">{error}</p> : null}
            </div>
            {editable ? (
              <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-[#e8edf3] bg-white px-4 py-3 sm:px-5">
                <button type="button" disabled={saving || loading || !categories.length} onClick={() => void save("save")} className="min-h-11 rounded-[8px] border border-[#dbe2ea] px-4 text-[14px] font-medium text-[#15213b] disabled:opacity-50">임시 저장</button>
                <button type="button" disabled={saving || loading || !categories.length} onClick={() => void save("submit")} className="min-h-11 rounded-[8px] bg-[#15213b] px-4 text-[14px] font-medium text-white disabled:opacity-50">{saving ? "요청 중…" : "쏘다 검수 요청"}</button>
              </footer>
            ) : null}
          </section>
        </div>
      ) : null}
    </section>
  );
}
