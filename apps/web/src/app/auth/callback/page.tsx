import type { Metadata } from "next";

import SocialLoginCallback from "@/components/auth/social-login-callback";
import { getSocialProvider } from "@/lib/auth/social-account-link";
import { getSocialLoginReturnPath } from "@/lib/auth/social-login";

export const metadata: Metadata = { title: "로그인 확인", referrer: "no-referrer", robots: { index: false, follow: false } };

export default async function SocialLoginCallbackPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return <SocialLoginCallback code={typeof params.code === "string" ? params.code : undefined} providerError={typeof params.error === "string" ? params.error : undefined} providerErrorCode={typeof params.error_code === "string" ? params.error_code : undefined} nextPath={getSocialLoginReturnPath(typeof params.next === "string" ? params.next : undefined)} intent={params.intent === "link" ? "link" : undefined} provider={getSocialProvider(params.provider)} />;
}
