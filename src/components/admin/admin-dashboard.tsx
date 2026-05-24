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
  ShoppingBag,
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

const dashboardItems = [
  {
    href: "/owner/admin",
    icon: LayoutDashboard,
    title: "오너 계정 관리",
    description: "가입 매장별 계정, 플랜 종료일, 결제 상태, 임시비밀번호 발급을 관리합니다.",
    meta: "계정 / 결제 / 복구",
    group: "primary",
  },
  {
    href: "/admin/alimtalk",
    icon: KeyRound,
    title: "알림톡 키 / 템플릿 관리",
    description: "relay 서버 원본 키, 템플릿 코드, 발송 진단 정보를 확인하고 수정합니다.",
    meta: "알림 / 템플릿",
    group: "primary",
  },
  {
    href: "/admin/env",
    icon: ServerCog,
    title: "환경변수 상태 확인",
    description: "AUTH_FLOW_SECRET, Supabase, PortOne 등 운영 필수 환경값을 점검합니다.",
    meta: "운영 환경",
    group: "system",
  },
  {
    href: "/owner",
    icon: Store,
    title: "오너 페이지 보기",
    description: "현재 로그인된 테스트 오너 화면으로 이동해 실제 운영 화면을 확인합니다.",
    meta: "Owner",
    group: "shortcut",
  },
  {
    href: "/demo/owner",
    icon: MonitorSmartphone,
    title: "오너 데모 보기",
    description: "데모 오너 화면과 기본 예약 플로우를 빠르게 확인합니다.",
    meta: "Demo",
    group: "shortcut",
  },
  {
    href: "/demo/book",
    icon: ShoppingBag,
    title: "고객 예약 페이지 보기",
    description: "첫 방문, 재방문 예약 흐름과 고객 노출 화면을 확인합니다.",
    meta: "Booking",
    group: "shortcut",
  },
  {
    href: "/",
    icon: ShieldCheck,
    title: "서비스 메인 보기",
    description: "랜딩과 체험 플랜 진입 화면을 확인합니다.",
    meta: "Public",
    group: "shortcut",
  },
] satisfies Array<{
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  meta: string;
  group: "primary" | "system" | "shortcut";
}>;

const groupLabels: Record<(typeof dashboardItems)[number]["group"], string> = {
  primary: "자주 쓰는 작업",
  system: "시스템 점검",
  shortcut: "바로가기",
};

