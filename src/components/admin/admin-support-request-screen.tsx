"use client";

import { CheckCircle2, Clock3, MessageCircle, RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  formatAdminDateTime,
  isPendingSupportRequest,
  supportRequestCategoryLabels,
  supportRequestStatusLabels,
  type OwnerSupportRequestItem,
} from "@/components/admin/admin-dashboard-model";
import { getAdminErrorMessage } from "@/components/admin/admin-error-message";
import AdminSectionNav from "@/components/admin/admin-section-nav";
import AdminSupportRequestDetail from "@/components/admin/admin-support-request-detail";
import { ADMIN_TYPOGRAPHY } from "@/components/admin/admin-typography";
import { fetchApiJson } from "@/lib/api";

type Filter = "pending" | "all";
type LoadState = "loading" | "ready" | "error";

export default function AdminSupportRequestScreen() {
  const [requests, setRequests] = useState<OwnerSupportRequestItem[]>([]);
  const [filter, setFilter] = useState<Filter>("pending");
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<OwnerSupportRequestItem | null>(null);
  const requestTriggerRef = useRef<HTMLButtonElement | null>(null);

  const loadRequests = useCallback(async () => {
    setLoadState("loading");
    try {
      const response = await fetchApiJson<{ requests: OwnerSupportRequestItem[] }>(
        "/api/admin/support-requests?limit=100",
        { cache: "no-store" },
      );
      setRequests(response.requests);
      setError(null);
      setLoadState("ready");
    } catch (cause) {
      setError(
        getAdminErrorMessage(
          cause,
          "고객 문의를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
        ),
      );
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadRequests();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loadRequests]);

  const pendingRequests = requests.filter(isPendingSupportRequest);
  const visibleRequests = filter === "pending" ? pendingRequests : requests;
  const answeredCount = requests.filter(
    (request) => request.status === "answered" || request.status === "resolved",
  ).length;

  const closeDetail = useCallback(() => {
    const trigger = requestTriggerRef.current;
    setSelectedRequest(null);
    window.requestAnimationFrame(() => {
      if (trigger?.isConnected) trigger.focus();
      requestTriggerRef.current = null;
    });
  }, []);

  function saveRequest(nextRequest: OwnerSupportRequestItem) {
    setRequests((current) =>
      current.map((request) => (request.id === nextRequest.id ? nextRequest : request)),
    );
    setSelectedRequest(nextRequest);
  }

  return (
    <main className="min-h-screen overflow-x-clip bg-[#F4F4F4] px-3 py-3 text-[#172033] sm:px-5 sm:py-6 lg:px-8 lg:py-8">
      <div className="mx-auto w-full max-w-[1440px] overflow-hidden rounded-[14px] border border-[#D9E0E8] bg-white shadow-[0_2px_14px_rgba(15,23,42,0.10)]">
        <header className="border-b border-[#E7E7E7] px-4 py-5 sm:px-6 lg:px-8">
          <p className={`${ADMIN_TYPOGRAPHY.meta} text-[#0873C6]`}>CUSTOMER SUPPORT</p>
          <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className={`tracking-[-0.03em] text-[#111112] ${ADMIN_TYPOGRAPHY.pageTitle}`}>
                고객 문의
              </h1>
              <p className={`mt-2 text-[#64748B] ${ADMIN_TYPOGRAPHY.body}`}>
                접수된 문의와 고객 정보, 답변·처리 상태를 확인합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadRequests()}
              disabled={loadState === "loading"}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] border border-[#D9E0E8] bg-white px-4 text-[#475569] transition hover:bg-[#F8FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 disabled:opacity-60 ${ADMIN_TYPOGRAPHY.control}`}
            >
              <RefreshCcw className={`h-4 w-4 ${loadState === "loading" ? "animate-spin" : ""}`} aria-hidden />
              새로고침
            </button>
          </div>
          <div className="mt-4">
            <AdminSectionNav active="support" />
          </div>
        </header>

        <div className="bg-[#F4F4F4] px-4 py-5 sm:px-6 lg:px-8">
          <section aria-label="고객 문의 요약" className="grid gap-3 sm:grid-cols-3">
            <SupportMetric icon={<Clock3 className="h-5 w-5" aria-hidden />} label="처리할 문의" value={pendingRequests.length} tone="blue" />
            <SupportMetric icon={<MessageCircle className="h-5 w-5" aria-hidden />} label="전체 문의" value={requests.length} tone="cyan" />
            <SupportMetric icon={<CheckCircle2 className="h-5 w-5" aria-hidden />} label="답변 완료" value={answeredCount} tone="slate" />
          </section>

          <section aria-labelledby="support-list-title" className="mt-4 overflow-hidden rounded-[12px] border border-[#D9E0E8] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E7E7E7] p-4 sm:p-5">
              <div>
                <h2 id="support-list-title" className={`text-[#111112] ${ADMIN_TYPOGRAPHY.sectionTitle}`}>
                  접수 문의
                </h2>
                <p className={`mt-1 text-[#64748B] ${ADMIN_TYPOGRAPHY.helper}`}>
                  한 항목을 누르면 고객·매장 정보, 문의 내용과 처리 내역을 확인할 수 있습니다.
                </p>
              </div>
              <div className="flex shrink-0 gap-2" role="group" aria-label="문의 표시 범위">
                {(["pending", "all"] as const).map((value) => {
                  const selected = filter === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFilter(value)}
                      aria-pressed={selected}
                      className={`inline-flex min-h-11 items-center justify-center rounded-[8px] border px-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 ${ADMIN_TYPOGRAPHY.meta} ${
                        selected
                          ? "border-[#2563EB] bg-[#2563EB] text-white"
                          : "border-[#D9E0E8] bg-white text-[#475569] hover:bg-[#F8FAFC]"
                      }`}
                    >
                      {value === "pending" ? `미처리 ${pendingRequests.length}건` : `전체 ${requests.length}건`}
                    </button>
                  );
                })}
              </div>
            </div>

            {loadState === "loading" ? (
              <p className={`px-4 py-12 text-center text-[#64748B] ${ADMIN_TYPOGRAPHY.body}`}>
                문의 목록을 불러오는 중입니다.
              </p>
            ) : null}

            {loadState === "error" ? (
              <div className="px-4 py-12 text-center">
                <p role="alert" className={`${ADMIN_TYPOGRAPHY.body} text-[#A04455]`}>
                  {error}
                </p>
                <button
                  type="button"
                  onClick={() => void loadRequests()}
                  className={`mt-4 inline-flex min-h-11 items-center justify-center rounded-[8px] border border-[#D9E0E8] bg-white px-4 text-[#334155] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 ${ADMIN_TYPOGRAPHY.control}`}
                >
                  다시 시도
                </button>
              </div>
            ) : null}

            {loadState === "ready" && visibleRequests.length > 0 ? (
              <div className="divide-y divide-[#E7E7E7]">
                {visibleRequests.map((request) => (
                  <button
                    key={request.id}
                    type="button"
                    onClick={(event) => {
                      requestTriggerRef.current = event.currentTarget;
                      setSelectedRequest(request);
                    }}
                    className="grid w-full min-w-0 gap-3 px-4 py-4 text-left transition hover:bg-[#F8FBFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2563EB] sm:grid-cols-[minmax(0,1fr)_auto] sm:px-5"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full bg-[#EFF6FF] px-2.5 py-1 text-[#1D4ED8] ${ADMIN_TYPOGRAPHY.badge}`}>
                          {supportRequestCategoryLabels[request.category]}
                        </span>
                        <span className={`text-[#64748B] ${ADMIN_TYPOGRAPHY.helper}`}>
                          {request.shopName ?? "매장 정보 확인 중"}
                        </span>
                      </div>
                      <p className={`mt-2 break-words text-[#111112] ${ADMIN_TYPOGRAPHY.bodyStrong}`}>
                        {request.title}
                      </p>
                      <p className={`mt-1 line-clamp-2 break-words text-[#64748B] ${ADMIN_TYPOGRAPHY.helper}`}>
                        {request.message}
                      </p>
                    </div>
                    <div className="flex min-w-0 items-start justify-between gap-3 sm:block sm:min-w-[144px] sm:text-right">
                      <div>
                        <p className={`${ADMIN_TYPOGRAPHY.helper} text-[#64748B]`}>
                          신청자
                        </p>
                        <p className={`mt-0.5 ${ADMIN_TYPOGRAPHY.meta} text-[#334155]`}>
                          {request.ownerName || "신청자 확인 중"}
                        </p>
                        <p className={`mt-1 text-[#64748B] ${ADMIN_TYPOGRAPHY.helper}`}>
                          {formatAdminDateTime(request.createdAt)}
                        </p>
                      </div>
                      <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 ${ADMIN_TYPOGRAPHY.badge} ${statusClassName(request.status)}`}>
                        {supportRequestStatusLabels[request.status]}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : null}

            {loadState === "ready" && visibleRequests.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <p className={`text-[#334155] ${ADMIN_TYPOGRAPHY.bodyStrong}`}>
                  {filter === "pending" ? "처리할 문의가 없습니다." : "접수된 문의가 없습니다."}
                </p>
                <p className={`mt-1 text-[#64748B] ${ADMIN_TYPOGRAPHY.body}`}>
                  새 문의가 들어오면 고객과 매장, 처리 상태를 이곳에서 확인할 수 있습니다.
                </p>
              </div>
            ) : null}
          </section>
        </div>
      </div>

      {selectedRequest ? (
        <AdminSupportRequestDetail request={selectedRequest} onClose={closeDetail} onSaved={saveRequest} />
      ) : null}
    </main>
  );
}

function SupportMetric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: "blue" | "cyan" | "slate" }) {
  const tones = {
    blue: "border-[#2563EB] bg-[#2563EB] text-white",
    cyan: "border-[#60A5FA] bg-white text-[#111112]",
    slate: "border-[#D9E0E8] bg-white text-[#111112]",
  } as const;
  const iconTones = {
    blue: "bg-white/16 text-white",
    cyan: "bg-[#EAF5FF] text-[#0873C6]",
    slate: "bg-[#F1F5F9] text-[#475569]",
  } as const;

  return (
    <article className={`min-w-0 rounded-[10px] border p-4 ${tones[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <p className={ADMIN_TYPOGRAPHY.meta}>{label}</p>
        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${iconTones[tone]}`}>{icon}</span>
      </div>
      <p className="mt-3 text-[28px] leading-7 font-semibold tracking-[-0.03em] tabular-nums">{value}건</p>
    </article>
  );
}

function statusClassName(status: OwnerSupportRequestItem["status"]) {
  if (status === "open") return "bg-[#FFF7E7] text-[#A16207]";
  if (status === "reviewing") return "bg-[#EFF6FF] text-[#1D4ED8]";
  if (status === "answered" || status === "resolved") return "bg-[#EEF8F4] text-[#16705A]";
  return "bg-[#F1F5F9] text-[#475569]";
}
