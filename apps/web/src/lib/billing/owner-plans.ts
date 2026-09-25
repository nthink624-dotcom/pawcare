export const OWNER_SINGLE_MONTHLY_PLAN_CODE = "single_monthly_v1" as const;
export const OWNER_SINGLE_MONTHLY_LEGACY_PRODUCT_VERSION = "2026-08-v1" as const;
export const OWNER_SINGLE_MONTHLY_PRODUCT_VERSION = "2026-09-v1" as const;
export const OWNER_SINGLE_MONTHLY_PRICE_KRW = 29000;
export const OWNER_SINGLE_MONTHLY_CURRENCY = "KRW" as const;
export const OWNER_SINGLE_MONTHLY_PRODUCT_NAME = "펫매니저 월 이용권" as const;
export const OWNER_SINGLE_MONTHLY_ORDER_NAME = "펫매니저 월 이용권 정기결제" as const;
export const OWNER_SINGLE_MONTHLY_VAT_INCLUDED = true as const;

export type OwnerPlanCode =
  | "free"
  | typeof OWNER_SINGLE_MONTHLY_PLAN_CODE
  | "monthly"
  | "quarterly"
  | "halfyearly"
  | "yearly";

export type OwnerPlanBillingType = "one_time" | "subscription";

export function isCurrentOwnerPlanCode(code: string | null | undefined): code is typeof OWNER_SINGLE_MONTHLY_PLAN_CODE {
  return code === OWNER_SINGLE_MONTHLY_PLAN_CODE;
}

export function isLegacyOwnerPlanCode(code: string | null | undefined) {
  return code === "free" || code === "monthly" || code === "quarterly" || code === "halfyearly" || code === "yearly";
}

export function isReadableSingleMonthlyProductVersion(version: string | null | undefined) {
  return version === OWNER_SINGLE_MONTHLY_LEGACY_PRODUCT_VERSION || version === OWNER_SINGLE_MONTHLY_PRODUCT_VERSION;
}

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
  staffLimitLabel: string;
  alimtalkIncludedLabel: string;
  excessAlimtalkLabel: string;
  targetLabel: string;
  highlights: string[];
  featured?: boolean;
  recommended?: boolean;
  hidden?: boolean;
  productVersion?: string;
  priceSnapshotCurrency?: "KRW";
  legacy?: boolean;
};

const EXCESS_ALIMTALK_LABEL = "초과 알림톡 11원/건, 부가세 포함";
export const OWNER_STORE_LIST_MONTHLY_PRICE = 19000;

export type OwnerMultiShopDiscountBilling = {
  totalShopCount: number;
  perShopListMonthlyPrice: number;
  discountRate: number;
  discountPercent: number;
  subtotalBeforeDiscount: number;
  discountAmount: number;
  finalMonthlyAmount: number;
  policyLabel: string;
  appliedLabel: string;
};

export type OwnerBillingAmountBreakdown = {
  planCode: OwnerPlanCode;
  planName: string;
  baseMonthlyAmount: number;
  multiShopDiscount: OwnerMultiShopDiscountBilling;
  monthlyTotalAmount: number;
};

export function getOwnerMultiShopDiscountRate(totalShopCount: number) {
  if (totalShopCount >= 3) return 0.2;
  if (totalShopCount >= 2) return 0.1;
  return 0;
}