const groupDescriptions: Record<(typeof dashboardItems)[number]["group"], string> = {
  primary: "계정, 결제, 메시지처럼 운영자가 바로 처리하는 작업입니다.",
  system: "운영 서버와 연동 상태를 확인합니다.",
  shortcut: "실제 서비스 화면을 빠르게 열어 확인합니다.",
};

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
  const primaryItems = dashboardItems.filter((item) => item.group === "primary");
  const systemItems = dashboardItems.filter((item) => item.group === "system");
  const shortcutItems = dashboardItems.filter((item) => item.group === "shortcut");
  const groupedItems = [
    { key: "primary" as const, items: primaryItems },
    { key: "system" as const, items: systemItems },
    { key: "shortcut" as const, items: shortcutItems },
  ];

  return (
    <main className="min-h-screen bg-[#f5f8f7] px-5 py-5 text-[#0f172a] md:px-8">
      <div className="mx-auto w-full max-w-[1440px]">
        <header className="rounded-[14px] border border-[#dbe7e2] bg-white px-5 py-5 shadow-[0_14px_36px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#eaf5f1] px-3 py-1 text-[14px] font-semibold text-[#1f6b5b]">
                <Sparkles className="h-3.5 w-3.5" />
                PetManager Admin
              </div>
              <h1 className="mt-3 text-[30px] font-semibold tracking-[-0.04em] text-[#0f172a]">운영 콘솔</h1>
              <p className="mt-2 max-w-[620px] text-[16px] leading-6 text-[#64748b]">
                오늘 확인할 운영 상태를 먼저 보고, 필요한 관리자 작업으로 바로 이동합니다.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-[10px] border border-[#dbe7e2] bg-[#fbfefd] px-4 py-2 text-right">
                <p className="text-[14px] font-medium text-[#64748b]">현재 운영 계정</p>
                <p className="mt-0.5 text-[16px] font-semibold text-[#0f172a]">{currentAccount.fullName}</p>
              </div>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-[#d0d8e3] bg-white px-4 text-[16px] font-semibold text-[#334155] transition hover:border-[#b8c4d2] hover:bg-[#f8fafc]"
              >
                <DoorOpen className="h-4 w-4" />
                로그아웃
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <StatusTile
              icon={CheckCircle2}
              label="운영 상태"
              value={currentAccount.isActive ? "정상" : "확인 필요"}
              description={currentAccount.isActive ? "관리자 계정이 활성화되어 있습니다." : "계정 상태를 확인해 주세요."}
              tone={currentAccount.isActive ? "ok" : "warning"}
            />
            <StatusTile
              icon={Activity}
              label="처리 대기"
              value="0건"
              description="현재 콘솔에서 즉시 처리할 알림은 없습니다."
              tone="neutral"
            />
            <StatusTile
              icon={MessageSquareText}
              label="알림 연동"
              value="점검 가능"
              description="템플릿과 relay 상태를 바로 확인할 수 있습니다."
              tone="neutral"
            />
            <StatusTile
              icon={ShieldCheck}
              label="권한"
              value={currentAccount.isSuperAdmin ? "Super Admin" : "Admin"}
              description={`로그인 ID ${currentAccount.loginId}`}
              tone="neutral"
            />
          </div>
        </header>

        {message ? (
          <p className="mt-4 rounded-[4px] border border-[#efcaca] bg-[#fff5f5] px-4 py-3 text-[14px] leading-6 text-[#b42318]">
            {message}
          </p>
        ) : null}

        <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              {primaryItems.map((item) => (
                <PrimaryActionCard key={item.href} {...item} />
              ))}
            </div>

            <div className="overflow-hidden rounded-[14px] border border-[#dbe7e2] bg-white shadow-[0_12px_32px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between border-b border-[#edf2f7] px-5 py-4">
                <div>
                  <h2 className="text-[18px] font-semibold text-[#0f172a]">운영 작업</h2>
                  <p className="mt-1 text-[14px] text-[#64748b]">작업 성격별로 필요한 메뉴만 빠르게 찾습니다.</p>
                </div>
                <span className="rounded-full border border-[#dbe2ea] bg-[#f8fafc] px-2.5 py-1 text-[14px] font-semibold text-[#475569]">
                  {dashboardItems.length}개
                </span>
              </div>

              <div className="divide-y divide-[#edf2f7]">
                {groupedItems.map(({ key, items }) => (
                  <section key={key} className="px-5 py-4">
                    <div className="mb-3 flex items-end justify-between gap-3">
                      <div>
                        <h3 className="text-[16px] font-semibold text-[#0f172a]">{groupLabels[key]}</h3>
                        <p className="mt-0.5 text-[14px] text-[#94a3b8]">{groupDescriptions[key]}</p>
                      </div>
                      <span className="text-[14px] font-semibold text-[#94a3b8]">{items.length}개</span>
                    </div>
                    <div className="grid gap-2">
                      {items.map((item) => (
                        <DashboardRow key={item.href} {...item} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-[14px] border border-[#dbe7e2] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.04)]">
              <div className="flex items-start gap-3 border-b border-[#edf2f7] pb-4">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#e6f3ef] text-[16px] font-bold text-[#1f6b5b]">
                  {currentAccount.fullName.slice(0, 1)}
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold uppercase tracking-[0.1em] text-[#94a3b8]">Account</p>
                  <h2 className="mt-1 truncate text-[20px] font-semibold text-[#0f172a]">{currentAccount.fullName}</h2>
                  <p className="mt-1 text-[14px] text-[#64748b]">{currentAccount.email}</p>
                </div>
              </div>

              <dl className="mt-4 space-y-3">
                <InfoRow label="아이디" value={currentAccount.loginId} />
                <InfoRow label="연락처" value={currentAccount.phoneNumber || "-"} />
                <InfoRow label="상태" value={currentAccount.isActive ? "활성" : "비활성"} />
                <InfoRow label="권한" value={currentAccount.isSuperAdmin ? "Super Admin" : "Admin"} />
              </dl>
            </div>

            <div className="rounded-[14px] border border-[#dbe7e2] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.04)]">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-[#1f6b5b]" />
                <h2 className="text-[16px] font-semibold text-[#0f172a]">오늘 확인할 것</h2>
              </div>
              <div className="mt-4 space-y-3">
                <CheckItem title="운영 환경" body="배포 후 본인인증, Supabase, 알림톡 값을 점검하세요." href="/admin/env" />
                <CheckItem title="오너 계정" body="결제 복구나 임시비밀번호 발급 전 대상 매장을 확인하세요." href="/owner/admin" />
                <CheckItem title="알림톡" body="템플릿 수정 후 실제 발송 진단을 확인하세요." href="/admin/alimtalk" />
              </div>
            </div>

            <div className="rounded-[14px] border border-[#dbe7e2] bg-[#fbfefd] px-5 py-4">
              <p className="text-[14px] font-semibold text-[#0f172a]">운영 기준</p>
              <p className="mt-2 text-[14px] leading-5 text-[#64748b]">
                계정 변경, 결제 복구, 임시비밀번호 발급은 운영 데이터에 직접 반영됩니다. 변경 전 대상 계정을 한 번 더 확인해 주세요.
              </p>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function StatusTile({
  icon: Icon,
  label,
  value,
  description,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  description: string;
  tone: "ok" | "warning" | "neutral";
}) {
  const toneClass =
    tone === "ok"
      ? "border-[#cfe4dc] bg-[#f8fdfb] text-[#1f6b5b]"
      : tone === "warning"
        ? "border-[#eadfcf] bg-[#fffaf3] text-[#9a5d12]"
        : "border-[#dbe2ea] bg-white text-[#64748b]";

  return (
    <div className="rounded-[12px] border border-[#dbe7e2] bg-white px-4 py-3">
      <div className="flex items-center gap-2">
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${toneClass}`}>
          <Icon className="h-4 w-4" />
        </span>
        <p className="text-[14px] font-medium text-[#64748b]">{label}</p>
      </div>
      <p className="mt-3 truncate text-[18px] font-semibold tracking-[-0.03em] text-[#0f172a]">{value}</p>
      <p className="mt-1 truncate text-[14px] text-[#94a3b8]">{description}</p>
    </div>
  );
}

function PrimaryActionCard({
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
    <a
      href={href}
      className="group rounded-[14px] border border-[#dbe7e2] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-[#b9d5cc] hover:shadow-[0_16px_38px_rgba(15,23,42,0.08)]"
    >
      <div className="flex items-start justify-between gap-4">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-[12px] bg-[#eaf5f1] text-[#1f6b5b]">
          <Icon className="h-5 w-5" />
        </span>
        <span className="rounded-full bg-[#f1f5f9] px-2.5 py-1 text-[14px] font-semibold text-[#64748b]">{meta}</span>
      </div>
      <h2 className="mt-4 text-[18px] font-semibold tracking-[-0.03em] text-[#0f172a]">{title}</h2>
      <p className="mt-2 line-clamp-2 text-[14px] leading-5 text-[#64748b]">{description}</p>
      <div className="mt-4 inline-flex items-center gap-1 text-[14px] font-semibold text-[#1f6b5b]">
        열기
        <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
      </div>
    </a>
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
    <a href={href} className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 rounded-[10px] border border-transparent px-3 py-3 transition hover:border-[#dbe7e2] hover:bg-[#f8fafc]">
      <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#f1f5f9] text-[#1f6b5b]">
        <Icon className="h-[17px] w-[17px]" />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-[16px] font-semibold text-[#0f172a]">{title}</p>
          <span className="hidden rounded-full bg-[#eef2f6] px-2 py-0.5 text-[11px] font-semibold text-[#64748b] sm:inline-flex">
            {meta}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[14px] text-[#64748b]">{description}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-[#94a3b8]" />
    </a>
  );
}

function CheckItem({ title, body, href }: { title: string; body: string; href: string }) {
  return (
    <a href={href} className="block rounded-[10px] border border-[#edf2f7] bg-[#f8fafc] px-3 py-3 transition hover:border-[#dbe7e2] hover:bg-white">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-[#1f6b5b]" />
        <p className="text-[14px] font-semibold text-[#0f172a]">{title}</p>
      </div>
      <p className="mt-1 line-clamp-2 text-[14px] leading-5 text-[#64748b]">{body}</p>
    </a>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-[14px] font-medium text-[#64748b]">{label}</dt>
      <dd className="min-w-0 truncate text-right text-[14px] font-semibold text-[#0f172a]">{value}</dd>
    </div>
  );
}
