import { redirect } from "next/navigation";

import LoginForm from "@/components/auth/login-form";
import { getSafeNextPath } from "@/lib/auth/safe-next-path";
import { getServerSessionUser } from "@/lib/auth/server-session";
import { hasSupabaseBrowserEnv } from "@/lib/env";

const errorMessages: Record<string, string> = {
  supabase: "로그인 환경이 아직 준비되지 않았어요. 잠시 후 다시 시도해 주세요.",
  "no-shop": "가입은 완료됐지만 매장 정보가 아직 없어요. 기본 정보 입력을 마친 뒤 다시 이용해 주세요.",
};

const infoMessages: Record<string, string> = {
  "email-confirmed": "이메일 인증이 완료되었습니다. 로그인해 주세요.",
  "signup-success": "회원가입이 완료되었습니다. 로그인하면 초기 설정을 시작합니다.",
  "reset-success": "비밀번호가 변경됐어요. 새 비밀번호로 다시 로그인해 주세요.",
};

function getSafeLoginNextPath(
  value: string | undefined,
  resolve: typeof getSafeNextPath = (candidate, fallbackPath) => {
    if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
      return fallbackPath;
    }
    return candidate;
  },
) {
  return resolve(value, "/owner/mobile");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const errorKey = typeof params.error === "string" ? params.error : undefined;
  const messageKey = typeof params.message === "string" ? params.message : undefined;
  const nextPath = getSafeLoginNextPath(
    typeof params.next === "string" ? params.next : undefined,
    getSafeNextPath,
  );
  const user = await getServerSessionUser();

  if (user) {
    redirect(nextPath as never);
  }

  return (
    <LoginForm
      supabaseReady={hasSupabaseBrowserEnv()}
      nextPath={nextPath}
      initialMessage={
        errorKey ? (errorMessages[errorKey] ?? null) : messageKey ? (infoMessages[messageKey] ?? null) : null
      }
    />
  );
}
