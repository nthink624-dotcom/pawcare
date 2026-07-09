"use client";

import { RefreshCw } from "lucide-react";

import { WebSurface } from "@/components/owner-web/owner-web-ui";
import {
  categoryLabels,
  isUnreadAnsweredRequest,
  type OwnerSupportRequestItem,
  statusLabels,
} from "@/components/owner-web/owner-support-model";
import { cn } from "@/lib/utils";

export default function OwnerSupportHistoryPanel({
  requests,
  loading,
  error,
  onRefresh,
  onMarkAsRead,
}: {
  requests: OwnerSupportRequestItem[];
  loading: boolean;
  error: string;
  onRefresh: () => void;
  onMarkAsRead: (requestId: string) => void;
}) {
  return (
    <WebSurface className="p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-semibold text-[#111827]">1:1 문의 내역</h2>
          <p className="mt-1 text-[13px] font-medium text-[#64748b]">답변은 이곳에서 다시 확인할 수 있습니다.</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex h-9 w-9 items-center justify-center rounded-[9px] border border-[#dbe2ea] bg-white text-[#475569] transition hover:bg-[#f8fafc] disabled:opacity-60"
          title="문의 내역 새로고침"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </button>
      </div>
      {error ? (
        <p className="rounded-[10px] border border-[#efcaca] bg-[#fff7f7] px-3 py-2 text-[14px] font-semibold text-[#b42318]">
          {error}
        </p>
      ) : null}
      {!loading && requests.length === 0 && !error ? (
        <p className="rounded-[10px] border border-[#e5eaf0] bg-[#fbfcfd] px-3 py-6 text-center text-[14px] font-medium text-[#64748b]">
          아직 남긴 문의가 없습니다.
        </p>
      ) : (
        <div className="grid max-h-[430px] gap-2 overflow-y-auto pr-1">
          {requests.map((request) => (
            <OwnerSupportHistoryCard key={request.id} request={request} onMarkAsRead={onMarkAsRead} />
          ))}
        </div>
      )}
    </WebSurface>
  );
}

function OwnerSupportHistoryCard({
  request,
  onMarkAsRead,
}: {
  request: OwnerSupportRequestItem;
  onMarkAsRead: (requestId: string) => void;
}) {
  const latestAnswer = [...request.messages].reverse().find((item) => item.senderType === "admin");
  const unread = isUnreadAnsweredRequest(request);

  return (
    <article className="rounded-[10px] border border-[#e5eaf0] bg-[#fbfcfd] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[#edf4ff] px-2 py-0.5 text-[12px] font-semibold text-[#245bd0]">
          {categoryLabels[request.category] ?? "기타"}
        </span>
        <span className={cn("rounded-full px-2 py-0.5 text-[12px] font-semibold", unread ? "bg-[#f8fdfb] text-[#1f6b5b]" : "bg-[#f1f5f9] text-[#64748b]")}>
          {statusLabels[request.status] ?? request.status}
        </span>
        <span className="text-[12px] font-medium text-[#94a3b8]">
          {new Date(request.createdAt).toLocaleDateString("ko-KR")}
        </span>
      </div>
      <h3 className="mt-2 line-clamp-2 text-[15px] font-semibold text-[#111827]">{request.title}</h3>
      <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-[13px] leading-5 text-[#64748b]">{request.message}</p>
      {request.attachments.length > 0 ? (
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {request.attachments.map((attachment) => (
            <a
              key={attachment.id}
              href={attachment.signedUrl || attachment.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="overflow-hidden rounded-[8px] border border-[#dbe2ea] bg-white"
              title={attachment.fileName}
            >
              <img src={attachment.signedUrl || attachment.fileUrl} alt={attachment.fileName} className="aspect-square w-full object-cover" />
            </a>
          ))}
        </div>
      ) : null}
      {latestAnswer ? (
        <div className="mt-2 rounded-[8px] border border-[#dbe2ea] bg-white px-3 py-2">
          <p className="text-[12px] font-semibold text-[#1f6b5b]">운영팀 답변</p>
          <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[13px] leading-5 text-[#334155]">{latestAnswer.message}</p>
          {unread ? (
            <button
              type="button"
              onClick={() => onMarkAsRead(request.id)}
              className="mt-2 inline-flex h-8 items-center rounded-[8px] bg-[#1f6b5b] px-3 text-[13px] font-semibold text-white"
            >
              답변 확인
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
