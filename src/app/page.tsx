import { redirect } from "next/navigation";

import LandingPage from "@/components/landing/landing-page";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "넘친 day | 매출도 여유도 넘치는 하루",
  description: "반려동물 미용샵 예약 요청, 승인, 알림톡, 재방문 관리를 한 곳에서 정리하는 예약관리 서비스입니다.",
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
