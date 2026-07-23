import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  ChevronDown,
  CreditCard,
  MonitorSmartphone,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

import { SectionHeading } from "@/components/landing/landing-ui";
import { billableOwnerPlans } from "@/lib/billing/owner-plans";
import { LEGAL_BUSINESS_INFO } from "@/lib/legal/legal-info";
import { won } from "@/lib/utils";

const MINIMUM_WAGE_2026 = 10_320;
const MONTHLY_SAVED_HOURS = 15;
const MONTHLY_SAVED_WON = MINIMUM_WAGE_2026 * MONTHLY_SAVED_HOURS;

const trustItems = [
  { icon: MonitorSmartphone, title: "실제 제품 화면", body: "랜딩의 제품 이미지는 운영 중인 PC와 고객 예약 화면으로 구성합니다." },
  { icon: BadgeCheck, title: "14일 무료체험", body: "결제 전에 실제 매장 흐름에 맞는지 충분히 확인할 수 있습니다." },
  { icon: CreditCard, title: "카드 등록 없이 시작", body: "체험 시작 단계에서는 결제 카드를 먼저 등록하지 않습니다." },
  { icon: ShieldCheck, title: "직접 취소 가능", body: "유료 이용 중에는 플랜 화면에서 다음 정기결제를 취소할 수 있습니다." },
] as const;

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
] as const;

export function SavingsSection() {
  return (
    <section id="savings" className="scroll-mt-20 bg-white py-18 md:py-24">
      <div className="mx-auto grid w-full max-w-[1180px] gap-12 px-5 lg:grid-cols-[0.88fr_1.12fr] lg:items-end">
        <SectionHeading
          eyebrow="시간의 가치"
          title="하루 30분을 되찾으면, 한 달에 15시간입니다"
          description="전화 확인, 반복 입력, 안내 메시지에 쓰던 시간을 줄여 미용과 고객 응대에 다시 사용할 수 있습니다."
        />

        <div className="border-y border-[#dbe2ea] py-7">
          <div className="grid grid-cols-3 divide-x divide-[#dbe2ea]">
            <div className="px-3 first:pl-0 md:px-6">
              <p className="text-[12px] font-medium text-[#64748b] md:text-[13px]">하루</p>
              <p className="mt-2 text-[27px] font-semibold text-[#334155] md:text-[38px]">30분</p>
            </div>
            <div className="px-3 md:px-6">
              <p className="text-[12px] font-medium text-[#64748b] md:text-[13px]">한 달</p>
              <p className="mt-2 text-[27px] font-semibold text-[#1f6b5b] md:text-[38px]">15시간</p>
            </div>
            <div className="px-3 pr-0 md:px-6 md:pr-0">
              <p className="text-[12px] font-medium text-[#64748b] md:text-[13px]">시간 가치</p>
              <p className="mt-2 text-[27px] font-semibold text-[#a06a21] md:text-[38px]">{won(MONTHLY_SAVED_WON)}</p>
            </div>
          </div>
          <p className="mt-6 text-[13px] leading-6 text-[#64748b]">
            0.5시간 × 30일 × 2026년 최저시급 {MINIMUM_WAGE_2026.toLocaleString("ko-KR")}원 기준의 업무시간 가치 환산 예시입니다. 실제 절감액을 보장하는 수치는 아닙니다.
          </p>
        </div>
      </div>
    </section>
  );
}

