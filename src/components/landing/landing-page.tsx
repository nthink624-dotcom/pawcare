"use client";

import LegalLinksFooter from "@/components/legal/legal-links-footer";
import { ownerPlans, type OwnerPlanCode } from "@/lib/billing/owner-plans";
import type { Service, Shop } from "@/types/domain";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

const SURFACE =
  "rounded-[28px] border border-[#ddd6ca] bg-white shadow-[0_12px_30px_rgba(24,33,31,0.05)]";
const CARD_TITLE = "text-[15px] font-bold leading-[1.4] tracking-[-0.02em] text-[#18211f]";
const BODY = "text-[14px] leading-6 text-[#625d56]";
const PRIMARY_BUTTON =
  "flex h-[54px] items-center justify-center rounded-[18px] bg-[#f3a77f] px-4 text-[16px] font-semibold text-[#1c2320]";
const SECONDARY_BUTTON =
  "flex h-[54px] items-center justify-center rounded-[18px] border border-white/18 bg-white/8 px-4 text-[16px] font-semibold text-white";
const TERTIARY_BUTTON =
  "flex h-[54px] items-center justify-center rounded-[18px] border border-[#d6d0c5] bg-white px-4 text-[16px] font-semibold text-[#1f5b51]";

const heroMetrics = [
  { label: "한곳에 관리", value: "모든 예약" },
  { label: "매출로 연결", value: "재방문 관리" },
  { label: "더 편하게", value: "고객 예약" },
] as const;

