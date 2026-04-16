import type { Metadata } from "next";

import SocialSignupCompleteForm from "@/components/auth/social-signup-complete-form";
import type { SocialProvider } from "@/lib/auth/social-auth";

export const metadata: Metadata = {
  title: "기본정보 입력 | 펫매니저",
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

  return <SocialSignupCompleteForm nextPath={nextPath} provider={provider} />;
}
