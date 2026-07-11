"use client";

import {
  Activity,
  AlertCircle,
  ChevronRight,
  CheckCircle2,
  DoorOpen,
  KeyRound,
  LayoutDashboard,
  MessageSquareText,
  MonitorSmartphone,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Store,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { fetchApiJson } from "@/lib/api";

type AdminDashboardAccount = {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  loginId: string;
  isSuperAdmin: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type OwnerSupportRequestStatus = "open" | "reviewing" | "answered" | "resolved" | "closed";
type OwnerSupportCategory = "how_to_use" | "bug" | "payment" | "feature_request" | "account" | "notification" | "other";

type OwnerSupportMessageItem = {
  id: string;
  senderType: "owner" | "admin" | "system";
  senderName: string | null;
  message: string;
  isAnswer: boolean;
  createdAt: string;
};

type OwnerSupportAttachmentItem = {
  id: string;
  requestId: string;
  messageId: string | null;
  mediaAssetId: string | null;
  fileUrl: string;
  signedUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number | null;
  uploadedByType: "owner" | "admin";
  uploadedById: string | null;
  createdAt: string;
};

type OwnerSupportRequestItem = {
  id: string;
  shopId: string;
  shopName: string | null;
  category: OwnerSupportCategory;
  status: OwnerSupportRequestStatus;
  title: string;
  contact: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  message: string;
  context: Record<string, unknown>;
  adminNote: string;
  source: string;
  answeredAt: string | null;
  createdAt: string;
  updatedAt: string;
  messages: OwnerSupportMessageItem[];
  attachments: OwnerSupportAttachmentItem[];
};

type AdminRevenuePlanBreakdown = {
  planCode: string;
  planName: string;
  revenue: number;
  paidCount: number;
  activeCount: number;
};

type AdminRevenueRecentPayment = {
  paymentId: string;
  shopId: string;
  planCode: string | null;
  planName: string;
  amount: number;
  paidAt: string;
};

type AdminRevenueSummary = {
  todayRevenue: number;
  monthRevenue: number;
  last30DaysRevenue: number;
  monthPaidCount: number;
  activePaidSubscriptions: number;
  expectedMonthlyRecurringRevenue: number;
  planBreakdown: AdminRevenuePlanBreakdown[];
  recentPayments: AdminRevenueRecentPayment[];
  updatedAt: string;
};

const supportRequestCategoryLabels: Record<OwnerSupportCategory, string> = {
  how_to_use: "사용법 문의",
  bug: "기능 오류",
  payment: "결제 문의",
  feature_request: "기능 요청",
  account: "계정/매장",
  notification: "알림 문의",
  other: "기타",
};

const supportRequestStatusLabels: Record<OwnerSupportRequestStatus, string> = {
  open: "접수됨",
  reviewing: "확인 중",
  answered: "답변완료",
  resolved: "답변완료",
  closed: "종료",
};

const dashboardItems = [
  {
    href: "/owner/admin",
    icon: LayoutDashboard,
    title: "오너 계정 관리",
    meta: "계정 / 결제 / 복구",
    group: "primary",
  },
  {
    href: "/admin/alimtalk",
    icon: KeyRound,
    title: "알림톡 키 / 템플릿 관리",
    meta: "알림 / 템플릿",
    group: "primary",
  },
  {
    href: "/admin/env",
    icon: ServerCog,
    title: "환경변수 상태 확인",
    meta: "운영 환경",
    group: "system",
  },
  {
    href: "/owner",
    icon: Store,
    title: "오너 페이지 보기",
    meta: "Owner",
    group: "shortcut",
  },
  {
    href: "/demo/owner-web",
    icon: MonitorSmartphone,
    title: "오너 데모 보기",
    meta: "Demo",
    group: "shortcut",
  },
  {
    href: "/",
    icon: ShieldCheck,
    title: "서비스 메인 보기",
    meta: "Public",
    group: "shortcut",
  },
] satisfies Array<{
  href: string;
  icon: LucideIcon;
  title: string;
  meta: string;
  group: "primary" | "system" | "shortcut";
}>;

const groupLabels: Record<(typeof dashboardItems)[number]["group"], string> = {
  primary: "자주 쓰는 작업",
  system: "시스템 점검",
  shortcut: "바로가기",
};

function formatWon(value: number) {
  return `${Math.max(value, 0).toLocaleString("ko-KR")}원`;
}

function formatShortDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export default function AdminDashboard({ sessionLoginId }: { sessionLoginId: string }) {
  const router = useRouter();
  const [account, setAccount] = useState<AdminDashboardAccount | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [supportRequests, setSupportRequests] = useState<OwnerSupportRequestItem[]>([]);
  const [supportMessage, setSupportMessage] = useState<string | null>(null);
  const [supportSavingId, setSupportSavingId] = useState<string | null>(null);
  const [revenueSummary, setRevenueSummary] = useState<AdminRevenueSummary | null>(null);
  const [revenueMessage, setRevenueMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const nextAccount = await fetchApiJson<AdminDashboardAccount>("/api/admin/session", {
          cache: "no-store",
        });

        if (active) {
          setAccount(nextAccount);
          setMessage(null);
        }
      } catch (error) {
        if (active) {
          setMessage(error instanceof Error ? error.message : "관리자 정보를 불러오지 못했습니다.");
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    void loadSupportRequests();
    void loadRevenueSummary();
  }, []);

  async function loadSupportRequests() {
    try {
      const response = await fetchApiJson<{ requests: OwnerSupportRequestItem[] }>("/api/admin/support-requests?limit=20", {
        cache: "no-store",
      });
      setSupportRequests(response.requests);
      setSupportMessage(null);
    } catch (error) {
      setSupportMessage(error instanceof Error ? error.message : "오너 문의를 불러오지 못했습니다.");
    }
  }

  async function loadRevenueSummary() {
    try {
      const response = await fetchApiJson<AdminRevenueSummary>("/api/admin/revenue-summary", {
        cache: "no-store",
      });
      setRevenueSummary(response);
      setRevenueMessage(null);
    } catch (error) {
      setRevenueMessage(error instanceof Error ? error.message : "매출 분석을 불러오지 못했습니다.");
    }
  }

  async function updateSupportRequestStatus(id: string, status: OwnerSupportRequestStatus, adminNote = "", answerMessage = "") {
    setSupportSavingId(id);
    try {
      const response = await fetchApiJson<{ request: OwnerSupportRequestItem }>("/api/admin/support-requests", {
        method: "PATCH",
        body: JSON.stringify({ id, status, adminNote, answerMessage }),
      });
      setSupportRequests((current) => current.map((item) => (item.id === id ? response.request : item)));
      setSupportMessage(null);
    } catch (error) {
      setSupportMessage(error instanceof Error ? error.message : "문의 상태를 저장하지 못했습니다.");
    } finally {
      setSupportSavingId(null);
    }
  }

  async function handleLogout() {
    try {
      await fetchApiJson<{ success: true }>("/api/admin/auth/logout", {
        method: "POST",
      });
    } finally {
      router.replace("/admin/login" as never);
      router.refresh();
    }
  }

  const currentAccount = account ?? {
    fullName: "관리자 계정",
    email: "-",
    phoneNumber: null,
    loginId: sessionLoginId,
    isSuperAdmin: false,
    isActive: true,
  };
  const primaryItems = dashboardItems.filter((item) => item.group === "primary");
  const systemItems = dashboardItems.filter((item) => item.group === "system");
  const shortcutItems = dashboardItems.filter((item) => item.group === "shortcut");
  const groupedItems = [
    { key: "primary" as const, items: primaryItems },
    { key: "system" as const, items: systemItems },
    { key: "shortcut" as const, items: shortcutItems },
  ];
  const openSupportCount = supportRequests.filter((item) => item.status === "open" || item.status === "reviewing").length;

  return (
    <main className="min-h-screen bg-[#f7f8f6] px-4 py-4 text-[16px] text-[#172033] md:px-6">
      <div className="mx-auto w-full max-w-[1440px] rounded-[14px] border border-[#dfe7e2] bg-white p-4 shadow-[0_8px_24px_rgba(23,32,51,0.045)]">
        <header>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#edf6f2] px-3 py-1 text-[15px] text-[#1f6b5b]">
                <Sparkles className="h-4 w-4" />
                PetManager Admin
              </div>
              <h1 className="text-[28px] tracking-[-0.03em] text-[#0f172a]">운영 콘솔</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-[10px] border border-[#dfe7e2] bg-white px-3 py-1.5 text-right">
                <p className="text-[14px] text-[#64748b]">현재 운영 계정</p>
                <p className="text-[16px] text-[#0f172a]">{currentAccount.fullName}</p>
              </div>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-[#d0d8e3] bg-white px-3.5 text-[15px] text-[#334155] transition hover:border-[#b8c4d2] hover:bg-[#f8fafc]"
              >
                <DoorOpen className="h-4 w-4" />
                로그아웃
              </button>
            </div>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-4">
            <StatusTile
              icon={CheckCircle2}
              label="운영 상태"
              value={currentAccount.isActive ? "정상" : "확인 필요"}
              tone={currentAccount.isActive ? "ok" : "warning"}
            />
            <StatusTile
              icon={Activity}
              label="처리 대기"
              value={`${openSupportCount}건`}
              tone={openSupportCount > 0 ? "warning" : "neutral"}
            />
            <StatusTile
              icon={Sparkles}
              label="이번 달 매출"
              value={formatWon(revenueSummary?.monthRevenue ?? 0)}
              tone="neutral"
            />
            <StatusTile
              icon={MessageSquareText}
              label="알림 연동"
              value="점검 가능"
              tone="neutral"
            />
            <StatusTile
              icon={ShieldCheck}
              label="권한"
              value={currentAccount.isSuperAdmin ? "Super Admin" : "Admin"}
              tone="neutral"
            />
          </div>
        </header>

        {message ? (
          <p className="mt-3 rounded-[8px] border border-[#efcaca] bg-[#fff7f7] px-3 py-2 text-[15px] leading-6 text-[#b42318]">
            {message}
          </p>
        ) : null}

        <section className="mt-4 grid gap-4 border-t border-[#edf2f7] pt-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-3">
            <div className="grid gap-2 md:grid-cols-2">
              {primaryItems.map((item) => (
                <PrimaryActionCard key={item.href} {...item} />
              ))}
            </div>

            <div className="overflow-hidden rounded-[12px] border border-[#dfe7e2] bg-white shadow-[0_6px_18px_rgba(23,32,51,0.035)]">
              <div className="flex items-center justify-between border-b border-[#edf2f7] px-4 py-3">
                <div>
                  <h2 className="text-[18px] text-[#0f172a]">운영 작업</h2>
                </div>
                <span className="rounded-full border border-[#dbe2ea] bg-[#f8fafc] px-2.5 py-0.5 text-[15px] text-[#475569]">
                  {dashboardItems.length}개
                </span>
              </div>

              <div className="divide-y divide-[#edf2f7]">
                {groupedItems.map(({ key, items }) => (
                  <section key={key} className="px-4 py-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-[16px] text-[#0f172a]">{groupLabels[key]}</h3>
                      </div>
                      <span className="text-[14px] text-[#94a3b8]">{items.length}개</span>
                    </div>
                    <div className="grid gap-1.5">
                      {items.map((item) => (
                        <DashboardRow key={item.href} {...item} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>

            <SupportRequestsPanel
              requests={supportRequests}
              message={supportMessage}
              savingId={supportSavingId}
              onRefresh={() => void loadSupportRequests()}
              onStatusChange={(id: string, status: OwnerSupportRequestStatus, adminNote: string, answerMessage = "") =>
                void updateSupportRequestStatus(id, status, adminNote, answerMessage)
              }
            />

            <RevenueSummaryPanel
              summary={revenueSummary}
              message={revenueMessage}
              onRefresh={() => void loadRevenueSummary()}
            />
          </div>

          <aside className="space-y-3">
            <div className="rounded-[12px] border border-[#dfe7e2] bg-white p-4 shadow-[0_6px_18px_rgba(23,32,51,0.035)]">
              <div className="flex items-start gap-3 border-b border-[#edf2f7] pb-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#edf6f2] text-[17px] text-[#1f6b5b]">
                  {currentAccount.fullName.slice(0, 1)}
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] uppercase tracking-[0.08em] text-[#94a3b8]">Account</p>
                  <h2 className="mt-0.5 truncate text-[19px] text-[#0f172a]">{currentAccount.fullName}</h2>
                  <p className="mt-0.5 text-[15px] text-[#64748b]">{currentAccount.email}</p>
                </div>
              </div>

              <dl className="mt-3 space-y-2">
                <InfoRow label="아이디" value={currentAccount.loginId} />
                <InfoRow label="연락처" value={currentAccount.phoneNumber || "-"} />
                <InfoRow label="상태" value={currentAccount.isActive ? "활성" : "비활성"} />
                <InfoRow label="권한" value={currentAccount.isSuperAdmin ? "Super Admin" : "Admin"} />
              </dl>
            </div>

            <div className="rounded-[12px] border border-[#dfe7e2] bg-white p-4 shadow-[0_6px_18px_rgba(23,32,51,0.035)]">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-[#1f6b5b]" />
                <h2 className="text-[17px] text-[#0f172a]">오늘 확인할 것</h2>
              </div>
              <div className="mt-3 space-y-2">
                <CheckItem title="운영 환경" href="/admin/env" />
                <CheckItem title="오너 계정" href="/owner/admin" />
                <CheckItem title="알림톡" href="/admin/alimtalk" />
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function RevenueSummaryPanel({
  summary,
  message,
  onRefresh,
}: {
  summary: AdminRevenueSummary | null;
  message: string | null;
  onRefresh: () => void;
}) {
  const planRows = summary?.planBreakdown ?? [];
  const recentPayments = summary?.recentPayments ?? [];

  return (
    <section className="overflow-hidden rounded-[12px] border border-[#dfe7e2] bg-white shadow-[0_6px_18px_rgba(23,32,51,0.035)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf2f7] px-4 py-3">
        <div>
          <h2 className="text-[18px] text-[#0f172a]">매출 분석</h2>
          <p className="mt-0.5 text-[14px] text-[#64748b]">오너 구독 결제 기준</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex h-9 items-center rounded-[9px] border border-[#d0d8e3] bg-white px-3 text-[14px] text-[#334155] transition hover:bg-[#f8fafc]"
        >
          새로고침
        </button>
      </div>

      {message ? (
        <p className="m-4 rounded-[8px] border border-[#efcaca] bg-[#fff7f7] px-3 py-2 text-[15px] leading-6 text-[#b42318]">
          {message}
        </p>
      ) : null}

      <div className="grid gap-3 p-4 md:grid-cols-4">
        <RevenueMetric label="오늘 매출" value={formatWon(summary?.todayRevenue ?? 0)} />
        <RevenueMetric label="이번 달 매출" value={formatWon(summary?.monthRevenue ?? 0)} highlight />
        <RevenueMetric label="최근 30일" value={formatWon(summary?.last30DaysRevenue ?? 0)} />
        <RevenueMetric label="예상 MRR" value={formatWon(summary?.expectedMonthlyRecurringRevenue ?? 0)} />
      </div>

      <div className="grid gap-3 border-t border-[#edf2f7] p-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[16px] text-[#0f172a]">플랜별 이번 달 매출</h3>
            <span className="text-[14px] text-[#94a3b8]">결제 {summary?.monthPaidCount ?? 0}건</span>
          </div>
          <div className="mt-3 grid gap-2">
            {planRows.length === 0 ? (
              <p className="rounded-[9px] border border-[#edf2f7] bg-[#fbfcfd] px-3 py-3 text-[14px] text-[#64748b]">집계할 결제 데이터가 아직 없습니다.</p>
            ) : (
              planRows.map((row) => (
                <div key={row.planCode} className="grid grid-cols-[minmax(0,1fr)_110px_90px] items-center gap-3 rounded-[9px] border border-[#edf2f7] bg-[#fbfcfd] px-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-[#0f172a]">{row.planName}</p>
                    <p className="mt-0.5 text-[13px] text-[#64748b]">활성 {row.activeCount}개 · 결제 {row.paidCount}건</p>
                  </div>
                  <p className="text-right text-[15px] font-semibold text-[#0f172a]">{formatWon(row.revenue)}</p>
                  <div className="h-2 overflow-hidden rounded-full bg-[#edf2f7]">
                    <span
                      className="block h-full rounded-full bg-[#2563eb]"
                      style={{
                        width: `${Math.min(100, summary?.monthRevenue ? Math.round((row.revenue / summary.monthRevenue) * 100) : 0)}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <h3 className="text-[16px] text-[#0f172a]">최근 결제</h3>
          <div className="mt-3 space-y-2">
            {recentPayments.length === 0 ? (
              <p className="rounded-[9px] border border-[#edf2f7] bg-[#fbfcfd] px-3 py-3 text-[14px] text-[#64748b]">최근 결제가 없습니다.</p>
            ) : (
              recentPayments.map((payment) => (
                <div key={payment.paymentId} className="rounded-[9px] border border-[#edf2f7] bg-white px-3 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[14px] font-semibold text-[#0f172a]">{payment.planName}</p>
                    <p className="shrink-0 text-[14px] font-semibold text-[#2563eb]">{formatWon(payment.amount)}</p>
                  </div>
                  <p className="mt-1 truncate text-[13px] text-[#64748b]">{formatShortDateTime(payment.paidAt)} · {payment.shopId}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function RevenueMetric({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-[10px] border px-3 py-3 ${highlight ? "border-[#bdd5ff] bg-[#f5f9ff]" : "border-[#edf2f7] bg-[#fbfcfd]"}`}>
      <p className="text-[14px] text-[#64748b]">{label}</p>
      <p className={`mt-2 truncate text-[22px] font-semibold tracking-[-0.02em] ${highlight ? "text-[#2563eb]" : "text-[#0f172a]"}`}>{value}</p>
    </div>
  );
}

function SupportRequestsPanel({
  requests,
  message,
  savingId,
  onRefresh,
  onStatusChange,
}: {
  requests: OwnerSupportRequestItem[];
  message: string | null;
  savingId: string | null;
  onRefresh: () => void;
  onStatusChange: (id: string, status: OwnerSupportRequestStatus, adminNote: string, answerMessage?: string) => void;
}) {
  const openCount = requests.filter((item) => item.status === "open" || item.status === "reviewing").length;

  return (
    <section className="overflow-hidden rounded-[12px] border border-[#dfe7e2] bg-white shadow-[0_6px_18px_rgba(23,32,51,0.035)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf2f7] px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[18px] text-[#0f172a]">오너 문의 / 개선 요청</h2>
          {openCount > 0 ? (
            <span className="rounded-full border border-[#f4c7c7] bg-[#fff5f5] px-2.5 py-1 text-[13px] font-semibold text-[#b42318]">
              미처리 {openCount}건
            </span>
          ) : (
            <span className="rounded-full border border-[#dbe7df] bg-[#f7fbf8] px-2.5 py-1 text-[13px] font-semibold text-[#1f6b5b]">
              미처리 없음
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex h-9 items-center rounded-[9px] border border-[#d0d8e3] bg-white px-3 text-[14px] text-[#334155] transition hover:bg-[#f8fafc]"
        >
          새로고침
        </button>
      </div>

      {message ? (
        <p className="m-4 rounded-[8px] border border-[#efcaca] bg-[#fff7f7] px-3 py-2 text-[15px] leading-6 text-[#b42318]">
          {message}
        </p>
      ) : null}

      {requests.length === 0 && !message ? (
        <div className="px-4 py-8 text-center text-[15px] text-[#64748b]">접수된 문의가 없습니다.</div>
      ) : (
        <div className="divide-y divide-[#edf2f7]">
          {requests.map((request) => (
            <SupportRequestCard
              key={request.id}
              request={request}
              saving={savingId === request.id}
              onStatusChange={onStatusChange}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function SupportRequestCard({
  request,
  saving,
  onStatusChange,
}: {
  request: OwnerSupportRequestItem;
  saving: boolean;
  onStatusChange: (id: string, status: OwnerSupportRequestStatus, adminNote: string, answerMessage?: string) => void;
}) {
  const [adminNote, setAdminNote] = useState(request.adminNote);
  const [answerMessage, setAnswerMessage] = useState("");
  const latestAnswer = [...request.messages].reverse().find((message) => message.senderType === "admin");
  const contextLines = [
    request.context.feedbackTypeLabel ? `의견 유형: ${String(request.context.feedbackTypeLabel)}` : null,
    request.context.feedbackRating ? `만족도: ${String(request.context.feedbackRating)}/5` : null,
    request.context.currentPath ? `경로: ${String(request.context.currentPath)}` : null,
    request.context.currentUrl ? `화면: ${String(request.context.currentUrl)}` : null,
    request.context.userAgent ? `브라우저: ${String(request.context.userAgent)}` : null,
  ].filter(Boolean);

  return (
    <article className="px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#edf4ff] px-2.5 py-1 text-[14px] font-semibold text-[#245bd0]">
              {supportRequestCategoryLabels[request.category]}
            </span>
            <span className="rounded-full border border-[#dbe2ea] bg-white px-2.5 py-1 text-[14px] text-[#475569]">
              {supportRequestStatusLabels[request.status]}
            </span>
            <span className="text-[14px] text-[#94a3b8]">{new Date(request.createdAt).toLocaleString("ko-KR")}</span>
          </div>
          <h3 className="mt-2 text-[17px] font-semibold text-[#0f172a]">{request.title}</h3>
          <p className="mt-0.5 text-[14px] font-medium text-[#64748b]">{request.shopName ?? request.shopId}</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-6 text-[#334155]">{request.message}</p>
          {request.attachments.length > 0 ? (
            <div className="mt-2 grid max-w-[360px] grid-cols-3 gap-2">
              {request.attachments.map((attachment) => (
                <a
                  key={attachment.id}
                  href={attachment.signedUrl || attachment.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="overflow-hidden rounded-[9px] border border-[#dbe2ea] bg-[#f8fafc]"
                  title={attachment.fileName}
                >
                  <img src={attachment.signedUrl || attachment.fileUrl} alt={attachment.fileName} className="aspect-square w-full object-cover" />
                </a>
              ))}
            </div>
          ) : null}
          <div className="mt-2 grid gap-1 text-[14px] text-[#64748b]">
            <p>연락처: {request.ownerPhone || request.contact || "-"}</p>
            {request.ownerName ? <p>오너명: {request.ownerName}</p> : null}
            {contextLines.map((line) => (
              <p key={line} className="truncate">
                {line}
              </p>
            ))}
          </div>
        </div>
        <div className="grid min-w-[180px] gap-2">
          <select
            value={request.status}
            onChange={(event) => onStatusChange(request.id, event.target.value as OwnerSupportRequestStatus, adminNote, "")}
            disabled={saving}
            className="h-9 rounded-[9px] border border-[#d0d8e3] bg-white px-2 text-[14px] text-[#0f172a] outline-none"
          >
            <option value="open">접수됨</option>
            <option value="reviewing">확인 중</option>
            <option value="answered">답변완료</option>
            <option value="closed">종료</option>
          </select>
          <button
            type="button"
            onClick={() => onStatusChange(request.id, request.status, adminNote, "")}
            disabled={saving}
            className="h-9 rounded-[9px] bg-[#1f6b5b] px-3 text-[14px] font-semibold text-white transition hover:bg-[#185447] disabled:bg-[#94a3b8]"
          >
            {saving ? "저장 중" : "메모 저장"}
          </button>
        </div>
      </div>
      <textarea
        value={adminNote}
        onChange={(event) => setAdminNote(event.target.value)}
        className="mt-3 min-h-[70px] w-full resize-y rounded-[9px] border border-[#dbe2ea] bg-[#fbfcfd] px-3 py-2 text-[14px] leading-5 text-[#334155] outline-none focus:border-[#1f6b5b]"
        placeholder="처리 메모"
      />
      {latestAnswer ? (
        <div className="mt-3 rounded-[9px] border border-[#dbe2ea] bg-[#fbfcfd] px-3 py-2">
          <p className="text-[13px] font-semibold text-[#1f6b5b]">최근 오너 노출 답변</p>
          <p className="mt-1 whitespace-pre-wrap text-[14px] leading-5 text-[#334155]">{latestAnswer.message}</p>
        </div>
      ) : null}
      <div className="mt-3 grid gap-2">
        <textarea
          value={answerMessage}
          onChange={(event) => setAnswerMessage(event.target.value)}
          className="min-h-[90px] w-full resize-y rounded-[9px] border border-[#dbe2ea] bg-white px-3 py-2 text-[14px] leading-5 text-[#334155] outline-none focus:border-[#1f6b5b]"
          placeholder="오너에게 보낼 답변을 입력하세요."
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              onStatusChange(request.id, "answered", adminNote, answerMessage);
              setAnswerMessage("");
            }}
            disabled={saving || !answerMessage.trim()}
            className="h-9 rounded-[9px] bg-[#245bd0] px-3 text-[14px] font-semibold text-white transition hover:bg-[#1e4fb8] disabled:bg-[#94a3b8]"
          >
            {saving ? "등록 중" : "답변 등록"}
          </button>
        </div>
      </div>
    </article>
  );
}

function StatusTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: "ok" | "warning" | "neutral";
}) {
  const toneClass =
    tone === "ok"
      ? "border-[#cfe4dc] bg-[#f8fdfb] text-[#1f6b5b]"
      : tone === "warning"
        ? "border-[#eadfcf] bg-[#fffaf3] text-[#9a5d12]"
        : "border-[#dbe2ea] bg-white text-[#64748b]";

  return (
    <div className="rounded-[10px] border border-[#dfe7e2] bg-white px-3 py-3">
      <div className="flex items-center gap-2">
        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full border ${toneClass}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <p className="text-[15px] text-[#64748b]">{label}</p>
      </div>
      <p className="mt-2 truncate text-[19px] tracking-[-0.02em] text-[#0f172a]">{value}</p>
    </div>
  );
}

function PrimaryActionCard({
  href,
  icon: Icon,
  title,
  meta,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  meta: string;
}) {
  return (
    <a
      href={href}
      className="group rounded-[12px] border border-[#dfe7e2] bg-white px-4 py-3 shadow-[0_6px_18px_rgba(23,32,51,0.035)] transition hover:-translate-y-0.5 hover:border-[#b9d5cc] hover:shadow-[0_10px_24px_rgba(23,32,51,0.06)]"
    >
      <div className="flex items-center gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#edf6f2] text-[#1f6b5b]">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-[18px] tracking-[-0.02em] text-[#0f172a]">{title}</h2>
            <span className="hidden shrink-0 rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[14px] text-[#64748b] sm:inline-flex">{meta}</span>
          </div>
          <div className="mt-1 inline-flex items-center gap-1 text-[15px] text-[#1f6b5b]">
            열기
            <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </div>
        </div>
      </div>
    </a>
  );
}

function DashboardRow({
  href,
  icon: Icon,
  title,
  meta,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  meta: string;
}) {
  return (
    <a href={href} className="grid grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[9px] border border-transparent px-2.5 py-2 transition hover:border-[#dfe7e2] hover:bg-[#f8fafc]">
      <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-[#f1f5f9] text-[#1f6b5b]">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-[15px] text-[#0f172a]">{title}</p>
          <span className="hidden rounded-full bg-[#eef2f6] px-2 py-0.5 text-[13px] text-[#64748b] sm:inline-flex">
            {meta}
          </span>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-[#94a3b8]" />
    </a>
  );
}

function CheckItem({ title, href }: { title: string; href: string }) {
  return (
    <a href={href} className="block rounded-[9px] border border-[#edf2f7] bg-[#f8fafc] px-3 py-2.5 transition hover:border-[#dfe7e2] hover:bg-white">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-[#1f6b5b]" />
        <p className="text-[15px] text-[#0f172a]">{title}</p>
      </div>
    </a>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-[15px] text-[#64748b]">{label}</dt>
      <dd className="min-w-0 truncate text-right text-[15px] text-[#0f172a]">{value}</dd>
    </div>
  );
}
