"use client";

import { CheckCircle2, Send, Star, X } from "lucide-react";
import { useEffect, useState } from "react";

import { fetchApiJsonWithAuth } from "@/lib/api";
import { cn } from "@/lib/utils";

const requestKinds = [
  { value: "service_improvement", label: "서비스 개선 요청" },
  { value: "new_feature", label: "신규 기능 요청" },
  { value: "praise", label: "칭찬하기" },
  { value: "other", label: "기타 의견" },
] as const;

type RequestKind = (typeof requestKinds)[number]["value"];

export default function OwnerFeatureRequestDialog({
  open,
  shopId,
  shopName,
  ownerName,
  ownerPhone,
  onClose,
}: {
  open: boolean;
  shopId: string;
  shopName: string;
  ownerName: string;
  ownerPhone: string;
  onClose: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [requestKind, setRequestKind] = useState<RequestKind>("service_improvement");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState(ownerPhone);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [requestNumber, setRequestNumber] = useState("");

  useEffect(() => {
    if (!open) return;
    setContact((current) => current || ownerPhone);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open, ownerPhone, submitting]);

  if (!open) return null;

  const selectedKind = requestKinds.find((item) => item.value === requestKind) ?? requestKinds[0];
  const canSubmit = rating > 0 && message.trim().length >= 5 && !submitting;

  async function submitFeatureRequest() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");

    try {
      const response = await fetchApiJsonWithAuth<{ request: { id: string } }>("/api/owner/support-requests", {
        method: "POST",
        body: JSON.stringify({
          shopId,
          requestType: "improvement",
          category: "feature_request",
          title: `[기능 개선] ${selectedKind.label}`,
          contact: contact.trim(),
          ownerName,
          ownerPhone: ownerPhone || contact.trim(),
          message: message.trim(),
          context: {
            shopName,
            shopId,
            feedbackRating: rating,
            feedbackType: requestKind,
            feedbackTypeLabel: selectedKind.label,
            currentPath: window.location.pathname,
            currentUrl: window.location.href,
            userAgent: window.navigator.userAgent,
            createdAt: new Date().toISOString(),
          },
        }),
      });

      setRequestNumber(response.request.id.slice(0, 8).toUpperCase());
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "기능 개선 요청을 접수하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  function closeDialog() {
    if (submitting) return;
    onClose();
    window.setTimeout(() => {
      setRating(0);
      setRequestKind("service_improvement");
      setMessage("");
      setError("");
      setRequestNumber("");
    }, 180);
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-[#111827]/45 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeDialog();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="feature-request-title"
        className="max-h-[calc(100vh-32px)] w-full max-w-[680px] overflow-y-auto rounded-[8px] border border-[#dbe2ea] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.22)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#edf1f5] px-6 py-5">
          <div>
            <h2 id="feature-request-title" className="text-[22px] font-semibold text-[#111827]">
              넘친Day에 바라는 점을 알려주세요
            </h2>
            <p className="mt-1 text-[14px] leading-5 text-[#64748b]">
              보내주신 의견은 서비스 개선 우선순위를 정하는 데 활용됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={closeDialog}
            disabled={submitting}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] text-[#64748b] transition hover:bg-[#f1f5f9] hover:text-[#111827] disabled:opacity-40"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {requestNumber ? (
          <div className="px-6 py-10 text-center">
            <CheckCircle2 className="mx-auto h-11 w-11 text-[#1f9d55]" strokeWidth={1.8} />
            <h3 className="mt-4 text-[20px] font-semibold text-[#111827]">소중한 의견을 보내주셔서 감사합니다</h3>
            <p className="mt-2 text-[14px] leading-6 text-[#64748b]">
              요청번호 {requestNumber}로 접수되었습니다. 답변은 1:1 문의 내역에서 확인할 수 있습니다.
            </p>
            <button
              type="button"
              onClick={closeDialog}
              className="mt-6 inline-flex h-10 items-center justify-center rounded-[8px] bg-[#2f7866] px-5 text-[14px] font-semibold text-white transition hover:bg-[#286a5a]"
            >
              확인
            </button>
          </div>
        ) : (
          <div className="space-y-5 px-6 py-5">
            <fieldset>
              <legend className="text-[14px] font-semibold text-[#334155]">현재 서비스가 얼마나 도움이 되고 있나요?</legend>
              <div className="mt-2 flex h-[88px] items-center justify-center gap-3 rounded-[8px] bg-[#f8fafc]">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRating(value)}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-[8px] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b9d8cf]"
                    aria-label={`${value}점`}
                    aria-pressed={rating === value}
                  >
                    <Star
                      className={cn("h-8 w-8", value <= rating ? "fill-[#f5a65b] text-[#f5a65b]" : "fill-[#e5e7eb] text-[#e5e7eb]")}
                      strokeWidth={1.5}
                    />
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-[190px_minmax(0,1fr)]">
              <label className="grid content-start gap-1.5">
                <span className="text-[14px] font-semibold text-[#334155]">요청 유형</span>
                <select
                  value={requestKind}
                  onChange={(event) => setRequestKind(event.target.value as RequestKind)}
                  className="h-11 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] font-medium text-[#111827] outline-none transition focus:border-[#2f7866] focus:ring-2 focus:ring-[#dceee8]"
                >
                  {requestKinds.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5">
                <span className="text-[14px] font-semibold text-[#334155]">연락받을 번호 또는 이메일 <span className="font-normal text-[#94a3b8]">(선택)</span></span>
                <input
                  value={contact}
                  onChange={(event) => setContact(event.target.value.slice(0, 200))}
                  className="h-11 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] font-medium text-[#111827] outline-none transition focus:border-[#2f7866] focus:ring-2 focus:ring-[#dceee8]"
                  placeholder="답변을 받을 연락처"
                />
              </label>
            </div>

            <label className="grid gap-1.5">
              <span className="text-[14px] font-semibold text-[#334155]">어떤 점이 더 좋아지면 좋을지 알려주세요</span>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value.slice(0, 500))}
                className="min-h-[150px] resize-y rounded-[8px] border border-[#dbe2ea] bg-white px-3 py-3 text-[15px] font-medium leading-6 text-[#111827] outline-none transition placeholder:text-[#94a3b8] focus:border-[#2f7866] focus:ring-2 focus:ring-[#dceee8]"
                placeholder="불편했던 흐름이나 필요한 기능을 구체적으로 적어주세요."
              />
              <span className="text-right text-[12px] tabular-nums text-[#64748b]">{message.length}/500</span>
            </label>

            {error ? (
              <p className="rounded-[8px] border border-[#efcaca] bg-[#fff7f7] px-3 py-2 text-[13px] font-medium text-[#b42318]">{error}</p>
            ) : null}

            <div className="flex justify-end gap-2 border-t border-[#edf1f5] pt-4">
              <button
                type="button"
                onClick={closeDialog}
                disabled={submitting}
                className="inline-flex h-10 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white px-4 text-[14px] font-semibold text-[#475569] transition hover:bg-[#f8fafc] disabled:opacity-40"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={() => void submitFeatureRequest()}
                disabled={!canSubmit}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-[#2f7866] px-4 text-[14px] font-semibold text-white transition hover:bg-[#286a5a] disabled:cursor-not-allowed disabled:bg-[#d7dde3]"
              >
                <Send className="h-4 w-4" />
                {submitting ? "보내는 중..." : "의견 보내기"}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
