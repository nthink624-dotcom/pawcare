import { redirect } from "next/navigation";

import LandingPage from "@/components/landing/landing-page";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "넘친 Day | 예약이 넘쳐도, 놓치는 손님은 없게",
  description:
    "전화를 못 받아도 예약은 놓치지 않습니다. 예약, 보호자·반려동물 정보, 알림톡, 캘린더를 오너 화면 하나로 정리하는 넘친 Day의 실제 화면과 요금제를 확인하세요.",
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
