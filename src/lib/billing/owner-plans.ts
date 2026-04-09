export type OwnerPlanCode = "monthly" | "quarterly" | "halfyearly" | "yearly";

export type OwnerPlan = {
  code: OwnerPlanCode;
  name: string;
  months: number;
  price: number;
  monthlyPrice: number;
  monthlyEquivalent: number;
  discountPercent: number;
  recommended?: boolean;
};

const BASE_MONTHLY_PRICE = 11900;

function makePlan(code: OwnerPlanCode, name: string, months: number, price: number, recommended = false): OwnerPlan {
  const baseTotal = BASE_MONTHLY_PRICE * months;
  const discountPercent = Math.max(0, Math.round((1 - price / baseTotal) * 100));

  return {
    code,
    name,
    months,
    price,
    monthlyPrice: BASE_MONTHLY_PRICE,
    monthlyEquivalent: Math.round(price / months),
    discountPercent,
    recommended,
  };
}

export const ownerPlans: OwnerPlan[] = [
  makePlan("monthly", "1개월", 1, 11900),
  makePlan("quarterly", "3개월", 3, 34900),
  makePlan("halfyearly", "6개월", 6, 59900),
  makePlan("yearly", "12개월", 12, 79000, true),
];

export function getOwnerPlanByCode(code: string | null | undefined) {
  return ownerPlans.find((plan) => plan.code === code) ?? null;
}
