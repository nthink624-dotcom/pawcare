import { redirect } from "next/navigation";

import SignupForm from "@/components/auth/signup-form";
import { getSafeNextPath } from "@/lib/auth/safe-next-path";
import { getServerSessionUser } from "@/lib/auth/server-session";
import { hasPortoneBrowserEnv, hasSupabaseBrowserEnv } from "@/lib/env";

export default async function SignupPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const nextPath = getSafeNextPath(typeof params.next === "string" ? params.next : undefined, "/owner");
  const priceGuideFixtureEnabled = process.env.SIGNUP_PRICE_GUIDE_FIXTURE_MODE === "true" && process.env.VERCEL_ENV !== "production";
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
      priceGuideFixtureEnabled={priceGuideFixtureEnabled}
    />
  );
}
