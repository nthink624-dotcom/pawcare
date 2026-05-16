"use client";

import {
  ChevronRight,
  DoorOpen,
  KeyRound,
  LayoutDashboard,
  MonitorSmartphone,
  ServerCog,
  ShieldCheck,
  ShoppingBag,
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

const dashboardItems = [
  {
    href: "/owner/admin",
    icon: LayoutDashboard,
    title: "오너 계정 관리",
    description: "가입 매장별 계정, 플랜 종료일, 결제 상태, 임시비밀번호 발급을 관리합니다.",
    meta: "계정 / 결제 / 복구",
  },
  {
    href: "/admin/alimtalk",
    icon: KeyRound,
    title: "알림톡 키 / 템플릿 관리",
    description: "relay 서버 원본 키, 템플릿 코드, 발송 진단 정보를 확인하고 수정합니다.",
    meta: "알림 / 템플릿",
  },
  {
    href: "/admin/env",
    icon: ServerCog,
    title: "환경변수 상태 확인",
    description: "AUTH_FLOW_SECRET, Supabase, PortOne 등 운영 필수 환경값을 점검합니다.",
    meta: "운영 환경",
  },
  {
    href: "/owner",
    icon: Store,
    title: "오너 페이지 보기",
    description: "현재 로그인된 테스트 오너 화면으로 이동해 실제 운영 화면을 확인합니다.",
    meta: "Owner",
  },
  {
    href: "/demo/owner",
    icon: MonitorSmartphone,
    title: "오너 데모 보기",
    description: "데모 오너 화면과 기본 예약 플로우를 빠르게 확인합니다.",
    meta: "Demo",
  },
  {
    href: "/demo/book",
    icon: ShoppingBag,
    title: "고객 예약 페이지 보기",
    description: "첫 방문, 재방문 예약 흐름과 고객 노출 화면을 확인합니다.",
    meta: "Booking",
  },
  {
    href: "/",
    icon: ShieldCheck,
    title: "서비스 메인 보기",
    description: "랜딩과 체험 플랜 진입 화면을 확인합니다.",
    meta: "Public",
  },
] satisfies Array<{
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  meta: string;
}>;

export default function AdminDashboard({ sessionLoginId }: { sessionLoginId: string }) {
  const router = useRouter();
  const [account, setAccount] = useState<AdminDashboardAccount | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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

  return (
    <main className="min-h-screen bg-[#f3f4f6] px-5 py-5 text-[#0f172a] md:px-8">
      <div className="mx-auto w-full max-w-[1440px]">
        <header className="flex min-h-16 items-center justify-between gap-4 border-b border-[#dbe2ea] pb-4">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#64748b]">PetManager Admin</p>
            <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.03em] text-[#0f172a]">관리자 콘솔</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden rounded-[4px] border border-[#dbe2ea] bg-white px-4 py-2 text-right md:block">
              <p className="text-[12px] font-medium text-[#64748b]">현재 운영 계정</p>
              <p className="mt-0.5 text-[14px] font-semibold text-[#0f172a]">{currentAccount.fullName}</p>
            </div>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="inline-flex h-10 items-center gap-2 rounded-[4px] border border-[#d0d8e3] bg-white px-3 text-[13px] font-semibold text-[#334155] transition hover:border-[#b8c4d2] hover:bg-[#f8fafc]"
            >
              <DoorOpen className="h-4 w-4" />
              로그아웃
            </button>
          </div>
        </header>

        {message ? (
          <p className="mt-4 rounded-[4px] border border-[#efcaca] bg-[#fff5f5] px-4 py-3 text-[13px] leading-6 text-[#b42318]">
            {message}
          </p>
        ) : null}

        <section className="mt-5 grid gap-3 md:grid-cols-4">
          <StatusTile label="계정 권한" value={currentAccount.isSuperAdmin ? "Super Admin" : "Admin"} />
          <StatusTile label="계정 상태" value={currentAccount.isActive ? "Active" : "Inactive"} />
          <StatusTile label="로그인 ID" value={currentAccount.loginId} />
          <StatusTile label="연락처" value={currentAccount.phoneNumber || "-"} />
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="overflow-hidden rounded-[4px] border border-[#dbe2ea] bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between border-b border-[#dbe2ea] px-5 py-4">
              <div>
                <h2 className="text-[18px] font-semibold text-[#0f172a]">운영 메뉴</h2>
                <p className="mt-1 text-[13px] text-[#64748b]">관리자 작업을 기능 단위로 실행합니다.</p>
              </div>
              <span className="rounded-[4px] border border-[#dbe2ea] bg-[#f8fafc] px-2.5 py-1 text-[12px] font-semibold text-[#475569]">
                {dashboardItems.length}개
              </span>
            </div>

            <div className="divide-y divide-[#edf2f7]">
              {dashboardItems.map((item) => (
                <DashboardRow key={item.href} {...item} />
              ))}
            </div>
          </div>

          <aside className="rounded-[4px] border border-[#dbe2ea] bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <div className="border-b border-[#edf2f7] pb-4">
              <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#64748b]">Account</p>
              <h2 className="mt-2 text-[20px] font-semibold text-[#0f172a]">{currentAccount.fullName}</h2>
            </div>

            <dl className="mt-4 space-y-3">
              <InfoRow label="아이디" value={currentAccount.loginId} />
              <InfoRow label="이메일" value={currentAccount.email} />
              <InfoRow label="연락처" value={currentAccount.phoneNumber || "-"} />
              <InfoRow label="권한" value={currentAccount.isSuperAdmin ? "Super Admin" : "Admin"} />
            </dl>

            <div className="mt-5 rounded-[4px] border border-[#dbe2ea] bg-[#f8fafc] px-4 py-3">
              <p className="text-[13px] font-semibold text-[#0f172a]">운영 기준</p>
              <p className="mt-2 text-[12px] leading-5 text-[#64748b]">
                계정 변경, 결제 복구, 임시비밀번호 발급은 운영 데이터에 직접 반영됩니다. 변경 전 대상 계정을 확인해 주세요.
              </p>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function StatusTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[4px] border border-[#dbe2ea] bg-white px-4 py-3">
      <p className="text-[12px] font-medium text-[#64748b]">{label}</p>
      <p className="mt-1 truncate text-[15px] font-semibold text-[#0f172a]">{value}</p>
    </div>
  );
}

function DashboardRow({
  href,
  icon: Icon,
  title,
  description,
  meta,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  meta: string;
}) {
  return (
    <a href={href} className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 transition hover:bg-[#f8fafc]">
      <div className="flex h-9 w-9 items-center justify-center rounded-[4px] border border-[#dbe2ea] bg-[#f8fafc] text-[#1f6b5b]">
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-[15px] font-semibold text-[#0f172a]">{title}</p>
          <span className="hidden rounded-[4px] bg-[#eef2f6] px-2 py-0.5 text-[11px] font-semibold text-[#64748b] sm:inline-flex">
            {meta}
          </span>
        </div>
        <p className="mt-1 truncate text-[13px] text-[#64748b]">{description}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-[#94a3b8]" />
    </a>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-[12px] font-medium text-[#64748b]">{label}</dt>
      <dd className="min-w-0 truncate text-right text-[13px] font-semibold text-[#0f172a]">{value}</dd>
    </div>
  );
}
