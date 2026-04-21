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
        : `${months}개월 기간 연장 정기결제`,
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
    name: "체험 플랜",
    title: "체험 플랜",
    shortTitle: "체험 플랜",
    months: 0,
    price: 0,
    totalPrice: 0,
    monthlyPrice: 0,
    monthlyEquivalent: 0,
    billingType: "one_time",
    billingLabel: "관리자 배정 체험 플랜",
    description: "초기 사용 확인을 위해 제공되는 체험 플랜입니다.",
    discountPercent: 0,
  },
  makePlan({
    code: "monthly",
    title: "한 달 플랜",
    shortTitle: "한 달 플랜",
    months: 1,
    monthlyPrice: 12900,
    billingType: "one_time",
    description: "부담 없이 바로 다시 시작할 수 있는 기본 플랜입니다.",
  }),
  makePlan({
    code: "quarterly",
    title: "세 달 플랜",
    shortTitle: "세 달 플랜",
    months: 3,
    monthlyPrice: 10900,
    billingType: "subscription",
    description: "짧은 기간 동안 운영 흐름을 다시 잡기 좋은 플랜입니다.",
  }),
  makePlan({
    code: "halfyearly",
    title: "여섯 달 플랜",
    shortTitle: "여섯 달 플랜",
    months: 6,
    monthlyPrice: 9900,
    billingType: "subscription",
    description: "운영을 안정적으로 이어가기 좋은 중간 기간 플랜입니다.",
  }),
  makePlan({
    code: "yearly",
    title: "일 년 플랜",
    shortTitle: "일 년 플랜",
    months: 12,
    monthlyPrice: 7900,
    billingType: "subscription",
    description: "가장 낮은 월 요금으로 오래 이어가기 좋은 추천 플랜입니다.",
    badge: "가장 인기",
    dailyPriceText: "하루 약 260원",
    featured: true,
  }),
];

export const billableOwnerPlans = ownerPlans.filter((plan) => plan.code !== "free");

export function getOwnerPlanByCode(code: string | null | undefined) {
  return ownerPlans.find((plan) => plan.code === code) ?? null;
}

export function getOwnerPlanDisplayName(code: string | null | undefined) {
  switch (code) {
    case "free":
      return "체험 플랜";
    case "monthly":
      return "한 달 플랜";
    case "quarterly":
      return "세 달 플랜";
    case "halfyearly":
      return "여섯 달 플랜";
    case "yearly":
      return "일 년 플랜";
    default:
      return getOwnerPlanByCode(code)?.shortTitle ?? "-";
  }
}
