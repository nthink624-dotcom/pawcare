import SocialSignupCompleteForm from "@/components/auth/social-signup-complete-form";

function getProviderLabel(provider: string) {
  if (provider === "naver") return "네이버";
  if (provider === "kakao") return "카카오";
  return "구글";
}

export default async function SocialSignupPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const nextPath = typeof params.next === "string" && params.next.startsWith("/") ? params.next : "/owner";
  const provider = typeof params.provider === "string" ? params.provider : "google";

  return <SocialSignupCompleteForm nextPath={nextPath} providerLabel={getProviderLabel(provider)} />;
}
