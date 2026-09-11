import ResetPasswordForm from "@/components/auth/reset-password-form";
import { hasSupabaseBrowserEnv } from "@/lib/env";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const email = typeof params.email === "string" ? params.email : undefined;

  return <ResetPasswordForm initialEmail={email} ready={hasSupabaseBrowserEnv()} />;
}
