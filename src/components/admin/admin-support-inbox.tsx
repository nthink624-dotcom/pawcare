"use client";

import {
  Check,
  ChevronRight,
  ExternalLink,
  Lightbulb,
  MessageSquareText,
  RefreshCcw,
  Send,
} from "lucide-react";
import { useState } from "react";

import {
  formatAdminDateTime,
  isPendingSupportRequest,
  supportRequestCategoryLabels,
  supportRequestStatusLabels,
  type OwnerSupportRequestItem,
  type OwnerSupportRequestStatus,
} from "@/components/admin/admin-dashboard-model";

type InboxFilter = "pending" | "inquiry" | "feature" | "all";

const filters: Array<{ key: InboxFilter; label: string }> = [
  { key: "pending", label: "미처리" },
  { key: "inquiry", label: "1:1 문의" },
  { key: "feature", label: "기능 개선" },
  { key: "all", label: "전체" },
];

function matchesFilter(
  request: OwnerSupportRequestItem,
  filter: InboxFilter,
) {
  if (filter === "pending") return isPendingSupportRequest(request);
  if (filter === "feature") return request.category === "feature_request";
  if (filter === "inquiry") return request.category !== "feature_request";
  return true;
}

function getFilterCount(
  requests: OwnerSupportRequestItem[],
  filter: InboxFilter,
) {
  return requests.filter((request) => matchesFilter(request, filter)).length;
}

function statusClass(status: OwnerSupportRequestStatus) {
  if (status === "open") {
    return "border-[#f1d7a7] bg-[#fff9ed] text-[#9a651a]";
  }
  if (status === "reviewing") {
    return "border-[#cbdcf8] bg-[#f5f8ff] text-[#2563eb]";
  }
  if (status === "answered" || status === "resolved") {
    return "border-[#cfe3dc] bg-[#f4fbf8] text-[#1f6b5b]";
  }
  return "border-[#dbe2ea] bg-[#f8fafc] text-[#64748b]";
}