function formatWon(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

export default function LandingPage({ shop }: { shop: Shop; services: Service[] }) {
  const [planModalOpen, setPlanModalOpen] = useState(false);

  return (
    <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#f4efe7] text-[#18211f]">
      <section className="px-5 pb-10 pt-5">
        <HeroSection shopId={shop.id} onOpenPlans={() => setPlanModalOpen(true)} />

        <section className={`${SURFACE} mt-6 p-4`}>
          <div className="space-y-6">
            <IntegratedPreview
              title="예약 현황을 한눈에 보는 홈 화면"
              body="오늘 예약 흐름을 빠르게 확인합니다."
            >
              <OwnerHomeMock />
            </IntegratedPreview>

            <IntegratedPreview
              title="고객과 반려동물 정보를 한 흐름으로 관리하는 화면"
              body="방문 기록부터 재방문 안내까지 이어집니다."
            >
              <OwnerCustomerMock />
            </IntegratedPreview>

            <IntegratedPreview
              title="고객이 첫 방문과 재방문을 쉽게 고르는 모바일 화면"
              body="예약 시작이 더 간단해져 망설임 없이 이어집니다."
            >
              <ConsumerBookingMock />
            </IntegratedPreview>
          </div>
        </section>
      </section>

      <div className="px-5 pb-10">
        <LegalLinksFooter />
      </div>

      <PlanModal open={planModalOpen} onClose={() => setPlanModalOpen(false)} />
    </div>
  );
}

function HeroSection({ shopId, onOpenPlans }: { shopId: string; onOpenPlans: () => void }) {
  return (
    <section className="rounded-[32px] bg-[#1f5b51] px-5 pb-5 pt-5 text-white shadow-[0_18px_38px_rgba(24,33,31,0.12)]">
      <h1 className="text-[32px] font-extrabold leading-[1.1] tracking-[-0.05em] text-white">
        모든 예약은 한곳에,
        <br />
        고객 관리는 매출로
      </h1>
      <p className="mt-4 text-[15px] leading-6 text-white/80">
        업무는 더 빠르게, 고객 예약은 더 편하게.
        <br />
        재방문까지 자연스럽게 이어집니다.
      </p>

      <div className="mt-5 grid grid-cols-3 gap-2.5">
        {heroMetrics.map((metric) => (
          <MetricCard key={metric.label} label={metric.label} value={metric.value} />
        ))}
      </div>

      <div className="mt-5 grid gap-2.5">
        <a href="/owner/demo" className={PRIMARY_BUTTON}>
          오너 화면 확인하기
        </a>
        <a href={`/entry/${shopId}`} className={SECONDARY_BUTTON}>
          소비자 예약 화면 보기
        </a>
                <a href="/signup?next=%2Fowner" className={TERTIARY_BUTTON}>
          무료체험 시작하기
        </a>
      </div>
    </section>
  );
}

function IntegratedPreview({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <div className="pt-1">
      <h3 className={CARD_TITLE}>{title}</h3>
      <p className={`mt-1.5 ${BODY}`}>{body}</p>
      <div className="mt-4 overflow-hidden">{children}</div>
    </div>
  );
}

function PlanModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const featuredPlan = ownerPlans.find((plan) => plan.featured) ?? ownerPlans[ownerPlans.length - 1];
  const otherPlans = ownerPlans.filter((plan) => plan.code !== featuredPlan.code);
  const [selectedPlanCode, setSelectedPlanCode] = useState<OwnerPlanCode>(featuredPlan.code);
  const selectedPlan = useMemo(
    () => ownerPlans.find((plan) => plan.code === selectedPlanCode) ?? featuredPlan,
    [featuredPlan, selectedPlanCode],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/45 px-4 pb-4 pt-10" onClick={onClose}>
      <div
        className="mx-auto flex max-h-[calc(100vh-32px)] w-full max-w-[430px] flex-col overflow-hidden rounded-[30px] bg-[#fffdf8] shadow-[0_24px_60px_rgba(17,17,17,0.22)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 pb-4 pt-5">
          <div>
            <p className="text-[12px] font-semibold tracking-[0.08em] text-[#6f665d]">모든 플랜 보기</p>
            <h2 className="mt-2 text-[28px] font-extrabold tracking-[-0.04em] text-[#18211f]">월 금액 중심으로 플랜을 비교해 보세요</h2>
            <p className="mt-2 text-[14px] leading-6 text-[#625d56]">1개월은 일반결제, 3개월 이상은 약정 기간 동안 매달 결제됩니다.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#ddd5c8] bg-white text-[#1f5b51]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5">
          <button
            type="button"
            onClick={() => setSelectedPlanCode(featuredPlan.code)}
            className={`relative mt-3 w-full overflow-visible rounded-[22px] border bg-white px-4 py-4 text-left transition ${
              selectedPlanCode === featuredPlan.code
                ? "border-[#1f5b51] bg-[#f4faf7] shadow-[0_12px_28px_rgba(11,77,63,0.08)]"
                : "border-[#ddd6ca]"
            }`}
          >
            <span className="absolute -top-[12px] right-4 rounded-[10px] bg-[#1f5b51] px-2.5 py-1 text-[10px] font-semibold tracking-[0.01em] text-white shadow-[0_6px_16px_rgba(31,91,81,0.22)]">
              {featuredPlan.badge ?? `약 ${featuredPlan.discountPercent}% 할인`}
            </span>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-[22px] font-extrabold tracking-[-0.03em] text-[#18211f]">{featuredPlan.title}</p>
                <p className="mt-2 text-[14px] leading-6 text-[#6a6259]">{featuredPlan.billingLabel}</p>
                {featuredPlan.dailyPriceText ? (
                  <p className="mt-2 text-[13px] font-semibold text-[#1f5b51]">{featuredPlan.dailyPriceText}</p>
                ) : null}
                <p className="mt-3 text-[12px] font-medium text-[#827b72]">{featuredPlan.totalLabel}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[31px] font-extrabold tracking-[-0.05em] text-[#18211f]">월 {formatWon(featuredPlan.monthlyPrice)}</p>
                <p className="mt-1 text-[12px] font-medium text-[#1f5b51]">{featuredPlan.shortTitle}</p>
              </div>
            </div>
          </button>

          <div className="mt-6 space-y-4">
            {otherPlans.map((plan) => {
              const selected = selectedPlanCode === plan.code;

              return (
                <button
                  key={plan.code}
                  type="button"
                  onClick={() => setSelectedPlanCode(plan.code)}
                  className={`relative ${plan.discountPercent > 0 ? "mt-3" : ""} w-full overflow-visible rounded-[24px] border bg-white px-5 py-4 text-left transition ${
                    selected
                      ? "border-[#1f5b51] bg-[#f4faf7] shadow-[0_10px_24px_rgba(11,77,63,0.06)]"
                      : "border-[#ddd6ca]"
                  }`}
                >
                  {plan.discountPercent > 0 ? (
                    <span className="absolute -top-[12px] right-4 rounded-[10px] bg-[#1f5b51] px-2.5 py-1 text-[10px] font-semibold tracking-[0.01em] text-white shadow-[0_6px_14px_rgba(31,91,81,0.22)]">
                      약 {plan.discountPercent}% 할인
                    </span>
                  ) : null}
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-[20px] font-extrabold tracking-[-0.03em] text-[#18211f]">{plan.title}</p>
                      <p className="mt-2 text-[13px] leading-6 text-[#6a6259]">{plan.billingLabel}</p>
                      {plan.dailyPriceText ? (
                        <p className="mt-1 text-[12px] font-medium text-[#1f5b51]">{plan.dailyPriceText}</p>
                      ) : null}
                      <p className="mt-2.5 text-[12px] font-medium text-[#827b72]">{plan.totalLabel ?? "일반결제"}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[24px] font-extrabold tracking-[-0.04em] text-[#18211f]">월 {formatWon(plan.monthlyPrice)}</p>
                      <p className="mt-1 text-[12px] font-medium text-[#1f5b51]">{plan.shortTitle}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-[#ece4d8] px-5 py-4">
          <a
            href={`/owner/billing?plan=${selectedPlan.code}`}
            className="flex h-[54px] w-full items-center justify-center rounded-[18px] bg-[#1f5b51] px-4 text-[16px] font-semibold text-white"
          >
            선택한 플랜으로 계속하기
          </a>
        </div>
      </div>
    </div>
  );
}

function OwnerHomeMock() {
  return (
    <div className="rounded-[18px] border border-[#e2ddd5] bg-white p-4 shadow-[0_10px_18px_rgba(24,33,31,0.05)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[18px] font-extrabold tracking-[-0.03em] text-[#18211f]">홈</p>
        </div>
        <div className="rounded-[14px] bg-[#1e5d51] px-4 py-2 text-[12px] font-semibold text-white">예약 추가</div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <MiniStat title="승인 대기" value="3건" tone="warning" />
        <MiniStat title="예약 현황" value="6건" tone="accent" />
        <MiniStat title="완료 내역" value="8건" tone="neutral" />
        <MiniStat title="취소·변경" value="1건" tone="danger" />
      </div>
    </div>
  );
}

function OwnerCustomerMock() {
  return (
    <div className="rounded-[18px] border border-[#e2ddd5] bg-white p-4 shadow-[0_10px_18px_rgba(24,33,31,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[18px] font-extrabold tracking-[-0.03em] text-[#18211f]">고객 관리</p>
          <p className="mt-1 text-[12px] leading-5 text-[#716960]">고객정보와 반려동물 정보를 한 흐름으로 봅니다</p>
        </div>
        <span className="text-[12px] font-semibold text-[#1e5d51]">편집</span>
      </div>
      <div className="mt-4 space-y-3">
        <div className="rounded-[16px] border border-[#e8e0d4] bg-[#fcfaf7] px-4 py-3.5">
          <p className="text-[20px] font-extrabold tracking-[-0.03em] text-[#18211f]">김민지 보호자</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-[16px] border border-[#e8e0d4] bg-[#fcfaf7] px-4 py-3">
            <p className="text-[12px] font-medium leading-4 text-[#7a7268]">보호자명</p>
            <p className="mt-1.5 text-[17px] font-semibold leading-5 tracking-[-0.02em] text-[#18211f]">김민지</p>
          </div>
          <div className="rounded-[16px] border border-[#e8e0d4] bg-[#fcfaf7] px-4 py-3">
            <p className="text-[12px] font-medium leading-4 text-[#7a7268]">연락처</p>
            <p className="mt-1.5 text-[17px] font-semibold leading-5 tracking-[-0.02em] text-[#18211f]">010-1234-5678</p>
          </div>
        </div>
        <div className="rounded-[16px] border border-[#e8e0d4] bg-[#fcfaf7] px-4 py-3">
          <p className="text-[12px] font-medium leading-4 text-[#7a7268]">반려동물 이름</p>
          <p className="mt-1.5 text-[17px] font-semibold leading-5 tracking-[-0.02em] text-[#18211f]">몽이, 차이</p>
        </div>
        <div className="rounded-[16px] border border-[#e8e0d4] bg-[#fcfaf7] px-4 py-3">
          <p className="text-[12px] font-medium leading-4 text-[#7a7268]">고객 메모</p>
          <p className="mt-1.5 text-[17px] font-semibold leading-6 tracking-[-0.02em] text-[#18211f]">문 앞 픽업 선호</p>
        </div>
        <div className="rounded-[16px] border border-[#e8e0d4] bg-[#fcfaf7] px-4 py-3">
          <p className="text-sm font-bold text-[#18211f]">빠른 액션</p>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <div className="flex items-center justify-center rounded-[14px] border border-[#e2ddd5] bg-white px-4 py-3 text-sm font-semibold text-[#18211f]">
              전화하기
            </div>
            <div className="flex items-center justify-center rounded-[14px] border border-[#e2ddd5] bg-white px-4 py-3 text-sm font-semibold text-[#6d665d]">
              문자 보내기
            </div>
          </div>
        </div>
        <div className="mt-1 flex gap-2">
          <div className="flex-1 rounded-[14px] border border-[#1e5d51] bg-[#1e5d51] px-3 py-2.5 text-center text-xs font-semibold text-white">
            반려동물
          </div>
          <div className="flex-1 rounded-[14px] border border-[#e2ddd5] bg-white px-3 py-2.5 text-center text-xs font-semibold text-[#7a7268]">
            기록
          </div>
          <div className="flex-1 rounded-[14px] border border-[#e2ddd5] bg-white px-3 py-2.5 text-center text-xs font-semibold text-[#7a7268]">
            예약
          </div>
        </div>
        <div className="rounded-[16px] border border-[#e8e0d4] bg-[#fcfaf7] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-[#18211f]">아기 정보</p>
            <span className="text-[12px] font-semibold text-[#1e5d51]">+ 아기 추가하기</span>
          </div>
          <div className="mt-3 rounded-[14px] border border-[#e2ddd5] bg-white px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#18211f]">몽이</p>
                <p className="mt-1 text-xs text-[#7a7268]">말티즈 · 생일 미등록</p>
              </div>
              <span className="rounded-full border border-[#e2ddd5] bg-[#fffdfa] px-2.5 py-1 text-[11px] font-semibold text-[#7a7268]">
                상세 연결
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
function ConsumerBookingMock() {
  return (
    <div className="rounded-[18px] border border-[#e2ddd5] bg-white p-4 shadow-[0_10px_18px_rgba(24,33,31,0.05)]">
      <div className="rounded-[18px] bg-[#1e5d51] px-4 py-4 text-white">
        <p className="text-[12px] font-semibold tracking-[0.08em] text-white/76">예약 시작</p>
        <p className="mt-2 text-[22px] font-extrabold tracking-[-0.04em]">예약 화면</p>
      </div>
      <div className="mt-3 space-y-2.5">
        <div className="rounded-[16px] border border-[#e8e0d4] bg-[#fcfaf7] px-4 py-4">
          <p className="text-[16px] font-extrabold text-[#18211f]">첫 방문 예약</p>
          <p className="mt-1 text-[13px] leading-5 text-[#6d665d]">상담부터 차분하게 시작하는 예약</p>
        </div>
        <div className="rounded-[16px] border border-[#e8e0d4] bg-[#fcfaf7] px-4 py-4">
          <p className="text-[16px] font-extrabold text-[#18211f]">재방문 예약</p>
          <p className="mt-1 text-[13px] leading-5 text-[#6d665d]">이전 방문 정보를 바탕으로 빠르게 예약</p>
        </div>
        <div className="rounded-[16px] border border-[#e8e0d4] bg-[#fcfaf7] px-4 py-4">
          <p className="text-[16px] font-extrabold text-[#18211f]">예약 확인 / 취소 / 변경</p>
          <p className="mt-1 text-[13px] leading-5 text-[#6d665d]">기존 예약도 같은 화면에서 바로 확인할 수 있어요.</p>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-white/12 bg-white/8 px-3 py-3 backdrop-blur-[3px]">
      <p className="text-[11px] font-semibold tracking-[0.06em] text-white/68">{label}</p>
      <p className="mt-1 text-[15px] font-bold tracking-[-0.02em] text-white">{value}</p>
    </div>
  );
}

function MiniStat({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: "accent" | "warning" | "danger" | "neutral";
}) {
  const toneMap = {
    accent: {
      bar: "before:bg-[#1f5b51]",
      border: "border-[#d6e7e1]",
    },
    warning: {
      bar: "before:bg-[#e4b08d]",
      border: "border-[#ead8c9]",
    },
    danger: {
      bar: "before:bg-[#cf9b8d]",
      border: "border-[#ead8d2]",
    },
    neutral: {
      bar: "before:bg-[#d8d2c7]",
      border: "border-[#e4ddd3]",
    },
  } as const;

  return (
    <div
      className={`relative overflow-hidden rounded-[18px] border bg-[#fcfaf7] px-4 py-3.5 shadow-[0_10px_18px_rgba(24,33,31,0.04)] before:absolute before:inset-x-0 before:top-0 before:h-1.5 ${toneMap[tone].bar} ${toneMap[tone].border}`}
    >
      <p className="relative z-[1] text-[12px] font-semibold text-[#6d665d]">{title}</p>
      <p className="relative z-[1] mt-3 text-[24px] font-extrabold leading-none tracking-[-0.04em] text-[#18211f]">{value}</p>
    </div>
  );
}



