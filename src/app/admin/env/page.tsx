import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, CircleAlert, CircleMinus } from "lucide-react";

import { serverEnv } from "@/lib/server-env";
import { getAdminAccountById } from "@/server/admin-account";
import { getServerAdminSession } from "@/server/admin-session";

type EnvStatus = "ok" | "fallback" | "missing";

type EnvRow = {
  name: string;
  label: string;
  status: EnvStatus;
};

function hasValue(value: string | undefined | null) {
  return Boolean(value?.trim());
}

function statusFrom(value: string | undefined | null): EnvStatus {
  return hasValue(value) ? "ok" : "missing";
}

function buildRuntimeRows(): EnvRow[] {
  const hasExplicitAuthFlowSecret = hasValue(process.env.AUTH_FLOW_SECRET);
  const hasAuthFlowFallback = !hasExplicitAuthFlowSecret && hasValue(serverEnv.authFlowSecret);

  return [
    {
      name: "AUTH_FLOW_SECRET",
      label: "본인인증/비밀번호 재설정 토큰",
      status: hasExplicitAuthFlowSecret ? "ok" : hasAuthFlowFallback ? "fallback" : "missing",
    },
    {
      name: "ADMIN_SESSION_SECRET",
      label: "관리자 세션",
      status: statusFrom(process.env.ADMIN_SESSION_SECRET),
    },
    {
      name: "NEXT_PUBLIC_SITE_URL",
      label: "서비스 기준 URL",
      status: statusFrom(process.env.NEXT_PUBLIC_SITE_URL),
    },
    {
      name: "NEXT_PUBLIC_SUPABASE_URL",
      label: "Supabase 공개 URL",
      status: statusFrom(process.env.NEXT_PUBLIC_SUPABASE_URL),
    },
    {
      name: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY",
      label: "Supabase 공개 키",
      status: hasValue(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
        ? "ok"
        : "missing",
    },
    {
      name: "SUPABASE_SERVICE_ROLE_KEY",
      label: "Supabase 관리자 키",
      status: statusFrom(process.env.SUPABASE_SERVICE_ROLE_KEY),
    },
    {
      name: "PORTONE_API_SECRET",
      label: "PortOne 서버 API",
      status: statusFrom(process.env.PORTONE_API_SECRET),
    },
    {
      name: "NEXT_PUBLIC_PORTONE_STORE_ID",
      label: "PortOne 스토어 ID",
      status: statusFrom(process.env.NEXT_PUBLIC_PORTONE_STORE_ID),
    },
    {
      name: "NEXT_PUBLIC_PORTONE_IDENTITY_KCP_CHANNEL_KEY / NEXT_PUBLIC_PORTONE_IDENTITY_CHANNEL_KEY",
      label: "KCP 본인인증 채널",
      status: statusFrom(
        process.env.NEXT_PUBLIC_PORTONE_IDENTITY_KCP_CHANNEL_KEY || process.env.NEXT_PUBLIC_PORTONE_IDENTITY_CHANNEL_KEY,
      ),
    },
    {
      name: "NEXT_PUBLIC_NAVER_OAUTH_PROVIDER",
      label: "네이버 OAuth Provider",
      status: statusFrom(process.env.NEXT_PUBLIC_NAVER_OAUTH_PROVIDER),
    },
  ];
}

const statusCopy: Record<EnvStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  ok: {
    label: "등록됨",
    className: "border-[#cfe0d9] bg-[#f7fbf9] text-[#1f6b5b]",
    icon: CheckCircle2,
  },
  fallback: {
    label: "대체값 사용",
    className: "border-[#eadfcf] bg-[#fffaf3] text-[#8a5a12]",
    icon: CircleMinus,
  },
  missing: {
    label: "없음",
    className: "border-[#efd1d1] bg-[#fff7f7] text-[#b54b4b]",
    icon: CircleAlert,
  },
};

export default async function AdminEnvPage() {
  const session = await getServerAdminSession();

  if (!session) {
    redirect("/admin/login" as never);
  }

  const account = await getAdminAccountById(session.accountId);
  if (!account?.isActive) {
    redirect("/admin/login" as never);
  }

  const rows = buildRuntimeRows();
  const missingCount = rows.filter((row) => row.status === "missing").length;

  return (
    <main className="min-h-screen bg-[#faf7f2] px-5 py-5 text-[#171411] md:px-8 md:py-7">
      <div className="mx-auto w-full max-w-[1120px]">
        <a
          href="/admin"
          className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-[#e5ddd2] bg-white px-3 text-[16px] font-semibold text-[#4f5f59]"
        >
          <ArrowLeft className="h-4 w-4" />
          관리자 콘솔
        </a>

        <section className="mt-4 rounded-[18px] border border-[#e5ddd2] bg-white px-6 py-6 shadow-[0_12px_28px_rgba(23,20,17,0.05)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[14px] font-semibold text-[#1f6b5b]">서버 런타임 진단</p>
              <h1 className="mt-2 text-[30px] font-bold tracking-[-0.03em] text-[#171411]">환경변수 상태</h1>
            </div>
            <div className="rounded-[12px] border border-[#e5ddd2] bg-[#fcfbf8] px-4 py-3 text-[14px] text-[#6f665f]">
              <span className="font-semibold text-[#171411]">{missingCount === 0 ? "필수값 정상" : `누락 ${missingCount}개`}</span>
              <span className="mx-2 text-[#c9c0b4]">/</span>
              <span>{process.env.VERCEL_ENV || process.env.NODE_ENV || "runtime"}</span>
            </div>
          </div>
        </section>

        <section className="mt-4 overflow-hidden rounded-[18px] border border-[#e5ddd2] bg-white">
          <div className="grid grid-cols-[minmax(0,1fr)_128px] border-b border-[#eee7dc] bg-[#fcfbf8] px-5 py-3 text-[14px] font-semibold text-[#6f665f]">
            <span>환경변수</span>
            <span className="text-right">상태</span>
          </div>

          {rows.map((row) => {
            const meta = statusCopy[row.status];
            const Icon = meta.icon;

            return (
              <div
                key={row.name}
                className="grid grid-cols-[minmax(0,1fr)_128px] gap-3 border-b border-[#f0ebe4] px-5 py-4 last:border-b-0 md:items-center"
              >
                <div className="min-w-0">
                  <p className="break-all text-[16px] font-semibold text-[#171411]">{row.name}</p>
                  <p className="mt-1 text-[14px] text-[#7a7066]">{row.label}</p>
                </div>
                <div className="flex md:justify-end">
                  <span className={`inline-flex h-8 items-center gap-1.5 rounded-[8px] border px-2.5 text-[14px] font-semibold ${meta.className}`}>
                    <Icon className="h-3.5 w-3.5" />
                    {meta.label}
                  </span>
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}
