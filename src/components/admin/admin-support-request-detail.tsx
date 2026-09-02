"use client";

import { ExternalLink, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  formatAdminDateTime,
  supportRequestCategoryLabels,
  supportRequestStatusLabels,
  type OwnerSupportRequestItem,
  type OwnerSupportRequestStatus,
} from "@/components/admin/admin-dashboard-model";
import { getAdminErrorMessage } from "@/components/admin/admin-error-message";
import { ADMIN_TYPOGRAPHY } from "@/components/admin/admin-typography";
import { fetchApiJson } from "@/lib/api";

const STATUS_OPTIONS: OwnerSupportRequestStatus[] = ["open", "reviewing", "answered", "resolved", "closed"];

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

const PRIORITY_LABELS: Record<OwnerSupportRequestItem["priority"], string> = {
  low: "낮음",
  normal: "보통",
  urgent: "긴급",
};

export default function AdminSupportRequestDetail({
  request,
  onClose,
  onSaved,
}: {
  request: OwnerSupportRequestItem;
  onClose: () => void;
  onSaved: (request: OwnerSupportRequestItem) => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const activeRequestIdRef = useRef(request.id);
  const [status, setStatus] = useState<OwnerSupportRequestStatus>(request.status);
  const [adminNote, setAdminNote] = useState(request.adminNote);
  const [answerMessage, setAnswerMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (activeRequestIdRef.current === request.id) return;
    activeRequestIdRef.current = request.id;
    setStatus(request.status);
    setAdminNote(request.adminNote);
    setAnswerMessage("");
    setError(null);
    setNotice(null);
  }, [request.adminNote, request.id, request.status]);

  useEffect(() => {
    closeButtonRef.current?.focus();
    const containDialogFocus = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusableElements = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true",
      );

      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;
      if (event.shiftKey && (activeElement === firstFocusable || !dialog.contains(activeElement))) {
        event.preventDefault();
        lastFocusable.focus();
      } else if (!event.shiftKey && (activeElement === lastFocusable || !dialog.contains(activeElement))) {
        event.preventDefault();
        firstFocusable.focus();
      }
    };
    window.addEventListener("keydown", containDialogFocus);
    return () => window.removeEventListener("keydown", containDialogFocus);
  }, [onClose]);

  async function save() {
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetchApiJson<{ request: OwnerSupportRequestItem }>("/api/admin/support-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: request.id,
          status,
          adminNote,
          answerMessage,
        }),
      });
      onSaved(response.request);
      setStatus(response.request.status);
      setAdminNote(response.request.adminNote);
      setAnswerMessage("");
      setNotice(answerMessage.trim() ? "답변을 저장했습니다." : "처리 상태를 저장했습니다.");
    } catch (cause) {
      setError(getAdminErrorMessage(cause, "문의 처리 내용을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#0f172a]/25"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="support-detail-title"
        tabIndex={-1}
        className="h-full w-full overflow-y-auto border-l border-[#dce5f0] bg-white p-5 sm:max-w-[600px] sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className={`${ADMIN_TYPOGRAPHY.meta} text-[#2563eb]`}>
              {supportRequestCategoryLabels[request.category]} · {supportRequestStatusLabels[request.status]}
            </p>
            <h2 id="support-detail-title" className={`mt-1 break-words text-[#0f172a] ${ADMIN_TYPOGRAPHY.sectionTitle}`}>
              {request.title}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="문의 상세 닫기"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] border border-[#dbe4ef] text-[#475569] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <dl className={`mt-5 grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 gap-y-2 text-[#334155] ${ADMIN_TYPOGRAPHY.body}`}>
          <dt className="text-[#64748b]">매장</dt>
          <dd>{request.shopName ?? request.shopId}</dd>
          <dt className="text-[#64748b]">접수</dt>
          <dd>{formatAdminDateTime(request.createdAt)}</dd>
          <dt className="text-[#64748b]">우선순위</dt>
          <dd>{PRIORITY_LABELS[request.priority]}</dd>
          <dt className="text-[#64748b]">신청자</dt>
          <dd>{request.ownerName || "확인되지 않음"}</dd>
          <dt className="text-[#64748b]">연락처</dt>
          <dd className="break-all">{request.contact || request.ownerPhone || request.ownerEmail || "확인되지 않음"}</dd>
        </dl>

        <section className="mt-6 rounded-[10px] border border-[#dce5f0] p-4">
          <h3 className={`${ADMIN_TYPOGRAPHY.meta} text-[#475569]`}>문의 내용</h3>
          <p className={`mt-2 whitespace-pre-wrap break-words text-[#0f172a] ${ADMIN_TYPOGRAPHY.body}`}>{request.message}</p>
        </section>

        {request.messages.length > 0 ? (
          <section className="mt-5">
            <h3 className={`${ADMIN_TYPOGRAPHY.meta} text-[#475569]`}>대화 내역</h3>
            <div className="mt-2 grid gap-2">
              {request.messages.map((message) => (
                <div key={message.id} className="rounded-[10px] border border-[#e2e8f0] bg-[#f8fafc] p-3">
                  <div className={`flex flex-wrap items-center justify-between gap-2 text-[#64748b] ${ADMIN_TYPOGRAPHY.helper}`}>
                    <span>{message.senderName || (message.senderType === "admin" ? "운영팀" : "오너")}</span>
                    <span>{formatAdminDateTime(message.createdAt)}</span>
                  </div>
                  <p className={`mt-1 whitespace-pre-wrap break-words text-[#0f172a] ${ADMIN_TYPOGRAPHY.body}`}>{message.message}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {request.attachments.length > 0 ? (
          <section className="mt-5">
            <h3 className={`${ADMIN_TYPOGRAPHY.meta} text-[#475569]`}>첨부 파일</h3>
            <div className="mt-2 grid gap-2">
              {request.attachments.map((attachment) => (
                <a
                  key={attachment.id}
                  href={attachment.signedUrl || attachment.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`inline-flex min-h-11 items-center justify-between gap-3 rounded-[8px] border border-[#dbe4ef] px-3 text-[#334155] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] ${ADMIN_TYPOGRAPHY.body}`}
                >
                  <span className="truncate">{attachment.fileName}</span>
                  <ExternalLink className="h-4 w-4 shrink-0" />
                </a>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-6 grid gap-4 border-t border-[#e2e8f0] pt-5">
          <label className={`${ADMIN_TYPOGRAPHY.label} text-[#475569]`}>
            처리 상태
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as OwnerSupportRequestStatus)}
              className={`mt-2 h-11 w-full rounded-[8px] border border-[#dbe4ef] bg-white px-3 text-[#0f172a] outline-none focus:border-[#2563eb] ${ADMIN_TYPOGRAPHY.body}`}
            >
              {STATUS_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {supportRequestStatusLabels[value]}
                </option>
              ))}
            </select>
          </label>
          <label className={`${ADMIN_TYPOGRAPHY.label} text-[#475569]`}>
            운영 메모
            <textarea
              value={adminNote}
              onChange={(event) => setAdminNote(event.target.value)}
              maxLength={3000}
              className={`mt-2 min-h-24 w-full rounded-[8px] border border-[#dbe4ef] px-3 py-2.5 text-[#0f172a] outline-none focus:border-[#2563eb] ${ADMIN_TYPOGRAPHY.body}`}
              placeholder="내부 확인 내용을 남겨 주세요."
            />
          </label>
          <label className={`${ADMIN_TYPOGRAPHY.label} text-[#475569]`}>
            오너 답변
            <textarea
              value={answerMessage}
              onChange={(event) => setAnswerMessage(event.target.value)}
              maxLength={5000}
              className={`mt-2 min-h-32 w-full rounded-[8px] border border-[#dbe4ef] px-3 py-2.5 text-[#0f172a] outline-none focus:border-[#2563eb] ${ADMIN_TYPOGRAPHY.body}`}
              placeholder="답변을 입력하면 저장과 함께 오너에게 전달됩니다."
            />
          </label>
        </section>

        {error ? <p role="alert" className={`mt-4 rounded-[8px] border border-[#f0d1d1] bg-[#fff7f7] px-4 py-3 text-[#a04455] ${ADMIN_TYPOGRAPHY.body}`}>{error}</p> : null}
        {notice ? <p aria-live="polite" className={`mt-4 rounded-[8px] border border-[#cde4d8] bg-[#f4faf7] px-4 py-3 text-[#1f6b5b] ${ADMIN_TYPOGRAPHY.body}`}>{notice}</p> : null}

        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className={`mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-[#2563eb] px-4 text-white disabled:opacity-60 ${ADMIN_TYPOGRAPHY.control}`}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {saving ? "저장 중" : answerMessage.trim() ? "답변 저장" : "상태 저장"}
        </button>
      </aside>
    </div>
  );
}
