import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "넘친 Day | 오너 관리",
  description: "넘친 Day 오너 관리 화면으로 이동합니다.",
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

  redirect("/owner");
}
