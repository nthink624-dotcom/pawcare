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
    answer: "네. 저장된 직원을 기준으로 담당자별 예약 열과 필터를 제공하며, 운영 인원에 맞는 플랜을 선택할 수 있습니다.",
  },
  {
    question: "방문 안내 알림톡은 언제 발송되나요?",
    answer: "예약 시점과 방문 시간을 기준으로 내일·오늘·직전 안내 중 가장 적절한 안내 한 번을 자동 발송하는 정책을 사용합니다. 매장과 고객의 알림 설정 및 잔여 건수도 함께 확인합니다.",
  },
  {
    question: "플랜 변경이나 정기결제 취소가 가능한가요?",
    answer: "네. 운영 인원에 맞게 플랜을 다시 선택할 수 있고, 정기결제를 취소하면 현재 이용 기간까지 사용한 뒤 다음 결제일부터 자동 갱신이 중단됩니다.",
  },
  {
    question: "여러 매장을 운영하면 어떻게 하나요?",
    answer: "매장별 이용을 기준으로 등록하며, 복수 매장은 현재 정책에 따라 다점포 할인이 적용될 수 있습니다. 업장 추가는 별도 문의로 안내합니다.",
  },
  {
    question: "티피나 기존 엑셀의 고객 데이터도 옮길 수 있나요?",
    answer: "네. 고객·반려동물·전화번호·메모·방문기록·요금표를 미리 확인한 뒤 이전할 수 있습니다. 전화번호와 반려동물명을 기준으로 중복을 정리하며, 필요하면 이전 대행도 요청할 수 있습니다.",
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
            eyebrow="자주 묻는 질문"
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
            <p className="text-[15px] font-semibold text-[var(--landing-accent)]">다음 예약부터 바로 달라집니다</p>
            <h2 className="mt-3 max-w-[760px] text-[32px] font-semibold leading-[1.2] md:text-[42px]">
              예약을 받을수록, 매장 운영은 더 정리되도록
            </h2>
            <p className="mt-4 max-w-[660px] text-[16px] leading-7 text-[#526071]">
              카드 등록과 설치비 없이 14일 동안 실제 매장 흐름에 맞는지 확인하세요.
            </p>
          </div>
          <Link
            href="/signup"
            className="inline-flex h-13 shrink-0 items-center justify-center gap-2 rounded-[8px] bg-[var(--landing-accent)] px-6 text-[16px] font-semibold text-white transition hover:bg-[var(--landing-accent-hover)]"
          >
            14일 무료로 시작하기
            <ArrowRight className="h-[18px] w-[18px]" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </>
  );
}