export function TrustSection() {
  return (
    <section className="border-y border-[#dce6e0] bg-[#f4f8f6] py-16 md:py-20">
      <div className="mx-auto w-full max-w-[1180px] px-5">
        <SectionHeading
          eyebrow="부담 없이 확인"
          title="먼저 써보고, 우리 매장에 맞는지 결정하세요"
          description="과장된 사용 수치나 만들어 낸 후기를 앞세우지 않습니다. 실제 제품과 시작·결제 조건을 투명하게 보여드립니다."
        />

        <div className="mt-10 grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
          {trustItems.map(({ icon: Icon, title, body }) => (
            <div key={title} className="border-t border-[#bfcfc6] pt-4">
              <Icon className="h-5 w-5 text-[#1f6b5b]" aria-hidden="true" />
              <h3 className="mt-4 text-[17px] font-semibold text-[#111827]">{title}</h3>
              <p className="mt-2 text-[14px] leading-6 text-[#64748b]">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PricingSection() {
  return (
    <section id="pricing" className="scroll-mt-20 bg-[#f5f7f9] py-18 md:py-24">
      <div className="mx-auto w-full max-w-[1180px] px-5">
        <SectionHeading
          eyebrow="요금제"
          title="운영 인원에 맞는 플랜만 고르세요"
          description="예약, 고객관리, 예약 스케줄과 기본 운영 기능은 공통으로 사용하고, 운영 인원과 포함 알림톡에 맞춰 선택합니다."
        />

        <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 border-y border-[#dbe2ea] py-3 text-[13px] font-medium text-[#526071]">
          {["간편 예약", "고객 DB", "예약 스케줄", "알림 설정", "직원 관리"].map((item) => (
            <span key={item} className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-[#1f9d55]" aria-hidden="true" />
              {item}
            </span>
          ))}
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {billableOwnerPlans.map((plan) => (
            <article
              key={plan.code}
              itemScope
              itemType="https://schema.org/Product"
              className="flex min-w-0 flex-col rounded-[8px] border border-[#d5dde6] bg-white p-6"
            >
              <meta itemProp="category" content="반려동물 미용샵 운영 SaaS" />
              <h3 itemProp="name" className="text-[23px] font-semibold text-[#111827]">{plan.title}</h3>
              <p itemProp="description" className="mt-2 min-h-12 text-[13px] leading-6 text-[#64748b]">{plan.targetLabel}</p>

              <div className="mt-5 border-y border-[#e7edf3] py-5" itemProp="offers" itemScope itemType="https://schema.org/Offer">
                <meta itemProp="priceCurrency" content="KRW" />
                <meta itemProp="price" content={String(plan.monthlyPrice)} />
                <meta itemProp="availability" content="https://schema.org/InStock" />
                <p className="text-[34px] font-semibold text-[#111827]">
                  {won(plan.monthlyPrice)}
                  <span className="ml-1 text-[13px] font-medium text-[#64748b]">/ 월 정기결제</span>
                </p>
              </div>

              <dl className="mt-4 space-y-3 text-[14px]">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[#64748b]">운영 기준</dt>
                  <dd className="text-right font-medium text-[#334155]">{plan.staffLimitLabel}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[#64748b]">포함 알림톡</dt>
                  <dd className="text-right font-medium text-[#334155]">{plan.alimtalkIncludedLabel}</dd>
                </div>
              </dl>
              <p className="mt-4 text-[12px] leading-5 text-[#7c8796]">{plan.excessAlimtalkLabel}</p>

              <Link
                href="/signup"
                className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-[8px] border border-[#334155] bg-[#334155] text-[15px] font-semibold text-white transition hover:bg-[#1e293b]"
              >
                이 플랜으로 14일 시작
              </Link>
            </article>
          ))}
        </div>

        <div className="mt-6 flex items-start gap-3 border-l-[3px] border-[#64748b] bg-white px-4 py-3.5">
          <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-[#64748b]" aria-hidden="true" />
          <p className="text-[13px] leading-6 text-[#526071]">
            여러 매장을 함께 운영하는 경우 매장별 이용 기준으로 안내하며, 등록된 매장 수와 운영 조건에 따라 다점포 할인이 적용될 수 있습니다.
          </p>
        </div>

        <div className="mt-4 grid gap-3 border-y border-[#dbe2ea] py-4 text-[13px] leading-6 text-[#526071] md:grid-cols-2">
          <p>
            가입과 로그인 후 매장에 맞는 플랜을 선택하고 결제를 진행합니다. 체험 시작에는 카드 등록이나 결제가 필요하지 않습니다.
          </p>
          <p className="md:border-l md:border-[#dbe2ea] md:pl-5">
            월 정기결제, 해지 및 환불 기준은 <Link href="/refund" className="font-semibold text-[#334155] underline underline-offset-4">환불 및 이용 안내</Link>에서 확인할 수 있습니다. 결제대행사는 {LEGAL_BUSINESS_INFO.paymentProvider}입니다.
          </p>
        </div>
      </div>
    </section>
  );
}

export function FaqAndFinalCtaSection() {
  return (
    <>
      <section id="faq" className="bg-white py-18 md:py-24">
        <div className="mx-auto grid w-full max-w-[1180px] gap-10 px-5 lg:grid-cols-[0.68fr_1.32fr]">
          <SectionHeading
            eyebrow="자주 묻는 질문"
            title="시작 전에 궁금한 내용을 확인하세요"
            description="실제 제품 정책과 이용 흐름을 기준으로 답변합니다."
          />

          <div className="border-t border-[#cfd8e3]">
            {faqItems.map((item) => (
              <details key={item.question} className="group border-b border-[#cfd8e3] py-1">
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-3 text-[16px] font-medium text-[#111827] marker:content-none">
                  {item.question}
                  <ChevronDown className="h-5 w-5 shrink-0 text-[#64748b] transition group-open:rotate-180" aria-hidden="true" />
                </summary>
                <p className="max-w-[720px] pb-5 pr-9 text-[14px] leading-7 text-[#64748b]">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#111827] py-16 text-white md:py-20">
        <div className="mx-auto flex w-full max-w-[1180px] flex-col justify-between gap-8 px-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-[14px] font-semibold text-[#86efac]">다음 예약부터 바로 달라집니다</p>
            <h2 className="mt-3 max-w-[760px] text-[34px] font-semibold leading-[1.2] md:text-[48px]">
              예약받는 일이 고객관리까지 이어지도록
            </h2>
            <p className="mt-4 max-w-[660px] text-[16px] leading-7 text-white/68">
              카드 등록 없이 14일 동안 실제 매장 흐름에 맞는지 확인하세요.
            </p>
          </div>
          <Link
            href="/signup"
            className="inline-flex h-13 shrink-0 items-center justify-center gap-2 rounded-[8px] bg-white px-6 text-[16px] font-semibold text-[#111827] transition hover:bg-[#f1f5f9]"
          >
            14일 무료로 시작하기
            <ArrowRight className="h-[18px] w-[18px]" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </>
  );
}