export default function AdminSupportInbox({
  requests,
  error,
  loading,
  savingId,
  onRefresh,
  onUpdate,
}: {
  requests: OwnerSupportRequestItem[];
  error: string | null;
  loading: boolean;
  savingId: string | null;
  onRefresh: () => void;
  onUpdate: (
    id: string,
    status: OwnerSupportRequestStatus,
    adminNote: string,
    answerMessage?: string,
  ) => Promise<boolean>;
}) {
  const [filter, setFilter] = useState<InboxFilter>("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const visibleRequests = requests.filter((request) =>
    matchesFilter(request, filter),
  );
  const selectedRequest =
    visibleRequests.find((request) => request.id === selectedId) ??
    visibleRequests[0] ??
    null;
  const pendingCount = getFilterCount(requests, "pending");

  return (
    <section className="overflow-hidden rounded-[10px] border border-[#e2e8f0] bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eef2f6] px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquareText className="h-5 w-5 text-[#1f6b5b]" />
          <h2 className="text-[17px] font-semibold text-[#111827]">
            문의함
          </h2>
          <span
            className={`rounded-full px-2 py-0.5 text-[12px] font-semibold ${
              pendingCount > 0
                ? "bg-[#fff1e4] text-[#9a5d12]"
                : "bg-[#edf6f2] text-[#1f6b5b]"
            }`}
          >
            미처리 {pendingCount}
          </span>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex h-8 items-center gap-1.5 rounded-[7px] border border-[#dbe2ea] px-2.5 text-[13px] text-[#64748b] hover:bg-[#f8fafc] disabled:opacity-50"
        >
          <RefreshCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          새로고침
        </button>
      </header>

      <nav
        className="flex gap-1 overflow-x-auto border-b border-[#eef2f6] px-3 py-2"
        aria-label="문의 필터"
      >
        {filters.map((item) => {
          const active = filter === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setFilter(item.key);
                setSelectedId(null);
              }}
              className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[7px] px-3 text-[13px] font-medium ${
                active
                  ? "bg-[#1f6b5b] text-white"
                  : "text-[#64748b] hover:bg-[#f1f5f9]"
              }`}
              aria-pressed={active}
            >
              {item.label}
              <span className={active ? "text-white/75" : "text-[#94a3b8]"}>
                {getFilterCount(requests, item.key)}
              </span>
            </button>
          );
        })}
      </nav>

      {error ? (
        <p className="m-4 rounded-[7px] border border-[#f0d1d1] bg-[#fff7f7] px-3 py-2 text-[13px] text-[#a04455]">
          {error}
        </p>
      ) : null}

      <div className="grid min-h-[520px] lg:grid-cols-[330px_minmax(0,1fr)]">
        <div className="border-b border-[#eef2f6] lg:border-b-0 lg:border-r">
          {visibleRequests.length === 0 ? (
            <EmptyInbox filter={filter} loading={loading} />
          ) : (
            <div className="max-h-[680px] divide-y divide-[#eef2f6] overflow-y-auto">
              {visibleRequests.map((request) => (
                <RequestRow
                  key={request.id}
                  request={request}
                  selected={request.id === selectedRequest?.id}
                  onClick={() => setSelectedId(request.id)}
                />
              ))}
            </div>
          )}
        </div>

        {selectedRequest ? (
          <SupportRequestDetail
            key={selectedRequest.id}
            request={selectedRequest}
            saving={savingId === selectedRequest.id}
            onUpdate={onUpdate}
          />
        ) : (
          <div className="hidden items-center justify-center text-[14px] text-[#94a3b8] lg:flex">
            확인할 문의를 선택해 주세요.
          </div>
        )}
      </div>
    </section>
  );
}

function EmptyInbox({
  filter,
  loading,
}: {
  filter: InboxFilter;
  loading: boolean;
}) {
  const label =
    filter === "pending"
      ? "처리할 문의가 없습니다."
      : filter === "feature"
        ? "접수된 기능 개선 요청이 없습니다."
        : filter === "inquiry"
          ? "접수된 1:1 문의가 없습니다."
          : "접수된 문의가 없습니다.";

  return (
    <div className="flex min-h-[220px] items-center justify-center px-4 text-center text-[13px] text-[#94a3b8]">
      {loading ? "문의 내역을 불러오는 중입니다." : label}
    </div>
  );
}

function RequestRow({
  request,
  selected,
  onClick,
}: {
  request: OwnerSupportRequestItem;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`grid w-full grid-cols-[minmax(0,1fr)_18px] items-center gap-2 px-4 py-3 text-left ${
        selected ? "bg-[#f2f8f6]" : "hover:bg-[#f8fafc]"
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          {request.category === "feature_request" ? (
            <Lightbulb className="h-3.5 w-3.5 shrink-0 text-[#7c3aed]" />
          ) : (
            <MessageSquareText className="h-3.5 w-3.5 shrink-0 text-[#607080]" />
          )}
          <span className="text-[12px] font-medium text-[#64748b]">
            {supportRequestCategoryLabels[request.category]}
          </span>
          <span
            className={`ml-auto rounded-full border px-1.5 py-0.5 text-[11px] font-medium ${statusClass(request.status)}`}
          >
            {supportRequestStatusLabels[request.status]}
          </span>
        </div>
        <p className="mt-1.5 truncate text-[14px] font-semibold text-[#111827]">
          {request.title}
        </p>
        <div className="mt-1 flex items-center justify-between gap-2 text-[12px] text-[#94a3b8]">
          <span className="truncate">{request.shopName ?? request.shopId}</span>
          <span className="shrink-0">
            {formatAdminDateTime(request.createdAt)}
          </span>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-[#94a3b8]" />
    </button>
  );
}

function SupportRequestDetail({
  request,
  saving,
  onUpdate,
}: {
  request: OwnerSupportRequestItem;
  saving: boolean;
  onUpdate: (
    id: string,
    status: OwnerSupportRequestStatus,
    adminNote: string,
    answerMessage?: string,
  ) => Promise<boolean>;
}) {
  const [status, setStatus] = useState(request.status);
  const [adminNote, setAdminNote] = useState(request.adminNote);
  const [answerMessage, setAnswerMessage] = useState("");
  const conversation = request.messages.length
    ? request.messages
    : [
        {
          id: `${request.id}-initial`,
          senderType: "owner" as const,
          senderName: request.ownerName || null,
          message: request.message,
          isAnswer: false,
          createdAt: request.createdAt,
        },
      ];
  const feedbackLabel =
    typeof request.context.feedbackTypeLabel === "string"
      ? request.context.feedbackTypeLabel
      : null;
  const feedbackRating =
    typeof request.context.feedbackRating === "number"
      ? request.context.feedbackRating
      : null;

  async function saveStatus() {
    await onUpdate(request.id, status, adminNote, "");
  }

  async function sendAnswer() {
    const answer = answerMessage.trim();
    if (!answer) return;
    const saved = await onUpdate(request.id, "answered", adminNote, answer);
    if (!saved) return;
    setStatus("answered");
    setAnswerMessage("");
  }

  return (
    <article className="min-w-0 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eef2f6] pb-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-semibold text-[#1f6b5b]">
              {supportRequestCategoryLabels[request.category]}
            </span>
            <span className="text-[12px] text-[#94a3b8]">
              {formatAdminDateTime(request.createdAt)}
            </span>
          </div>
          <h3 className="mt-1 text-[18px] font-semibold tracking-[-0.02em] text-[#111827]">
            {request.title}
          </h3>
          <p className="mt-1 text-[13px] text-[#64748b]">
            {request.shopName ?? request.shopId}
            {request.ownerName ? ` · ${request.ownerName}` : ""}
            {request.ownerPhone || request.contact
              ? ` · ${request.ownerPhone || request.contact}`
              : ""}
          </p>
          {feedbackLabel || feedbackRating ? (
            <p className="mt-1 text-[12px] text-[#7c3aed]">
              {[feedbackLabel, feedbackRating ? `만족도 ${feedbackRating}/5` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
        </div>
        <span
          className={`rounded-full border px-2 py-1 text-[12px] font-medium ${statusClass(request.status)}`}
        >
          {supportRequestStatusLabels[request.status]}
        </span>
      </div>

      <div className="mt-3 max-h-[250px] space-y-2 overflow-y-auto rounded-[8px] bg-[#f8fafc] p-3">
        {conversation.map((message) => {
          const fromAdmin = message.senderType === "admin";
          return (
            <div
              key={message.id}
              className={`max-w-[88%] rounded-[8px] px-3 py-2 ${
                fromAdmin
                  ? "ml-auto bg-[#e8f4f0] text-[#174f43]"
                  : "bg-white text-[#334155]"
              }`}
            >
              <p className="text-[11px] font-semibold opacity-70">
                {fromAdmin
                  ? message.senderName || "운영팀"
                  : message.senderName || "오너"}
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-5">
                {message.message}
              </p>
            </div>
          );
        })}
      </div>

      {request.attachments.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {request.attachments.map((attachment) => (
            <a
              key={attachment.id}
              href={attachment.signedUrl || attachment.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-[7px] border border-[#dbe2ea] px-2.5 text-[12px] text-[#475569] hover:bg-[#f8fafc]"
            >
              {attachment.fileName}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ))}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3">
        <label>
          <span className="text-[12px] font-semibold text-[#475569]">
            오너에게 보낼 답변
          </span>
          <textarea
            value={answerMessage}
            onChange={(event) => setAnswerMessage(event.target.value)}
            placeholder="답변을 입력하세요."
            className="mt-1 min-h-[88px] w-full resize-y rounded-[8px] border border-[#dbe2ea] px-3 py-2 text-[13px] leading-5 text-[#111827] outline-none focus:border-[#1f6b5b]"
          />
        </label>
        <button
          type="button"
          onClick={() => void sendAnswer()}
          disabled={saving || !answerMessage.trim()}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] bg-[#1f6b5b] px-4 text-[13px] font-semibold text-white disabled:bg-[#b9c3cf]"
        >
          <Send className="h-3.5 w-3.5" />
          {saving ? "처리 중" : "답변 보내기"}
        </button>
      </div>

      <details className="mt-3 rounded-[8px] border border-[#e2e8f0]">
        <summary className="cursor-pointer px-3 py-2 text-[12px] font-semibold text-[#64748b]">
          처리 상태와 내부 메모
        </summary>
        <div className="grid gap-2 border-t border-[#eef2f6] p-3 sm:grid-cols-[140px_minmax(0,1fr)_auto]">
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as OwnerSupportRequestStatus)
            }
            className="h-9 rounded-[7px] border border-[#dbe2ea] bg-white px-2 text-[13px] text-[#334155]"
          >
            <option value="open">접수</option>
            <option value="reviewing">확인 중</option>
            <option value="answered">답변 완료</option>
            <option value="closed">종료</option>
          </select>
          <input
            value={adminNote}
            onChange={(event) => setAdminNote(event.target.value)}
            placeholder="오너에게 보이지 않는 내부 메모"
            className="h-9 min-w-0 rounded-[7px] border border-[#dbe2ea] px-3 text-[13px] text-[#334155]"
          />
          <button
            type="button"
            onClick={() => void saveStatus()}
            disabled={saving}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[7px] border border-[#cfe3dc] bg-[#f4fbf8] px-3 text-[13px] font-semibold text-[#1f6b5b] disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" />
            저장
          </button>
        </div>
      </details>
    </article>
  );
}
