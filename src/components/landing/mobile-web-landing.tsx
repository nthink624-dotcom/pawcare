import Image from "next/image";

import { ServiceBrand } from "@/components/brand/service-brand";
import { PETMANAGER_SERVICE_DESCRIPTION } from "@/lib/brand";

const onboardingSteps = ["무료체험 시작하기", "가입 정보 입력", "로그인 후 관리 시작"] as const;

const benefits = ["예약 관리", "고객 관리", "서비스·요금 관리"] as const;

const focusClassName =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]";

export default function MobileWebLanding() {
  return (
    <main className="min-h-screen bg-white text-[#101a31]">
      <div className="mx-auto w-full max-w-[720px] px-4 py-5 sm:px-6 sm:py-7">
        <header className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 max-[220px]:-mx-3 max-[220px]:justify-start">
          <ServiceBrand size="large" />
          <a
            href="/login?next=/owner/mobile"
            className={`inline-flex min-h-11 shrink-0 items-center justify-center rounded-[10px] px-3 text-[14px] font-medium text-[#15213b] max-[220px]:w-full max-[220px]:basis-full ${focusClassName}`}
          >
            로그인
          </a>
        </header>

        <section className="pt-14 sm:pt-20" aria-labelledby="landing-title">
          <h1 id="landing-title" className="max-w-[560px] text-[28px] font-semibold leading-9 tracking-[-0.02em] text-[#101a31] sm:text-[32px] sm:leading-10">
            반려동물 미용샵의 예약과 고객 관리
          </h1>
          <p className="mt-3 max-w-[560px] text-[16px] leading-6 text-[#52627a]">{PETMANAGER_SERVICE_DESCRIPTION}</p>
          <a
            href="/signup?next=/owner/mobile"
            className={`mt-7 inline-flex min-h-14 w-full items-center justify-center rounded-[14px] bg-[#111a30] px-5 text-[16px] font-medium leading-6 text-white ${focusClassName}`}
          >
            무료체험 시작하기
          </a>
          <div className="mt-8 overflow-hidden rounded-[18px] border border-[#e8edf3] bg-[#f7f8fa]">
            <Image
              src="/images/demo/grooming-salon-hero.png"
              alt="반려동물 미용샵 관리 공간을 표현한 일러스트"
              width={1200}
              height={800}
              priority
              sizes="(max-width: 720px) calc(100vw - 32px), 672px"
              className="h-auto w-full"
            />
          </div>
        </section>

        <section className="mt-14 border-t border-[#e8edf3] pt-8 sm:mt-16" aria-labelledby="benefits-title">
          <h2 id="benefits-title" className="text-[20px] font-semibold leading-7 tracking-[-0.015em] text-[#101a31]">
            매장 관리에 필요한 기능
          </h2>
          <ul className="mt-4 divide-y divide-[#e8edf3] border-y border-[#e8edf3]">
            {benefits.map((benefit) => (
              <li key={benefit} className="py-4 text-[16px] font-medium leading-6 text-[#24324a]">
                {benefit}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14 border-t border-[#e8edf3] pt-8 sm:mt-16" aria-labelledby="steps-title">
          <h2 id="steps-title" className="text-[20px] font-semibold leading-7 tracking-[-0.015em] text-[#101a31]">
            시작하는 방법
          </h2>
          <ol className="mt-4 space-y-3">
            {onboardingSteps.map((step, index) => (
              <li key={step} className="flex min-w-0 items-start gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#f1f4f8] text-[13px] font-medium leading-5 text-[#24324a]" aria-hidden="true">
                  {index + 1}
                </span>
                <span className="pt-0.5 text-[16px] leading-6 text-[#24324a]">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <footer className="mt-14 border-t border-[#e8edf3] pt-6 sm:mt-16">
          <nav className="flex flex-wrap gap-x-4 gap-y-1" aria-label="약관 및 사업자 정보">
            <a href="/terms" className={`inline-flex min-h-11 items-center text-[14px] text-[#52627a] underline underline-offset-4 ${focusClassName}`}>
              이용약관
            </a>
            <a href="/privacy" className={`inline-flex min-h-11 items-center text-[14px] text-[#52627a] underline underline-offset-4 ${focusClassName}`}>
              개인정보처리방침
            </a>
            <a href="/business" className={`inline-flex min-h-11 items-center text-[14px] text-[#52627a] underline underline-offset-4 ${focusClassName}`}>
              사업자 정보
            </a>
          </nav>
          <a
            href="/signup?next=/owner/mobile"
            className={`mt-8 inline-flex min-h-14 w-full items-center justify-center rounded-[14px] border border-[#111a30] px-5 text-[16px] font-medium leading-6 text-[#111a30] ${focusClassName}`}
          >
            무료체험 시작하기
          </a>
        </footer>
      </div>
    </main>
  );
}
