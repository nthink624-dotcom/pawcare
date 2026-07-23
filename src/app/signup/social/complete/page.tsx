import type { Metadata } from "next";

import SocialSignupSuccessScreen from "@/components/auth/social-signup-success-screen";

export const metadata: Metadata = {
  title: "가입 완료 | 펫매니저",
};

export default async function SocialSignupCompletePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const nextPath = typeof params.next === "string" && params.next.startsWith("/") ? params.next : "/owner";

  return <SocialSignupSuccessScreen nextPath={nextPath} />;
}
