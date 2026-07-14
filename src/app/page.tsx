import { redirect } from "next/navigation";

import LandingPage from "@/components/landing/landing-page";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "PetManager | 반려동물 미용샵 예약·고객관리 자동화",
  description: "반려동물 미용샵을 위한 예약, 고객관리, 알림톡 자동화 서비스와 월 요금제를 확인하세요.",
};

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const hasOAuthCallbackParams =
    typeof params.code === "string" ||
    typeof params.error === "string" ||
    typeof params.error_code === "string" ||
    typeof params.error_description === "string";

  if (hasOAuthCallbackParams) {
    const callbackParams = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        value.forEach((item) => callbackParams.append(key, item));
      } else if (typeof value === "string") {
        callbackParams.set(key, value);
      }
    }

    if (!callbackParams.has("next")) {
      callbackParams.set("next", "/owner");
    }

    redirect(`/auth/callback?${callbackParams.toString()}` as never);
  }

  return <LandingPage />;
}