export function calculateOwnerMultiShopDiscountBilling(
  totalShopCount: number,
  perShopListMonthlyPrice = OWNER_STORE_LIST_MONTHLY_PRICE,
): OwnerMultiShopDiscountBilling {
  const normalizedTotalShopCount = Math.max(1, Math.floor(Number.isFinite(totalShopCount) ? totalShopCount : 1));
  const normalizedPerShopListMonthlyPrice = Math.max(
    0,
    Math.floor(Number.isFinite(perShopListMonthlyPrice) ? perShopListMonthlyPrice : OWNER_STORE_LIST_MONTHLY_PRICE),
  );
  const discountRate = getOwnerMultiShopDiscountRate(normalizedTotalShopCount);
  const subtotalBeforeDiscount = normalizedPerShopListMonthlyPrice * normalizedTotalShopCount;
  const discountAmount = Math.round(subtotalBeforeDiscount * discountRate);
  const finalMonthlyAmount = subtotalBeforeDiscount - discountAmount;
  const discountPercent = Math.round(discountRate * 100);

  return {
    totalShopCount: normalizedTotalShopCount,
    perShopListMonthlyPrice: normalizedPerShopListMonthlyPrice,
    discountRate,
    discountPercent,
    subtotalBeforeDiscount,
    discountAmount,
    finalMonthlyAmount,
    policyLabel:
      normalizedTotalShopCount >= 3
        ? "3개 매장부터 20% 할인"
        : normalizedTotalShopCount >= 2
        ? "2개 매장부터 10% 할인"
        : "1개 매장은 정가 적용",
    appliedLabel:
      discountPercent > 0
        ? `현재 ${normalizedTotalShopCount}개 매장 이용 중, ${discountPercent}% 할인이 적용됐어요.`
        : "현재 1개 매장 이용 중, 매장 정가가 적용됐어요.",
  };
}

export function calculateOwnerBillingAmountBreakdown(
  plan: Pick<OwnerPlan, "code" | "name" | "billingType" | "monthlyPrice" | "totalPrice">,
  totalShopCount: number,
): OwnerBillingAmountBreakdown {
  if (plan.code === OWNER_SINGLE_MONTHLY_PLAN_CODE) {
    return {
      planCode: plan.code,
      planName: plan.name,
      baseMonthlyAmount: plan.monthlyPrice,
      multiShopDiscount: {
        totalShopCount: 1,
        perShopListMonthlyPrice: plan.monthlyPrice,
        discountRate: 0,
        discountPercent: 0,
        subtotalBeforeDiscount: plan.monthlyPrice,
        discountAmount: 0,
        finalMonthlyAmount: plan.monthlyPrice,
        policyLabel: "매장 1곳당 이용권 1개",
        appliedLabel: "현재 선택한 매장 1곳에만 적용됩니다.",
      },
      monthlyTotalAmount: plan.monthlyPrice,
    };
  }

  const multiShopDiscount = calculateOwnerMultiShopDiscountBilling(
    totalShopCount,
    plan.code === "free" ? 0 : plan.monthlyPrice,
  );

  return {
    planCode: plan.code,
    planName: plan.name,
    baseMonthlyAmount: multiShopDiscount.subtotalBeforeDiscount,
    multiShopDiscount,
    monthlyTotalAmount: multiShopDiscount.finalMonthlyAmount,
  };
}

export function ownerPlanUsesMultiShopStaffAllowance(totalShopCount: number) {
  const normalizedTotalShopCount = Math.max(1, Math.floor(Number.isFinite(totalShopCount) ? totalShopCount : 1));
  return normalizedTotalShopCount >= 2;
}

export function getOwnerPlanStaffLimitLabel(
  plan: Pick<OwnerPlan, "code" | "staffLimitLabel">,
  totalShopCount: number,
) {
  if (!ownerPlanUsesMultiShopStaffAllowance(totalShopCount)) {
    return plan.staffLimitLabel;
  }

  switch (plan.code) {
    case "monthly":
      return "2인 다점포 운영";
    case "quarterly":
    case "halfyearly":
      return "3~5인 다점포 운영";
    case "yearly":
      return "6인 이상 다점포 운영";
    default:
      return plan.staffLimitLabel;
  }
}

export function getOwnerPlanStaffAccountLabel(
  plan: Pick<OwnerPlan, "code">,
  totalShopCount: number,
) {
  if (plan.code === "free") {
    return "체험 설정";
  }

  if (ownerPlanUsesMultiShopStaffAllowance(totalShopCount)) {
    return "직원 1명 추가 포함";
  }

  return plan.code === "monthly" ? "없음" : "포함";
}

