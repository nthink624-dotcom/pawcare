import ResetPasswordForm from "@/components/auth/reset-password-form";
import { hasSupabaseBrowserEnv } from "@/lib/env";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const loginId = typeof params.loginId === "string" ? params.loginId : undefined;

  return <ResetPasswordForm initialLoginId={loginId} ready={hasSupabaseBrowserEnv()} />;
}
