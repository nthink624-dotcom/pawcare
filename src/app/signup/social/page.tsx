import type { Metadata } from "next";
import { redirect } from "next/navigation";

import SocialSignupCompleteForm from "@/components/auth/social-signup-complete-form";
import type { SocialProvider } from "@/lib/auth/social-auth";
import { getServerSessionUser, getServerUserShopId } from "@/lib/auth/server-session";

export const metadata: Metadata = {
  title: "프로필 등록하기 | 펫매니저",
};

function resolveProvider(provider: string | string[] | undefined): SocialProvider | undefined {
  if (provider === "google" || provider === "kakao" || provider === "naver") {
    return provider;
  }

  return undefined;
}

export default async function SocialSignupPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const nextPath = typeof params.next === "string" && params.next.startsWith("/") ? params.next : "/owner";
  const provider = resolveProvider(params.provider);
  const user = await getServerSessionUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}` as never);
  }

  const existingShopId = await getServerUserShopId(user.id);

  if (existingShopId) {
    redirect(nextPath as never);
  }

  return <SocialSignupCompleteForm nextPath={nextPath} provider={provider} />;
}