export const ownerPlanIncludedAlimtalkCredits: Record<OwnerPlanCode, number> = {
  free: 100,
  [OWNER_SINGLE_MONTHLY_PLAN_CODE]: 0,
  monthly: 500,
  quarterly: 1500,
  halfyearly: 1500,
  yearly: 5000,
};

export function getOwnerPlanIncludedAlimtalkCredits(code: OwnerPlanCode | string | null | undefined) {
  if (
    code === "free" ||
    code === OWNER_SINGLE_MONTHLY_PLAN_CODE ||
    code === "monthly" ||
    code === "quarterly" ||
    code === "halfyearly" ||
    code === "yearly"
  ) {
    return ownerPlanIncludedAlimtalkCredits[code];
  }

  return ownerPlanIncludedAlimtalkCredits.free;
}

function makePlan({
  code,
  title,
  shortTitle,
  monthlyPrice,
  description,
  badge,
  dailyPriceText,
  staffLimitLabel,
  alimtalkIncludedLabel,
  targetLabel,
  highlights,
  featured = false,
  hidden = false,
}: {
  code: OwnerPlanCode;
  title: string;
  shortTitle: string;
  monthlyPrice: number;
  description: string;
  badge?: string;
  dailyPriceText?: string;
  staffLimitLabel: string;
  alimtalkIncludedLabel: string;
  targetLabel: string;
  highlights: string[];
  featured?: boolean;
  hidden?: boolean;
}) {
  const months = 1;
  const totalPrice = monthlyPrice;

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
    billingType: "subscription",
    billingLabel: "월 정기결제",
    totalLabel: `월 ${totalPrice.toLocaleString("ko-KR")}원`,
    dailyPriceText,
    description,
    discountPercent: 0,
    badge,
    staffLimitLabel,
    alimtalkIncludedLabel,
    excessAlimtalkLabel: EXCESS_ALIMTALK_LABEL,
    targetLabel,
    highlights,
    featured,
    recommended: featured,
    hidden,
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
    staffLimitLabel: "체험 설정",
    alimtalkIncludedLabel: "테스트 기준",
    excessAlimtalkLabel: EXCESS_ALIMTALK_LABEL,
    targetLabel: "도입 전 확인",
    highlights: ["14일 무료체험", "카드 등록 없이 시작", "오너 화면 기본 기능 확인"],
  },
  {
    code: OWNER_SINGLE_MONTHLY_PLAN_CODE,
    productVersion: OWNER_SINGLE_MONTHLY_PRODUCT_VERSION,
    priceSnapshotCurrency: "KRW",
    name: OWNER_SINGLE_MONTHLY_PRODUCT_NAME,
    title: OWNER_SINGLE_MONTHLY_PRODUCT_NAME,
    shortTitle: "월 이용권",
    months: 1,
    price: OWNER_SINGLE_MONTHLY_PRICE_KRW,
    totalPrice: OWNER_SINGLE_MONTHLY_PRICE_KRW,
    monthlyPrice: OWNER_SINGLE_MONTHLY_PRICE_KRW,
    monthlyEquivalent: OWNER_SINGLE_MONTHLY_PRICE_KRW,
    billingType: "subscription",
    billingLabel: "매월 자동 결제",
    totalLabel: "월 29,000원",
    description: "매장 1곳의 모든 운영 기능을 월 29,000원(부가세 포함)에 이용합니다.",
    discountPercent: 0,
    staffLimitLabel: "직원 수에 따른 기능 차등 없음",
    alimtalkIncludedLabel: "알림톡 기능 포함",
    excessAlimtalkLabel: "별도 건수 충전 없음",
    targetLabel: "매장 1곳당",
    highlights: ["14일 무료 체험", "월 29,000원 · 부가세 포함", "체험 후 등록 카드로 매월 자동 결제"],
    featured: true,
    recommended: true,
  },
  makePlan({
    code: "monthly",
    title: "1인 운영",
    shortTitle: "1인 운영",
    monthlyPrice: 19000,
    description: "혼자 운영하는 단일 매장 1인샵을 위한 플랜입니다. 기본 기능은 동일하게 제공하고 운영 인원 기준만 1인샵에 맞춥니다.",
    staffLimitLabel: "1인 단일 매장",
    alimtalkIncludedLabel: "월 500건",
    targetLabel: "1개 사업자/1개 매장 1인샵",
    highlights: ["운영 기준: 1개 사업자/1개 매장", "타 업체·타 지점 분리 운영 불가", "예약 담당자: 1명"],
    hidden: true,
  }),
  makePlan({
    code: "quarterly",
    title: "2~4인 운영",
    shortTitle: "2~4인 운영",
    monthlyPrice: 29000,
    description: "상시 직원, 파트타임, 프리랜서가 함께 일하는 단일 매장을 위한 추천 플랜입니다. 여러 담당자가 한 매장 안에서 예약을 나눠 맡는 기준입니다.",
    badge: "추천",
    staffLimitLabel: "2~4인 단일 매장",
    alimtalkIncludedLabel: "월 1,500건",
    targetLabel: "1개 사업자/1개 매장 2~4인",
    highlights: ["운영 기준: 1개 사업자/1개 매장", "예약 담당자: 상시 4명 + 프리랜서 2명", "타 업체·타 지점 공동 사용 불가"],
    hidden: true,
  }),
  makePlan({
    code: "halfyearly",
    title: "2~4인 운영",
    shortTitle: "2~4인 운영",
    monthlyPrice: 29000,
    description: "기존 반기 플랜 코드 호환용입니다. 신규 화면에는 노출하지 않습니다.",
    staffLimitLabel: "2~4인 단일 매장",
    alimtalkIncludedLabel: "월 1,500건",
    targetLabel: "기존 결제 호환",
    highlights: ["기존 구독 호환"],
    hidden: true,
  }),
  makePlan({
    code: "yearly",
    title: "5인 이상 운영",
    shortTitle: "5인 이상 운영",
    monthlyPrice: 79000,
    description: "5명 이상이 함께 일하거나 예약량과 알림톡 발송량이 많은 단일 대형 매장을 위한 플랜입니다. 여러 업체 공동 사용이나 지점 통합 운영 기준이 아닙니다.",
    staffLimitLabel: "5인 이상 단일 매장",
    alimtalkIncludedLabel: "월 5,000건",
    targetLabel: "1개 사업자/1개 매장 5인 이상",
    highlights: ["운영 기준: 1개 사업자/1개 매장", "여러 지점/타 업체 공동 사용 불가", "지점 확장·공동 운영은 별도 문의"],
    hidden: true,
  }),
];

export const billableOwnerPlans = ownerPlans.filter((plan) => plan.code !== "free" && !plan.hidden);

export function ownerPlanAllowsAutomaticVisitReminder(code: OwnerPlanCode | string | null | undefined) {
  return code === OWNER_SINGLE_MONTHLY_PLAN_CODE || code === "quarterly" || code === "halfyearly" || code === "yearly";
}

export function getOwnerPlanByCode(code: string | null | undefined) {
  return ownerPlans.find((plan) => plan.code === code) ?? null;
}

export function getOwnerPlanDisplayName(code: string | null | undefined) {
  switch (code) {
    case "free":
      return "체험 플랜";
    case "monthly":
      return "1인 운영";
    case "quarterly":
      return "2~4인 운영";
    case "halfyearly":
      return "2~4인 운영";
    case "yearly":
      return "5인 이상 운영";
    default:
      return getOwnerPlanByCode(code)?.shortTitle ?? "-";
  }
}
