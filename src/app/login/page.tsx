import LoginForm from "@/components/auth/login-form";
import { hasSupabaseBrowserEnv } from "@/lib/env";

const errorMessages: Record<string, string> = {
  supabase: "Supabase 환경 변수가 설정되지 않았습니다. .env.local을 먼저 확인해 주세요.",
  "no-shop": "연결된 매장 정보가 없습니다. 회원가입 후 다시 로그인해 주세요.",
};

const infoMessages: Record<string, string> = {
  "signup-success": "회원가입이 완료되었습니다. 로그인해 주세요.",
  "reset-success": "비밀번호가 재설정되었습니다. 새 비밀번호로 로그인해 주세요.",
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

  return (
    <LoginForm
      supabaseReady={hasSupabaseBrowserEnv()}
      nextPath={nextPath}
      initialMessage={
        errorKey
          ? errorMessages[errorKey] ?? null
          : messageKey
            ? infoMessages[messageKey] ?? null
            : null
      }
    />
  );
}
