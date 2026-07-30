import { LoaderCircle } from "lucide-react";

import PetManagerBrand from "@/components/brand/petmanager-brand";

export default function SocialAuthProgress({ message = "소셜 로그인 연결을 마무리하고 있습니다." }: { message?: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 text-center text-[#111827]">
      <section className="w-full max-w-[360px]">
        <PetManagerBrand
          priority
          className="justify-center"
          imageClassName="h-[18px] w-auto"
          nameClassName="text-[15px] text-[#111827]"
        />
        <div className="mt-8 flex justify-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f4f5f7] text-[#111827]">
            <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
          </span>
        </div>
        <p className="mt-5 text-[17px] font-medium leading-7 text-[#1f2937]">{message}</p>
        <p className="mt-2 text-[14px] leading-6 text-[#6b7280]">잠시만 기다려 주세요.</p>
      </section>
    </main>
  );
}
