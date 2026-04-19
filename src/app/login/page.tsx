import { redirect } from "next/navigation";

import LoginForm from "@/components/auth/login-form";
import { getServerSessionUser } from "@/lib/auth/server-session";
import { hasSupabaseBrowserEnv } from "@/lib/env";

const errorMessages: Record<string, string> = {
  supabase: "Supabase 환경이 아직 준비되지 않았어요. `.env.local` 설정을 다시 확인해 주세요.",
  "no-shop": "가입은 되었지만 매장 정보가 아직 없어요. 기본정보 입력을 마친 뒤 다시 이용해 주세요.",
};

const infoMessages: Record<string, string> = {
  "signup-success": "회원가입이 완료되었어요. 로그인하면 바로 2주 무료체험을 시작할 수 있어요.",
  "reset-success": "비밀번호가 변경되었어요. 새 비밀번호로 다시 로그인해 주세요.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const errorKey = typeof params.error === "string" ? params.error : undefined;
  const messageKey = typeof params.message === "string" ? params.message : undefined;
  const nextPath = typeof params.next === "string" && params.next.startsWith("/") ? params.next : "/owner";
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
