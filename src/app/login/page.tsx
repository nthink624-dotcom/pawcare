import { redirect } from "next/navigation";

import LoginForm from "@/components/auth/login-form";
import { hasSupabaseBrowserEnv } from "@/lib/env";

const errorMessages: Record<string, string> = {
  supabase: "Supabase 환경이 아직 준비되지 않았어요. 설정을 다시 확인해 주세요.",
  "no-shop": "가입은 되었지만 매장 정보가 아직 없어요. 기본 정보를 입력한 뒤 다시 이용해 주세요.",
  "social-access-denied": "소셜 로그인 동의가 취소되었거나 완료되지 않았어요. 다시 시도해 주세요.",
  "social-oauth": "소셜 로그인 연결에 실패했어요. OAuth 설정과 Supabase Redirect URL을 확인해 주세요.",
  "social-callback": "소셜 로그인 연결을 완료하지 못했어요. 다시 시도해 주세요.",
  "social-session": "소셜 로그인 세션을 만들지 못했어요. 다시 시도해 주세요.",
};

const infoMessages: Record<string, string> = {
  "signup-success": "회원가입이 완료되었어요. 로그인하면 바로 2주 무료체험을 시작할 수 있어요.",
  "reset-success": "비밀번호가 변경되었어요. 새 비밀번호로 다시 로그인해 주세요.",
};

function isRateLimitDetail(value?: string) {
  const normalized = (value ?? "").toLowerCase();
  return (
    normalized.includes("rate limit") ||
    normalized.includes("too many") ||
    normalized.includes("429") ||
    (normalized.includes("request") && normalized.includes("limit"))
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const errorKey = typeof params.error === "string" ? params.error : undefined;
  const errorDetail = typeof params.detail === "string" ? params.detail : undefined;
  const messageKey = typeof params.message === "string" ? params.message : undefined;
  const nextPath = typeof params.next === "string" && params.next.startsWith("/") ? params.next : "/owner";
  const isRateLimited = isRateLimitDetail(errorDetail);
  const shouldShowDetail = Boolean(errorKey) && !isRateLimited;
  const initialMessage = errorKey
    ? isRateLimited
      ? "소셜 로그인 요청이 잠시 제한됐어요. 5~10분 뒤 다시 시도해 주세요."
      : [errorMessages[errorKey] ?? null, shouldShowDetail && errorDetail ? `상세: ${errorDetail}` : null]
          .filter(Boolean)
          .join(" ")
    : messageKey
      ? (infoMessages[messageKey] ?? null)
      : null;

  if (messageKey === "already-authenticated") {
    redirect(nextPath as never);
  }

  return <LoginForm supabaseReady={hasSupabaseBrowserEnv()} nextPath={nextPath} initialMessage={initialMessage} />;
}
