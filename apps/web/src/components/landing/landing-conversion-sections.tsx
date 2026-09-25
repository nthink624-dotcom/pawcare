import { ArrowRight, ChevronDown } from "lucide-react";
import Link from "next/link";

import { SectionHeading } from "@/components/landing/landing-ui";

const faqItems = [
  {
    question: "고객도 앱을 설치해야 하나요?",
    answer: "아니요. 고객은 매장에서 공유한 예약 링크를 열어 별도 앱 설치 없이 예약을 진행할 수 있습니다.",
  },
  {
    question: "보호자와 반려동물 정보는 어떻게 저장되나요?",
    answer: "고객이 예약할 때 입력한 보호자명, 연락처, 반려동물 정보가 예약과 연결되고 오너 고객관리 화면에서 같은 정보를 확인할 수 있습니다.",
  },
  {
    question: "직원별 예약을 나누어 볼 수 있나요?",
    answer: "네. 저장된 직원을 기준으로 담당자별 예약 열과 필터를 제공합니다.",
  },
  {
    question: "방문 안내 알림톡은 언제 발송되나요?",
    answer: "예약 시점과 방문 시간을 기준으로 내일·오늘·직전 안내 중 가장 적절한 안내 한 번을 발송합니다. 매장과 고객의 알림 설정 및 발송 가능 상태를 함께 확인합니다.",
  },
  {
    question: "정기결제는 어떻게 되나요?",
    answer: "14일 무료체험이 끝나도 자동으로 결제되지 않습니다. 계속 이용할 때만 카드를 등록해 월 29,000원(VAT 포함) 정기결제를 시작하며, 다음 결제부터 해지하면 현재 이용 기간까지 사용한 뒤 자동 결제가 중단됩니다.",
  },
  {
    question: "여러 매장이나 직원이 많아도 이용할 수 있나요?",
    answer: "구독 1개는 매장 1곳 기준이며 직원 수 제한은 없습니다. 여러 매장을 운영하면 매장별로 별도 구독이 필요합니다.",
  },
  {
    question: "파일럿 신규 매장 혜택은 어떻게 적용되나요?",
    answer: "파일럿 참여가 확인된 신규 매장은 일반 14일 대신 최초 시작일부터 총 30일을 무료로 이용합니다. 검증되어 보상 대상으로 인정된 피드백·문제는 운영자가 사유와 일수를 기록해 건당 3일 이상 연장할 수 있으며, 첫 결제 전 총 무료 이용은 최초 시작일부터 최대 60일입니다.",
  },
  {
    question: "보호자 예약 화면에 광고가 나오나요?",
    answer: "아니요. 보호자가 보는 예약과 미용결과 화면에는 제3자 광고를 넣지 않습니다.",
  },
] as const;

export function FaqAndFinalCtaSection() {
  return (
    <>
      <section id="faq" className="border-t border-[#e2e8f0] bg-[#f7f8fa] py-14 md:py-16">
        <div className="mx-auto grid w-full max-w-[1180px] gap-10 px-5 lg:grid-cols-[0.68fr_1.32fr]">
          <SectionHeading
            eyebrow="QNA"
            title="시작 전에 궁금한 내용을 확인하세요"
            description="실제 제품 정책과 이용 흐름을 기준으로 답변합니다."
          />

          <div className="rounded-[8px] border border-[#d8e0e9] bg-white px-5 sm:px-7">
            {faqItems.map((item) => (
              <details key={item.question} className="group border-b border-[#d8e0e9] py-1 last:border-b-0">
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-3 text-[16px] font-medium text-[#111827] marker:content-none">
                  {item.question}
                  <ChevronDown className="h-5 w-5 shrink-0 text-[#64748b] transition group-open:rotate-180" aria-hidden="true" />
                </summary>
                <p className="max-w-[720px] pb-5 pr-9 text-[15px] leading-7 text-[#64748b]">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#d8e0e9] bg-[#eef1f5] py-12 text-[#111827] md:py-14">
        <div className="mx-auto flex w-full max-w-[1180px] flex-col justify-between gap-8 px-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-[15px] font-semibold text-[var(--landing-accent)]">PETMANAGER</p>
            <h2 className="mt-3 max-w-[760px] text-[32px] font-semibold leading-[1.2] md:text-[42px]">
              예약은 쉽게 받고,<br />운영은 더 편하게.
            </h2>
            <p className="mt-4 max-w-[660px] text-[16px] leading-7 text-[#526071]">
              예약부터 재방문, 일정 관리, 고객 안내까지—펫매니저가 매장의 반복 업무를 한곳에서 정리합니다.
            </p>
          </div>
          <Link
            href="/signup"
            className="inline-flex h-13 shrink-0 items-center justify-center gap-2 rounded-[8px] bg-[var(--landing-accent)] px-6 text-[16px] font-semibold text-white transition hover:bg-[var(--landing-accent-hover)]"
          >
            우리 매장에 적용해 보기
            <ArrowRight className="h-[18px] w-[18px]" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </>
  );
}
