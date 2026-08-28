"use client";

import {
  ArrowRight,
  DoorOpen,
  Megaphone,
  MessageSquareText,
  ShieldCheck,
  Store,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  formatWon,
  isPendingSupportRequest,
  type AdminDashboardAccount,
  type AdminRevenueSummary,
  type OwnerSupportRequestItem,
} from "@/components/admin/admin-dashboard-model";
import AdminSectionNav from "@/components/admin/admin-section-nav";
import { ADMIN_TYPOGRAPHY } from "@/components/admin/admin-typography";
import { fetchApiJson } from "@/lib/api";
import { PETMANAGER_SERVICE_NAME } from "@/lib/brand";

export default function AdminHome({ sessionLoginId }: { sessionLoginId: string }) {
  const router = useRouter();
  const [account, setAccount] = useState<AdminDashboardAccount | null>(null);
  const [supportRequests, setSupportRequests] = useState<OwnerSupportRequestItem[]>([]);
  const [revenueSummary, setRevenueSummary] = useState<AdminRevenueSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    Promise.allSettled([
      fetchApiJson<AdminDashboardAccount>("/api/admin/session", { cache: "no-store" }),
      fetchApiJson<{ requests: OwnerSupportRequestItem[] }>("/api/admin/support-requests?limit=50", {
        cache: "no-store",
      }),
      fetchApiJson<AdminRevenueSummary>("/api/admin/revenue-summary", { cache: "no-store" }),
    ]).then(([accountResult, supportResult, revenueResult]) => {
      if (!active) return;

      if (accountResult.status === "fulfilled") setAccount(accountResult.value);
      if (supportResult.status === "fulfilled") setSupportRequests(supportResult.value.requests);
      if (revenueResult.status === "fulfilled") setRevenueSummary(revenueResult.value);

      const failed = [accountResult, supportResult, revenueResult].filter((result) => result.status === "rejected").length;
      setError(failed > 0 ? `일부 운영 요약 ${failed}개를 불러오지 못했습니다. 상세 화면에서 다시 확인해 주세요.` : null);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  async function handleLogout() {
    try {
      await fetchApiJson<{ success: true }>("/api/admin/auth/logout", { method: "POST" });
    } finally {
      router.replace("/admin/login" as never);
      router.refresh();
    }
  }

  const currentAccount = account ?? { fullName: "관리자", loginId: sessionLoginId, isActive: true };
  const pendingCount = supportRequests.filter(isPendingSupportRequest).length;

  return (
    <main className="min-h-screen bg-[#f4f7fb] px-5 py-6 text-[#172033] lg:px-8 lg:py-8">
      <div className="mx-auto w-full max-w-[1440px]">
        <header className="rounded-[20px] border border-[#dce5f0] bg-white px-6 py-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)] lg:px-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className={`${ADMIN_TYPOGRAPHY.meta} text-[#2563eb]`}>{PETMANAGER_SERVICE_NAME} ADMIN</p>
              <h1 className={`mt-1 tracking-[-0.03em] text-[#0f172a] ${ADMIN_TYPOGRAPHY.pageTitle}`}>관리자 홈</h1>
              <p className={`mt-2 text-[#64748b] ${ADMIN_TYPOGRAPHY.body}`}>
                중요한 현황만 확인하고, 필요한 업무 영역으로 바로 이동하세요.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden text-right md:block">
                <p className={`${ADMIN_TYPOGRAPHY.helper} text-[#64748b]`}>현재 운영자</p>
                <p className={`${ADMIN_TYPOGRAPHY.meta} text-[#0f172a]`}>
                  {currentAccount.fullName} · {currentAccount.loginId}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className={`inline-flex h-11 items-center gap-2 rounded-[10px] border border-[#dbe4ef] bg-white px-4 text-[#475569] transition hover:bg-[#f8fafc] ${ADMIN_TYPOGRAPHY.control}`}
              >
                <DoorOpen className="h-4 w-4" aria-hidden />
                로그아웃
              </button>
            </div>
          </div>

          <div className="mt-5 border-t border-[#edf2f7] pt-5">
            <AdminSectionNav active="home" />
          </div>
        </header>

        {error ? (
          <p className={`mt-4 rounded-[12px] border border-[#f1d7a8] bg-[#fffbeb] px-4 py-3 text-[#8a6211] ${ADMIN_TYPOGRAPHY.body}`}>
            {error}
          </p>
        ) : null}

        <section aria-labelledby="today-summary" className="mt-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className={`${ADMIN_TYPOGRAPHY.meta} text-[#2563eb]`}>TODAY</p>
              <h2 id="today-summary" className={`mt-1 text-[#0f172a] ${ADMIN_TYPOGRAPHY.sectionTitle}`}>
                오늘 먼저 볼 것
              </h2>
            </div>
            <p className={`${ADMIN_TYPOGRAPHY.helper} text-[#64748b]`}>{loading ? "요약 불러오는 중" : "최신 운영 데이터 기준"}</p>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <HomeMetric icon={MessageSquareText} label="미처리 문의" value={loading ? "—" : `${pendingCount}건`} attention={pendingCount > 0} />
            <HomeMetric icon={WalletCards} label="이번 달 매출" value={loading ? "—" : formatWon(revenueSummary?.monthRevenue ?? 0)} />
            <HomeMetric icon={Store} label="유료 이용 매장" value={loading ? "—" : `${revenueSummary?.activePaidSubscriptions ?? 0}곳`} />
          </div>
        </section>

        <section aria-labelledby="admin-workspaces" className="mt-8">
          <p className={`${ADMIN_TYPOGRAPHY.meta} text-[#2563eb]`}>WORKSPACES</p>
          <h2 id="admin-workspaces" className={`mt-1 text-[#0f172a] ${ADMIN_TYPOGRAPHY.sectionTitle}`}>
            관리 업무 선택
          </h2>
          <p className={`mt-1 text-[#64748b] ${ADMIN_TYPOGRAPHY.body}`}>상세 정보와 변경 기능은 각 업무 화면 안에서 확인할 수 있습니다.</p>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <WorkspaceCard
              href="/owner/admin"
              icon={ShieldCheck}
              title="오너 계정 관리"
              description="오너 계정, 플랜, 이용 상태, 알림톡과 결제를 관리합니다."
              meta="계정 및 매장 단위 상세 관리"
            />
            <WorkspaceCard
              href="/admin/marketing"
              icon={Megaphone}
              title="마케팅 워룸"
              description="성장 지표, 자동화 연결 상태와 실행 대기 항목을 확인합니다."
              meta="마케팅 운영 현황 및 KPI"
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function HomeMetric({
  icon: Icon,
  label,
  value,
  attention = false,
}: {
  icon: typeof MessageSquareText;
  label: string;
  value: string;
  attention?: boolean;
}) {
  return (
    <div className="flex min-h-[104px] items-center gap-4 rounded-[16px] border border-[#dce5f0] bg-white px-5 py-4">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] ${attention ? "bg-[#fff4e8] text-[#a46619]" : "bg-[#eff6ff] text-[#2563eb]"}`}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className={`${ADMIN_TYPOGRAPHY.meta} text-[#64748b]`}>{label}</p>
        <p className={`mt-1 truncate text-[#0f172a] ${ADMIN_TYPOGRAPHY.sectionTitle}`}>{value}</p>
      </div>
    </div>
  );
}

function WorkspaceCard({
  href,
  icon: Icon,
  title,
  description,
  meta,
}: {
  href: string;
  icon: typeof MessageSquareText;
  title: string;
  description: string;
  meta: string;
}) {
  return (
    <Link
      href={href as never}
      className="group flex min-h-[250px] flex-col rounded-[20px] border border-[#dce5f0] bg-white p-6 shadow-[0_10px_28px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-[#9db8dc] hover:shadow-[0_16px_36px_rgba(37,99,235,0.10)]"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#eff6ff] text-[#2563eb]">
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <h3 className={`mt-6 text-[#0f172a] ${ADMIN_TYPOGRAPHY.sectionTitle}`}>{title}</h3>
      <p className={`mt-2 break-keep text-[#64748b] ${ADMIN_TYPOGRAPHY.body}`}>{description}</p>
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-[#edf2f7] pt-5">
        <span className={`${ADMIN_TYPOGRAPHY.meta} text-[#475569]`}>{meta}</span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0f172a] text-white transition group-hover:bg-[#2563eb]">
          <ArrowRight className="h-4 w-4" aria-hidden />
        </span>
      </div>
    </Link>
  );
}
