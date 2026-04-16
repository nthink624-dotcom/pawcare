import SignupForm from "@/components/auth/signup-form";
import { hasPortoneBrowserEnv, hasSupabaseBrowserEnv } from "@/lib/env";

export default async function SignupPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const nextPath = typeof params.next === "string" && params.next.startsWith("/") ? params.next : "/owner";
  const initialStart = typeof params.start === "string" && params.start === "email" ? "email" : null;

  return (
    <SignupForm
      supabaseReady={hasSupabaseBrowserEnv()}
      portoneReady={hasPortoneBrowserEnv()}
      nextPath={nextPath}
      initialStart={initialStart}
    />
  );
}
