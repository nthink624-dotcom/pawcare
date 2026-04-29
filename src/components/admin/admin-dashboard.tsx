"use client";

import { DoorOpen, LayoutDashboard, MonitorSmartphone, ShieldCheck, ShoppingBag, Store, UserRoundCog } from "lucide-react";
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
  };

  return (
    <main className="min-h-screen bg-[#faf7f2] px-5 py-5 text-[#171411] md:px-8 md:py-7">
      <div className="mx-auto w-full max-w-[1400px]">
        <section className="rounded-[28px] border border-[#e8dfd3] bg-white px-6 py-6 shadow-[0_16px_40px_rgba(23,20,17,0.06)] md:px-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#eef7f2] text-[#1f6b5b]">
                <UserRoundCog className="h-7 w-7" />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold tracking-[0.04em] text-[#1f6b5b]">운영자 모드</p>
                <h1 className="mt-2 text-[34px] font-bold tracking-[-0.04em] text-[#171411]">관리자 콘솔</h1>
                <p className="mt-3 max-w-[760px] text-[15px] leading-7 text-[#6f665f]">
                  오너 계정 상태, 플랜, 체험 플랜, 계정 정지와 복구까지 관리자 시점에서 빠르게 관리할 수 있는 화면입니다.
                  운영용 화면이므로 모바일 프레임이 아니라 넓은 웹 레이아웃으로 구성했습니다.
                </p>
              </div>
            </div>

            <div className="rounded-[20px] border border-[#e5ddd2] bg-[#fcfbf8] px-5 py-4">
              <p className="text-[12px] font-semibold tracking-[0.04em] text-[#8a8277]">현재 운영자 계정</p>
              <p className="mt-2 text-[20px] font-bold text-[#171411]">{currentAccount.fullName}</p>
              <div className="mt-3 space-y-1.5 text-[13px] text-[#6f665f]">
                <p>아이디 · {currentAccount.loginId}</p>
                <p>이메일 · {currentAccount.email}</p>
                <p>연락처 · {currentAccount.phoneNumber || "-"}</p>
              </div>
            </div>
          </div>

          {message ? (
            <p className="mt-5 rounded-[16px] border border-[#f0d1d1] bg-[#fff7f7] px-4 py-3 text-[13px] leading-6 text-[#b54b4b]">
              {message}
            </p>
          ) : null}
        </section>

        <section className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <DashboardLink
            href="/owner/admin"
            icon={LayoutDashboard}
            title="오너 계정 관리"
            description="가입한 사장님 계정의 플랜, 체험 플랜 종료일, 결제 상태, 계정 정지와 복구를 직접 조정합니다."
          />
          <DashboardLink
            href="/owner"
            icon={Store}
            title="오너 페이지 보기"
            description="현재 로그인된 실제 오너 페이지를 확인합니다. 미리보기 예약은 여기 섞이지 않습니다."
          />
          <DashboardLink
            href="/demo/owner"
            icon={MonitorSmartphone}
            title="오너 페이지 미리보기"
            description="고객 예약 페이지 미리보기에서 만든 테스트 예약까지 같은 테스트 매장 기준으로 확인합니다."
          />
          <DashboardLink
            href="/demo/book"
            icon={ShoppingBag}
            title="고객 예약 페이지 미리보기"
            description="첫 방문, 재방문, 예약 확인 흐름을 테스트하고 오너 페이지 미리보기에서 함께 확인합니다."
          />
          <DashboardLink
            href="/"
            icon={ShieldCheck}
            title="서비스 메인 보기"
            description="랜딩과 체험 플랜 진입 화면을 확인하고 전체 퍼널을 점검합니다."
          />
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex min-h-[148px] flex-col items-start justify-between rounded-[24px] border border-[#e8dfd3] bg-white px-5 py-5 text-left shadow-[0_10px_24px_rgba(23,20,17,0.04)]"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#fdf4f2] text-[#b54b4b]">
              <DoorOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[18px] font-semibold text-[#171411]">관리자 로그아웃</p>
              <p className="mt-2 text-[13px] leading-6 text-[#6f665f]">현재 관리자 세션을 종료하고 로그인 화면으로 돌아갑니다.</p>
            </div>
          </button>
        </section>
      </div>
    </main>
  );
}

function DashboardLink({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: typeof Store;
  title: string;
  description: string;
}) {
  return (
    <a href={href} className="flex min-h-[148px] flex-col items-start justify-between rounded-[24px] border border-[#e8dfd3] bg-white px-5 py-5 shadow-[0_10px_24px_rgba(23,20,17,0.04)]">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#eef7f2] text-[#1f6b5b]">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-[18px] font-semibold text-[#171411]">{title}</p>
        <p className="mt-2 text-[13px] leading-6 text-[#6f665f]">{description}</p>
      </div>
    </a>
  );
}
