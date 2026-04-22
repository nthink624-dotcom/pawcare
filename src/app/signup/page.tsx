import { redirect } from "next/navigation";

import SignupForm from "@/components/auth/signup-form";
import { getServerSessionUser } from "@/lib/auth/server-session";
import { hasPortoneBrowserEnv, hasSupabaseBrowserEnv } from "@/lib/env";

export default async function SignupPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const nextPath = typeof params.next === "string" && params.next.startsWith("/") ? params.next : "/owner";
  const user = await getServerSessionUser();

  if (user) {
    redirect(nextPath as never);
  }

  return (
    <SignupForm
      supabaseReady={hasSupabaseBrowserEnv()}
      portoneReady={hasPortoneBrowserEnv()}
      nextPath={nextPath}
      initialStart="email"
    />
  );
}
