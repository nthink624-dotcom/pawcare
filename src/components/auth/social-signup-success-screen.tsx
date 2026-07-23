import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { cn, PAGE_FRAME } from "@/lib/ui-system";

export default function SocialSignupSuccessScreen({ nextPath = "/owner" }: { nextPath?: string }) {
  return (
    <main className="min-h-screen bg-white px-6 py-7 text-[#111827]">
      <section className={cn(PAGE_FRAME, "flex min-h-[calc(100vh-56px)] flex-col bg-white pb-8 pt-7")}>
        <p className="text-center text-[16px] font-medium text-[#6b7280]">펫매니저</p>
        <div className="flex flex-1 flex-col items-center justify-center pb-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#eef2f5] text-[#111827]">
            <Check className="h-7 w-7" strokeWidth={2.25} aria-hidden="true" />
          </span>
          <h1 className="mt-6 text-[28px] font-semibold leading-tight text-[#111827]">가입이 완료됐어요</h1>
          <p className="mt-3 text-[16px] leading-7 text-[#64748b]">매장 정보가 저장됐습니다.</p>
        </div>
        <Link
          href={nextPath as never}
          className="flex h-[58px] w-full items-center justify-center rounded-[12px] bg-[#111827] px-5 text-[18px] font-semibold text-white transition hover:bg-[#1f2937]"
        >
          예약 관리 시작하기
          <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
        </Link>
      </section>
    </main>
  );
}
