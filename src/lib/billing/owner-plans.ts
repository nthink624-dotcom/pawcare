export type OwnerPlanCode = "free" | "monthly" | "quarterly" | "halfyearly" | "yearly";

export type OwnerPlanBillingType = "one_time" | "subscription";

export type OwnerPlan = {
  code: OwnerPlanCode;
  name: string;
  title: string;
  shortTitle: string;
  months: number;
  price: number;
  totalPrice: number;
  monthlyPrice: number;
  monthlyEquivalent: number;
  billingType: OwnerPlanBillingType;
  billingLabel: string;
  totalLabel?: string;
  dailyPriceText?: string;
  description: string;
  discountPercent: number;
  badge?: string;
  featured?: boolean;
  recommended?: boolean;
};

const BASE_MONTHLY_PRICE = 12900;

function makePlan({
  code,
  title,
  shortTitle,
  months,
  monthlyPrice,
  billingType,
  description,
  badge,
  dailyPriceText,
  featured = false,
}: {
  code: OwnerPlanCode;
  title: string;
  shortTitle: string;
  months: number;
  monthlyPrice: number;
  billingType: OwnerPlanBillingType;
  description: string;
  badge?: string;
  dailyPriceText?: string;
  featured?: boolean;
}) {
  const totalPrice = monthlyPrice * months;
  const regularTotal = BASE_MONTHLY_PRICE * months;
  const discountPercent =
    months > 0 ? Math.max(0, Math.round((1 - totalPrice / regularTotal) * 100)) : 0;

  return {
    code,
    name: title,
    title,
    shortTitle,
    months,
    price: totalPrice,
    totalPrice,
    monthlyPrice,
    monthlyEquivalent: monthlyPrice,
    billingType,
    billingLabel:
      billingType === "one_time"
        ? `${months}개월 이용권 1회 결제`
        : `${months}개월 약정 월 정기결제`,
    totalLabel: months > 1 ? `총 ${totalPrice.toLocaleString("ko-KR")}원` : undefined,
    dailyPriceText,
    description,
    discountPercent,
    badge,
    featured,
    recommended: featured,
  } satisfies OwnerPlan;
}

export const ownerPlans: OwnerPlan[] = [
  {
    code: "free",
    name: "무료 플랜",
    title: "무료 플랜",
    shortTitle: "무료",
    months: 0,
    price: 0,
    totalPrice: 0,
    monthlyPrice: 0,
    monthlyEquivalent: 0,
    billingType: "one_time",
    billingLabel: "관리자 배정용 무료 플랜",
    description: "관리자가 서비스 시작용으로 배정하는 무료 플랜입니다.",
    discountPercent: 0,
  },
  makePlan({
    code: "monthly",
    title: "1개월 플랜",
    shortTitle: "1개월",
    months: 1,
    monthlyPrice: 12900,
    billingType: "one_time",
    description: "약정 없이 한 달씩 가볍게 시작할 수 있는 기본 플랜입니다.",
  }),
  makePlan({
    code: "quarterly",
    title: "3개월 약정 플랜",
    shortTitle: "3개월",
    months: 3,
    monthlyPrice: 10900,
    billingType: "subscription",
    description: "짧은 약정으로 부담을 줄이면서 월 요금을 아낄 수 있는 플랜입니다.",
  }),
  makePlan({
    code: "halfyearly",
    title: "6개월 약정 플랜",
    shortTitle: "6개월",
    months: 6,
    monthlyPrice: 9900,
    billingType: "subscription",
    description: "운영이 안정화된 매장을 위한 중간 약정 플랜입니다.",
  }),
  makePlan({
    code: "yearly",
    title: "12개월 약정 플랜",
    shortTitle: "12개월",
    months: 12,
    monthlyPrice: 8900,
    billingType: "subscription",
    description: "가장 긴 약정으로 월 부담을 가장 크게 낮출 수 있는 추천 플랜입니다.",
    badge: "가장 인기",
    dailyPriceText: "하루 약 296원",
    featured: true,
  }),
];

export const billableOwnerPlans = ownerPlans.filter((plan) => plan.code !== "free");

export function getOwnerPlanByCode(code: string | null | undefined) {
  return ownerPlans.find((plan) => plan.code === code) ?? null;
}
