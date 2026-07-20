"use client";

import { AlertCircle, CheckCircle2, ChevronRight, ImagePlus, Loader2, MessageCircle, RotateCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { fetchApiJsonWithAuth } from "@/lib/api";
import type { BootstrapPayload } from "@/types/domain";

type SupportCategory =
  | "how_to_use"
  | "bug"
  | "payment"
  | "feature_request"
  | "account"
  | "notification"
  | "other";

type OwnerSupportRequest = {
  id: string;
  category?: string | null;
  title?: string | null;
  message?: string | null;
  status?: string | null;
  admin_reply?: string | null;
  reply?: string | null;
  answer?: string | null;
  answered_at?: string | null;
  created_at?: string | null;
  read_at?: string | null;
  owner_read_at?: string | null;
  answer_read_at?: string | null;
};

type SupportListResponse =
  | OwnerSupportRequest[]
  | {
      requests?: OwnerSupportRequest[];
      items?: OwnerSupportRequest[];
      data?: OwnerSupportRequest[];
    };

const categoryOptions: Array<{ value: SupportCategory; label: string }> = [
  { value: "how_to_use", label: "이용 방법" },
  { value: "bug", label: "오류/버그" },
  { value: "payment", label: "결제" },
  { value: "feature_request", label: "기능 요청" },
  { value: "account", label: "계정" },
  { value: "notification", label: "알림/알림톡" },
  { value: "other", label: "기타" },
];

const statusLabels: Record<string, string> = {
  received: "접수됨",
  open: "접수됨",
  reviewing: "확인중",
  in_progress: "확인중",
  answered: "답변완료",
  replied: "답변완료",
  closed: "종료",
};

function normalizeSupportList(response: SupportListResponse) {
  if (Array.isArray(response)) return response;
  return response.requests ?? response.items ?? response.data ?? [];
}

function getAnswer(request: OwnerSupportRequest) {
  return request.admin_reply || request.reply || request.answer || "";
}

function isAnswered(request: OwnerSupportRequest) {
  return Boolean(getAnswer(request)) || ["answered", "replied", "closed"].includes(String(request.status ?? ""));
}

function isUnreadAnswer(request: OwnerSupportRequest) {
  if (!isAnswered(request)) return false;
  return !request.read_at && !request.owner_read_at && !request.answer_read_at;
}

function formatDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const year = String(date.getFullYear()).slice(2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}.${month}.${day} ${hour}:${minute}`;
}

function getPlatform() {
  if (typeof navigator === "undefined") return "web";
  const text = `${navigator.userAgent} ${navigator.platform}`.toLowerCase();
  if (text.includes("iphone") || text.includes("ipad") || text.includes("ios")) return "ios";
  if (text.includes("android")) return "android";
  return "web";
}

export default function OwnerSupportPanel({
  data,
  userEmail,
}: {
  data: BootstrapPayload;
  userEmail?: string | null;
}) {
  const ownerName = data.ownerProfile?.name || data.shop.name;
  const ownerPhone = data.ownerProfile?.phone_number || data.shop.phone || "";
  const [category, setCategory] = useState<SupportCategory>("how_to_use");
  const [title, setTitle] = useState("");
  const [contact, setContact] = useState(ownerPhone || userEmail || "");
  const [message, setMessage] = useState("");
  const [requests, setRequests] = useState<OwnerSupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [readingId, setReadingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"write" | "history">("write");
  const [feedback, setFeedback] = useState<{ type: "idle" | "success" | "error"; message: string }>({
    type: "idle",
    message: "",
  });
  const categoryLabel = useMemo(
    () => categoryOptions.find((option) => option.value === category)?.label ?? "기타",
    [category],
  );

  async function loadRequests() {
    setLoading(true);
    setFeedback({ type: "idle", message: "" });
    try {
      const query = new URLSearchParams({ shopId: data.shop.id, limit: "20" });
      const response = await fetchApiJsonWithAuth<SupportListResponse>(`/api/owner/support-requests?${query.toString()}`, {
        cache: "no-store",
      });
      setRequests(normalizeSupportList(response));
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "문의 내역을 불러오지 못했습니다.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (activeView !== "history") return;
    void loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.shop.id, activeView]);

  async function submitSupportRequest() {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      setFeedback({ type: "error", message: "문의 내용을 입력해 주세요." });
      return;
    }

    setSubmitting(true);
    setFeedback({ type: "idle", message: "" });
    try {
      await fetchApiJsonWithAuth("/api/owner/support-requests", {
        method: "POST",
        body: JSON.stringify({
          shopId: data.shop.id,
          category,
          title: title.trim(),
          contact: contact.trim(),
          ownerName,
          ownerPhone,
          ownerEmail: userEmail ?? "",
          message: trimmedMessage,
          context: {
            shopName: data.shop.name,
            shopId: data.shop.id,
            currentPath: typeof window !== "undefined" ? window.location.pathname : "",
            currentUrl: typeof window !== "undefined" ? window.location.href : "",
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
            platform: getPlatform(),
            appVersion: "mobile-web",
            createdAt: new Date().toISOString(),
          },
        }),
      });
      setTitle("");
      setMessage("");
      setCategory("how_to_use");
      setFeedback({ type: "success", message: "문의가 접수되었습니다." });
      await loadRequests();
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "문의 접수에 실패했습니다.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function openRequest(request: OwnerSupportRequest) {
    setExpandedId((prev) => (prev === request.id ? null : request.id));
    if (!getAnswer(request) || !isUnreadAnswer(request)) return;

    setReadingId(request.id);
    try {
      await fetchApiJsonWithAuth("/api/owner/support-requests", {
        method: "PATCH",
        body: JSON.stringify({ shopId: data.shop.id, requestId: request.id }),
      });
      setRequests((prev) =>
        prev.map((item) => (item.id === request.id ? { ...item, read_at: new Date().toISOString() } : item)),
      );
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "읽음 처리에 실패했습니다.",
      });
    } finally {
      setReadingId(null);
    }
  }

  return (
    <section className="space-y-4 bg-white p-4">
      <div className="hidden">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-[#2563eb]" strokeWidth={2} />
          <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-[var(--text)]">1:1 문의</h2>
        </div>
        <p className="text-[14px] leading-5 text-[var(--muted)]">
          사용 중 불편한 점이나 궁금한 내용을 남겨주세요. 현재 화면과 기기 정보가 함께 전달됩니다.
        </p>
      </div>

      <div className="grid grid-cols-2 rounded-[10px] border border-[#e2e7ed] bg-[#f6f7f9] p-1">
        <button
          type="button"
          onClick={() => setActiveView("write")}
          className={`h-9 rounded-[7px] text-[13px] font-semibold ${activeView === "write" ? "bg-white text-[#0f172a] shadow-[0_1px_2px_rgba(15,23,42,0.08)]" : "text-[#64748b]"}`}
        >
          문의하기
        </button>
        <button
          type="button"
          onClick={() => setActiveView("history")}
          className={`h-9 rounded-[7px] text-[13px] font-semibold ${activeView === "history" ? "bg-white text-[#0f172a] shadow-[0_1px_2px_rgba(15,23,42,0.08)]" : "text-[#64748b]"}`}
        >
          문의 내역
        </button>
      </div>

      {activeView === "write" ? (
      <div className="space-y-3">
        <label className="block space-y-1.5">
          <span className="text-[14px] font-medium text-[var(--text)]">문의 유형</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as SupportCategory)}
            className="h-11 w-full rounded-[10px] border border-[#e2e7ed] bg-[#fafbfc] px-3.5 text-[14.5px] font-medium text-[var(--text)] outline-none"
          >
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="text-[14px] font-medium text-[var(--text)]">제목</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={`${categoryLabel} 문의`}
            className="h-11 w-full rounded-[10px] border border-[#e2e7ed] bg-[#fafbfc] px-3.5 text-[14.5px] font-medium text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-[14px] font-medium text-[var(--text)]">연락처</span>
          <input
            value={contact}
            onChange={(event) => setContact(event.target.value)}
            placeholder="답변 받을 연락처"
            className="h-11 w-full rounded-[10px] border border-[#e2e7ed] bg-[#fafbfc] px-3.5 text-[14.5px] font-medium text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-[14px] font-medium text-[var(--text)]">내용</span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="문의 내용을 자세히 적어주세요."
            className="min-h-[104px] w-full resize-none rounded-[10px] border border-[#e2e7ed] bg-[#fafbfc] px-3.5 py-3 text-[14px] leading-[1.55] text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
          />
        </label>

        <div className="flex h-11 items-center gap-2.5 rounded-[10px] border border-dashed border-[#e2e7ed] bg-[#f8fafc] px-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] border border-[#e2e7ed] bg-white text-[#64748b]">
            <ImagePlus className="h-4 w-4" strokeWidth={2} />
          </div>
          <div className="min-w-0 [&>p:last-child]:hidden">
            <p className="text-[13px] font-semibold text-[#334155]">사진 첨부</p>
            <p className="mt-1 text-[11.5px] leading-[1.5] text-[#94a3b8]">이미지 첨부는 업로드 API 연결 후 1~3장까지 사용할 수 있어요.</p>
          </div>
        </div>

        {feedback.message ? (
          <div
            className={`flex items-center gap-2 rounded-[12px] px-3 py-2.5 text-[14px] ${
              feedback.type === "success"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {feedback.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <span>{feedback.message}</span>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => void submitSupportRequest()}
          disabled={submitting}
          className="flex h-[50px] w-full items-center justify-center rounded-[12px] border border-[#2f6fd6] bg-[#2f6fd6] px-4 text-[15px] font-semibold text-white disabled:opacity-50"
        >
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          문의 보내기
        </button>
      </div>
      ) : null}

      {activeView === "history" ? (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[17px] font-semibold tracking-[-0.03em] text-[var(--text)]">문의 내역</h3>
          <button
            type="button"
            onClick={() => void loadRequests()}
            className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-[var(--border)] bg-white px-3 text-[14px] font-medium text-[var(--text)]"
          >
            <RotateCw className="h-3.5 w-3.5" strokeWidth={2} />
            새로고침
          </button>
        </div>

        {loading ? (
          <div className="flex min-h-[128px] items-center justify-center rounded-[16px] border border-[var(--border)] bg-white text-[14px] text-[var(--muted)]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            문의 내역을 불러오는 중이에요
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-[16px] border border-[var(--border)] bg-white px-4 py-8 text-center text-[15px] text-[var(--muted)]">
            아직 남긴 문의가 없어요.
          </div>
        ) : (
          <div className="space-y-2">
            {requests.map((request) => {
              const answer = getAnswer(request);
              const unread = isUnreadAnswer(request);
              const expanded = expandedId === request.id;
              return (
                <article key={request.id} className="overflow-hidden rounded-[16px] border border-[var(--border)] bg-white">
                  <button
                    type="button"
                    onClick={() => void openRequest(request)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[16px] font-semibold tracking-[-0.02em] text-[var(--text)]">
                          {request.title || "제목 없는 문의"}
                        </p>
                        {unread ? (
                          <span className="shrink-0 rounded-full bg-[#2563eb] px-2 py-0.5 text-[12px] font-semibold text-white">
                            새 답변
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[var(--muted)]">
                        <span>{statusLabels[String(request.status ?? "received")] ?? "접수됨"}</span>
                        <span>{formatDateTime(request.created_at)}</span>
                      </div>
                    </div>
                    {readingId === request.id ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--muted)]" />
                    ) : (
                      <ChevronRight className={`h-4 w-4 shrink-0 text-[var(--muted)] transition ${expanded ? "rotate-90" : ""}`} />
                    )}
                  </button>
                  {expanded ? (
                    <div className="space-y-3 border-t border-[var(--border)] px-4 py-3">
                      {request.message ? (
                        <div>
                          <p className="text-[13px] font-medium text-[var(--muted)]">문의 내용</p>
                          <p className="mt-1 whitespace-pre-wrap text-[15px] leading-6 text-[var(--text)]">{request.message}</p>
                        </div>
                      ) : null}
                      <div className="rounded-[12px] bg-[#f8fafc] px-3 py-3">
                        <p className="text-[13px] font-medium text-[var(--muted)]">운영팀 답변</p>
                        <p className="mt-1 whitespace-pre-wrap text-[15px] leading-6 text-[var(--text)]">
                          {answer || "아직 답변이 등록되지 않았어요."}
                        </p>
                        {request.answered_at ? (
                          <p className="mt-2 text-[12px] text-[var(--muted)]">{formatDateTime(request.answered_at)}</p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>
      ) : null}
    </section>
  );
}
