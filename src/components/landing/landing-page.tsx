"use client";

import LegalLinksFooter from "@/components/legal/legal-links-footer";
import { ownerPlans, type OwnerPlanCode } from "@/lib/billing/owner-plans";
import { decodeUnicodeEscapes, formatServicePrice } from "@/lib/utils";
import type { Service, Shop } from "@/types/domain";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

const SURFACE =
  "rounded-[28px] border border-[#ddd6ca] bg-white shadow-[0_12px_30px_rgba(24,33,31,0.05)]";
const SECTION_TITLE = "text-[16px] font-bold leading-[1.35] tracking-[-0.03em] text-[#18211f]";
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

const planLabels: Record<OwnerPlanCode, { title: string; period: string; summary: string }> = {
  monthly: { title: "스타터", period: "1개월", summary: "가볍게 시작" },
  quarterly: { title: "베이직", period: "3개월", summary: "흐름 익히기" },
  halfyearly: { title: "그로스", period: "6개월", summary: "꾸준한 운영" },
  yearly: { title: "프로", period: "12개월", summary: "가장 많이 선택" },
};

function countActiveServices(services: Service[]) {
  return services.filter((service) => service.is_active).length;
}

function formatWon(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function getRegularPrice(months: number) {
  return 11900 * months;
}

function getSavings(months: number, price: number) {
  return getRegularPrice(months) - price;
}

export default function LandingPage({ shop, services }: { shop: Shop; services: Service[] }) {
  const shopName = decodeUnicodeEscapes(shop.name);
  const visibleServices = services.filter((service) => service.is_active).slice(0, 3);
  const serviceCount = countActiveServices(services);
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
        <button type="button" onClick={onOpenPlans} className={TERTIARY_BUTTON}>
          무료체험 시작하기
        </button>
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
  const featuredPlan = ownerPlans.find((plan) => plan.code === "yearly")!;
  const otherPlans = ownerPlans.filter((plan) => plan.code !== "yearly");
  const [selectedPlanCode, setSelectedPlanCode] = useState<OwnerPlanCode>("yearly");
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
            <h2 className="mt-2 text-[28px] font-extrabold tracking-[-0.04em] text-[#18211f]">운영 기간에 맞는 플랜을 선택해 주세요</h2>
            <p className="mt-2 text-[14px] leading-6 text-[#625d56]">먼저 플랜을 고르고, 다음 단계에서 결제를 진행합니다.</p>
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
              약 {featuredPlan.discountPercent}% 할인
            </span>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[22px] font-extrabold tracking-[-0.03em] text-[#18211f]">프로</p>
                  <span className="rounded-full border border-[#ddd6ca] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#6a6259]">12개월</span>
                  <span className="rounded-full border border-[#ddd6ca] bg-[#fcfaf7] px-2.5 py-1 text-[11px] font-semibold text-[#6a6259]">가장 많이 선택</span>
                </div>
                <p className="mt-2 text-[14px] leading-6 text-[#6a6259]">꾸준히 운영하는 매장에 가장 잘 맞는 플랜입니다.</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] font-medium text-[#625d56]">
                  <span className="line-through text-[#978f85]">정가 {formatWon(getRegularPrice(featuredPlan.months))}</span>
                  <span className="rounded-full border border-[#d9d2c7] bg-[#fcfaf7] px-2.5 py-1">63,800원 절약</span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[31px] font-extrabold tracking-[-0.05em] text-[#18211f]">79,000원</p>
                <p className="mt-1 text-[12px] font-medium text-[#1f5b51]">월 6,583원꼴</p>
              </div>
            </div>
          </button>

          <div className="mt-6 space-y-4">
            {otherPlans.map((plan) => {
              const meta = planLabels[plan.code];
              const regularPrice = getRegularPrice(plan.months);
              const savings = getSavings(plan.months, plan.price);
              const selected = selectedPlanCode === plan.code;
              const topBadge =
                plan.code === "monthly" ? null : `약 ${plan.discountPercent}% 할인`;

              return (
                <button
                  key={plan.code}
                  type="button"
                  onClick={() => setSelectedPlanCode(plan.code)}
                  className={`relative mt-1 w-full overflow-visible rounded-[24px] border bg-white px-5 py-4 text-left transition ${
                    selected
                      ? "border-[#1f5b51] bg-[#f4faf7] shadow-[0_10px_24px_rgba(11,77,63,0.06)]"
                      : "border-[#ddd6ca]"
                  }`}
                >
                  {topBadge ? (
                    <span className="absolute -top-[12px] right-4 rounded-[10px] bg-[#1f5b51] px-2.5 py-1 text-[10px] font-semibold tracking-[0.01em] text-white shadow-[0_6px_14px_rgba(31,91,81,0.22)]">
                      {topBadge}
                    </span>
                  ) : null}
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[20px] font-extrabold tracking-[-0.03em] text-[#18211f]">{meta.title}</p>
                        <span className="rounded-full border border-[#ddd6ca] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#6a6259]">{meta.period}</span>
                      </div>
                      <p className="mt-2 text-[13px] leading-6 text-[#6a6259]">{meta.summary}</p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[12px] font-medium text-[#625d56]">
                        <span className={`${plan.code === "monthly" ? "text-[#8b8379]" : "line-through text-[#978f85]"}`}>
                          {plan.code === "monthly" ? "기본 요금" : `정가 ${formatWon(regularPrice)}`}
                        </span>
                        {plan.code === "monthly" ? null : (
                          <span className="rounded-full border border-[#d9d2c7] bg-[#fcfaf7] px-2.5 py-1">{formatWon(savings)} 절약</span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[24px] font-extrabold tracking-[-0.04em] text-[#18211f]">{formatWon(plan.price)}</p>
                      <p className="mt-1 text-[12px] font-medium text-[#1f5b51]">월 {formatWon(plan.monthlyEquivalent)}꼴</p>
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
          <p className="mt-1 text-[12px] leading-5 text-[#716960]">보호자 정보와 반려동물 정보를 함께 관리</p>
        </div>
        <span className="rounded-full border border-[#ddd5c8] bg-[#fffdfa] px-3 py-1 text-[11px] font-semibold text-[#6e665c]">
          상세 연결
        </span>
      </div>
      <div className="mt-4 space-y-3">
        <div className="rounded-[16px] border border-[#e8e0d4] bg-[#fcfaf7] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[12px] font-semibold text-[#6b655e]">보호자명</p>
              <p className="mt-1 text-[16px] font-extrabold text-[#18211f]">김민지</p>
            </div>
            <div className="text-right">
              <p className="text-[12px] font-semibold text-[#6b655e]">연락처</p>
              <p className="mt-1 text-[15px] font-bold text-[#18211f]">010-1234-5678</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-[16px] border border-[#e8e0d4] bg-[#fcfaf7] px-4 py-3">
            <p className="text-[12px] font-semibold text-[#6b655e]">반려동물 이름</p>
            <p className="mt-1 text-[15px] font-bold text-[#18211f]">몽이, 차이</p>
          </div>
          <div className="rounded-[16px] border border-[#e8e0d4] bg-[#fcfaf7] px-4 py-3">
            <p className="text-[12px] font-semibold text-[#6b655e]">최근 서비스</p>
            <p className="mt-1 text-[15px] font-bold text-[#18211f]">목욕 + 부분미용</p>
          </div>
        </div>
        <div className="rounded-[16px] border border-[#e8e0d4] bg-[#fcfaf7] px-4 py-3">
          <p className="text-[12px] font-semibold text-[#6b655e]">고객 메모</p>
          <p className="mt-1 text-[14px] leading-6 text-[#18211f]">문 앞 픽업 선호 · 피부가 예민해 짧은 클리핑보다 정리 위주 선호</p>
        </div>
        <div className="rounded-[16px] border border-[#e8e0d4] bg-[#fcfaf7] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[12px] font-semibold text-[#6b655e]">반려동물 정보</p>
              <p className="mt-1 text-[15px] font-bold text-[#18211f]">몽이 · 말티즈 · 4살</p>
            </div>
            <span className="rounded-full bg-[#eef5f3] px-3 py-1 text-[11px] font-semibold text-[#1e5d51]">
              재방문 알림
            </span>
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
        <p className="text-[12px] font-semibold tracking-[0.08em] text-white/76">?? ??</p>
        <p className="mt-2 text-[22px] font-extrabold tracking-[-0.04em]">?? ??</p>
      </div>
      <div className="mt-3 space-y-2.5">
        <div className="rounded-[16px] border border-[#e8e0d4] bg-[#fcfaf7] px-4 py-4">
          <p className="text-[16px] font-extrabold text-[#18211f]">? ?? ??</p>
          <p className="mt-1 text-[13px] leading-5 text-[#6d665d]">???? ???? ???? ??</p>
        </div>
        <div className="rounded-[16px] border border-[#e8e0d4] bg-[#fcfaf7] px-4 py-4">
          <p className="text-[16px] font-extrabold text-[#18211f]">??? ??</p>
          <p className="mt-1 text-[13px] leading-5 text-[#6d665d]">?? ?? ??? ???? ??? ??</p>
        </div>
        <div className="rounded-[16px] border border-[#e8e0d4] bg-[#fcfaf7] px-4 py-4">
          <p className="text-[16px] font-extrabold text-[#18211f]">?? ?? / ?? / ??</p>
          <p className="mt-1 text-[13px] leading-5 text-[#6d665d]">?? ??? ?? ???? ?? ??? ? ???.</p>
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

function PricePill({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-[16px] border border-[#e2ddd5] bg-white px-3 py-3">
      <p className="text-[11px] font-semibold text-[#7a746d]">{label}</p>
      <p className="mt-1 text-[15px] font-bold tracking-[-0.02em] text-[#18211f]">{value}</p>
      <p className="mt-1 text-[11px] leading-4 text-[#6d746f]">{note}</p>
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










