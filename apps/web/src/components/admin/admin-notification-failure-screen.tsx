"use client";

import { BellRing, CheckCircle2, Clock3, RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { formatAdminDateTime } from "@/components/admin/admin-dashboard-model";
import { getAdminErrorMessage } from "@/components/admin/admin-error-message";
import AdminSectionNav from "@/components/admin/admin-section-nav";
import { ADMIN_TYPOGRAPHY } from "@/components/admin/admin-typography";
import { fetchApiJson } from "@/lib/api";

type Failure = {
  id: string;
  type: string;
  channel: string;
  status: string;
  failReason: string | null;
  createdAt: string;
};

type LoadState = "loading" | "ready" | "error";

const TYPE_LABELS: Record<string, string> = {
  booking_received: "예약 접수",
  booking_confirmed: "예약 확정",
  owner_booking_requested: "예약 요청",
  booking_cancelled: "예약 취소",
  appointment_reminder_10m: "예약 알림",
  visit_schedule_notice: "방문 일정",
  visit_reminder_notice: "방문 리마인드",
  grooming_started: "미용 시작",
  grooming_almost_done: "픽업 준비",
  grooming_completed: "미용 완료",
  revisit_notice: "재방문 안내",
  landing_feedback: "문의 접수",
  waitlist_interest: "대기 알림",
  birthday_greeting: "생일 안내",
};

const CHANNEL_LABELS: Record<string, string> = {
  alimtalk: "알림톡",
  sms: "문자",
  in_app: "앱 알림",
  mock: "테스트",
};

export default function AdminNotificationFailureScreen() {
  const [failures, setFailures] = useState<Failure[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadFailures = useCallback(async () => {
    setLoadState("loading");
    try {
      const response = await fetchApiJson<{ failures: Failure[] }>(
        "/api/admin/notifications/failures",
        { cache: "no-store" },
      );
      setFailures(response.failures);
      setError(null);
      setLoadState("ready");
    } catch (cause) {
      setError(getAdminErrorMessage(cause, "알림 실패 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."));
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void loadFailures());
    return () => window.cancelAnimationFrame(frame);
  }, [loadFailures]);

  async function retryFailure(notificationId: string) {
    setRetryingId(notificationId);
    setNotice(null);
    try {
      await fetchApiJson(`/api/admin/notifications/failures`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notificationId }),
      });
      setNotice("알림 재처리를 요청했습니다.");
      await loadFailures();
    } catch (cause) {
      setError(getAdminErrorMessage(cause, "알림 재처리에 실패했습니다. 상태를 확인한 뒤 다시 시도해 주세요."));
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <main className="min-h-screen overflow-x-clip bg-[#F4F4F4] px-3 py-3 text-[#172033] sm:px-5 sm:py-6 lg:px-8 lg:py-8">
      <div className="mx-auto w-full max-w-[1440px] overflow-hidden rounded-[14px] border border-[#D9E0E8] bg-white shadow-[0_2px_14px_rgba(15,23,42,0.10)]">
        <header className="border-b border-[#E7E7E7] px-4 py-5 sm:px-6 lg:px-8">
          <p className={`${ADMIN_TYPOGRAPHY.meta} text-[#0873C6]`}>NOTIFICATION OPERATIONS</p>
          <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className={`tracking-[-0.03em] text-[#111112] ${ADMIN_TYPOGRAPHY.pageTitle}`}>알림 발송 실패</h1>
              <p className={`mt-2 text-[#64748B] ${ADMIN_TYPOGRAPHY.body}`}>
                실패한 알림만 확인하고 필요한 항목을 다시 처리합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadFailures()}
              disabled={loadState === "loading"}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] border border-[#D9E0E8] bg-white px-4 text-[#475569] transition hover:bg-[#F8FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 disabled:opacity-60 ${ADMIN_TYPOGRAPHY.control}`}
            >
              <RefreshCcw className={`h-4 w-4 ${loadState === "loading" ? "animate-spin" : ""}`} aria-hidden />
              새로고침
            </button>
          </div>
          <div className="mt-4">
            <AdminSectionNav active="notifications" />
          </div>
        </header>

        <div className="bg-[#F4F4F4] px-4 py-5 sm:px-6 lg:px-8">
          <section aria-label="알림 실패 요약" className="grid gap-3 sm:grid-cols-3">
            <FailureMetric icon={<BellRing className="h-5 w-5" aria-hidden />} label="처리 필요" value={failures.length} tone="blue" />
            <FailureMetric icon={<Clock3 className="h-5 w-5" aria-hidden />} label="조회 범위" value={100} tone="cyan" />
            <FailureMetric icon={<CheckCircle2 className="h-5 w-5" aria-hidden />} label="재처리 방식" value="수동" tone="slate" suffix="" />
          </section>

          {notice ? <p role="status" className={`mt-4 rounded-[10px] border border-[#B9E2D7] bg-[#F0FBF7] px-4 py-3 text-[#1F6B5B] ${ADMIN_TYPOGRAPHY.helper}`}>{notice}</p> : null}
          {error ? <p role="alert" className={`mt-4 rounded-[10px] border border-[#EACFC8] bg-[#FFF8F6] px-4 py-3 text-[#9A5E4E] ${ADMIN_TYPOGRAPHY.helper}`}>{error}</p> : null}

          <section aria-labelledby="notification-failure-list-title" className="mt-4 overflow-hidden rounded-[12px] border border-[#D9E0E8] bg-white">
            <div className="border-b border-[#E7E7E7] p-4 sm:p-5">
              <h2 id="notification-failure-list-title" className={`text-[#111112] ${ADMIN_TYPOGRAPHY.sectionTitle}`}>실패 목록</h2>
              <p className={`mt-1 text-[#64748B] ${ADMIN_TYPOGRAPHY.helper}`}>
                개인정보와 메시지 원문은 표시하지 않습니다.
              </p>
            </div>

            {loadState === "loading" ? <p className={`px-4 py-12 text-center text-[#64748B] ${ADMIN_TYPOGRAPHY.body}`}>실패 목록을 불러오는 중입니다.</p> : null}
            {loadState === "error" ? (
              <div className="px-4 py-12 text-center">
                <button type="button" onClick={() => void loadFailures()} className={`inline-flex min-h-11 items-center justify-center rounded-[8px] border border-[#D9E0E8] bg-white px-4 text-[#334155] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 ${ADMIN_TYPOGRAPHY.control}`}>다시 시도</button>
              </div>
            ) : null}
            {loadState === "ready" && failures.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <p className={`text-[#334155] ${ADMIN_TYPOGRAPHY.bodyStrong}`}>처리할 알림 실패가 없습니다.</p>
                <p className={`mt-1 text-[#64748B] ${ADMIN_TYPOGRAPHY.body}`}>새 실패가 생기면 이 목록에서 확인할 수 있습니다.</p>
              </div>
            ) : null}
            {loadState === "ready" && failures.length > 0 ? (
              <div className="divide-y divide-[#E7E7E7]">
                {failures.map((failure) => {
                  const retrying = retryingId === failure.id;
                  return (
                    <article key={failure.id} className="grid min-w-0 gap-4 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-5">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full bg-[#FFF6D8] px-2.5 py-1 text-[#7A5B00] ${ADMIN_TYPOGRAPHY.badge}`}>{TYPE_LABELS[failure.type] ?? "알림"}</span>
                          <span className={`text-[#64748B] ${ADMIN_TYPOGRAPHY.helper}`}>{CHANNEL_LABELS[failure.channel] ?? "알림"}</span>
                        </div>
                        <p className={`mt-2 break-words text-[#111112] ${ADMIN_TYPOGRAPHY.bodyStrong}`}>{failure.failReason ?? "실패 원인을 확인할 수 없습니다."}</p>
                        <p className={`mt-1 text-[#64748B] ${ADMIN_TYPOGRAPHY.helper}`}>{formatAdminDateTime(failure.createdAt)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void retryFailure(failure.id)}
                        disabled={retrying || retryingId !== null}
                        className={`inline-flex min-h-11 items-center justify-center rounded-[8px] bg-[#111A30] px-4 text-white transition hover:bg-[#1A294A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${ADMIN_TYPOGRAPHY.control}`}
                      >
                        {retrying ? "처리 중" : "다시 처리"}
                      </button>
                    </article>
                  );
                })}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}

function FailureMetric({ icon, label, value, tone, suffix = "건" }: { icon: React.ReactNode; label: string; value: number | string; tone: "blue" | "cyan" | "slate"; suffix?: string }) {
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
      <p className="mt-3 text-[28px] leading-7 font-semibold tracking-[-0.03em] tabular-nums">{value}{suffix ? <span className={`ml-1 text-[14px] font-medium ${tone === "blue" ? "text-white/80" : "text-[#64748B]"}`}>{suffix}</span> : null}</p>
    </article>
  );
}
