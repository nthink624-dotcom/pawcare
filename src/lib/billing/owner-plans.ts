export type OwnerPlanCode = "monthly" | "quarterly" | "halfyearly" | "yearly";

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
  const discountPercent = Math.max(0, Math.round((1 - totalPrice / regularTotal) * 100));

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
        ? `${months}개월 이용 · 일반결제`
        : `${months}개월 약정 · 매달 결제`,
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
  makePlan({
    code: "monthly",
    title: "1개월 플랜",
    shortTitle: "1개월",
    months: 1,
    monthlyPrice: 12900,
    billingType: "one_time",
    description: "가볍게 시작해보고 싶은 매장에 잘 맞는 플랜입니다.",
  }),
  makePlan({
    code: "quarterly",
    title: "3개월 약정 플랜",
    shortTitle: "3개월",
    months: 3,
    monthlyPrice: 10900,
    billingType: "subscription",
    description: "짧지 않은 운영 리듬으로 차분하게 써보기 좋은 플랜입니다.",
  }),
  makePlan({
    code: "halfyearly",
    title: "6개월 약정 플랜",
    shortTitle: "6개월",
    months: 6,
    monthlyPrice: 9900,
    billingType: "subscription",
    description: "꾸준한 예약 관리와 고객 관리를 이어가기 좋은 플랜입니다.",
  }),
  makePlan({
    code: "yearly",
    title: "12개월 약정 플랜",
    shortTitle: "12개월",
    months: 12,
    monthlyPrice: 8900,
    billingType: "subscription",
    description: "오래 운영할수록 가장 부담이 낮게 느껴지는 플랜입니다.",
    badge: "가장 인기",
    dailyPriceText: "하루 296원꼴",
    featured: true,
  }),
];

export function getOwnerPlanByCode(code: string | null | undefined) {
  return ownerPlans.find((plan) => plan.code === code) ?? null;
}
