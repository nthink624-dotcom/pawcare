import type { CustomerDiscountCoupon } from "@/types/domain";

export type CustomerVisitType = "unknown" | "first_visit" | "revisit";

export type CustomerDiscountQuoteCoupon = {
  id: string;
  name: string;
  discountType: CustomerDiscountCoupon["discount_type"];
  discountValue: number;
  discountAmount: number;
  combinationPolicy: CustomerDiscountCoupon["combination_policy"];
  serviceBenefitName?: string;
};

export type CustomerDiscountQuote = {
  visitType: Exclude<CustomerVisitType, "unknown">;
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  eligibleCoupons: CustomerDiscountQuoteCoupon[];
  appliedCoupons: CustomerDiscountQuoteCoupon[];
};

export function isDiscountCouponActive(coupon: CustomerDiscountCoupon, todayKey: string) {
  if (!coupon.enabled || !coupon.visible) return false;
  if (coupon.discount_type === "service") {
    if (!coupon.service_benefit_name?.trim()) return false;
  } else if (coupon.discount_value <= 0) {
    return false;
  }
  if (coupon.starts_at && coupon.starts_at > todayKey) return false;
  if (coupon.ends_at && coupon.ends_at < todayKey) return false;
  return true;
}

export function isVisitSpecificDiscountCoupon(coupon: Pick<CustomerDiscountCoupon, "audience">) {
  return coupon.audience === "first_visit" || coupon.audience === "revisit";
}

export function filterDiscountCouponsForVisitType(
  coupons: CustomerDiscountCoupon[],
  visitType: CustomerVisitType,
  todayKey: string,
) {
  return coupons.filter((coupon) => {
    if (!isDiscountCouponActive(coupon, todayKey)) return false;
    if (visitType === "unknown") return !isVisitSpecificDiscountCoupon(coupon);
    if (coupon.audience === "all") return true;
    return coupon.audience === visitType;
  });
}

export function hasActiveVisitSpecificDiscountCoupon(coupons: CustomerDiscountCoupon[], todayKey: string) {
  return coupons.some((coupon) => isDiscountCouponActive(coupon, todayKey) && isVisitSpecificDiscountCoupon(coupon));
}

export function formatDiscountCouponValue(
  coupon: Pick<CustomerDiscountCoupon, "discount_type" | "discount_value"> &
    Partial<Pick<CustomerDiscountCoupon, "service_benefit_name">>,
) {
  if (coupon.discount_type === "service") return `${coupon.service_benefit_name?.trim() || "서비스"} 추가`;
  if (coupon.discount_type === "percent") return `${coupon.discount_value}% 할인`;
  return `${coupon.discount_value.toLocaleString("ko-KR")}원 할인`;
}

export function getDiscountCouponDisplayName(coupon: Pick<CustomerDiscountCoupon, "name" | "owner_label">) {
  return coupon.owner_label?.trim() || coupon.name;
}

function couponMatchesService(coupon: CustomerDiscountCoupon, serviceOptionIds: string[]) {
  if (coupon.service_scope !== "specific") return true;
  if (coupon.service_option_ids.length === 0 || serviceOptionIds.length === 0) return false;
  return coupon.service_option_ids.some((serviceOptionId) => serviceOptionIds.includes(serviceOptionId));
}

function calculateCouponAmount(coupon: CustomerDiscountCoupon, originalAmount: number) {
  if (coupon.discount_type === "service") return 0;
  if (coupon.discount_type === "percent") {
    return Math.round((originalAmount * Math.min(Math.max(coupon.discount_value, 0), 100)) / 100);
  }
  return Math.min(Math.max(Math.round(coupon.discount_value), 0), originalAmount);
}

export function buildCustomerDiscountQuote({
  coupons,
  visitType,
  dateKey,
  serviceOptionIds,
  originalAmount,
  usedCouponIds = [],
}: {
  coupons: CustomerDiscountCoupon[];
  visitType: Exclude<CustomerVisitType, "unknown">;
  dateKey: string;
  serviceOptionIds: string[];
  originalAmount: number;
  usedCouponIds?: string[];
}): CustomerDiscountQuote {
  const safeOriginalAmount = Math.max(Math.round(originalAmount || 0), 0);
  const usedCouponIdSet = new Set(usedCouponIds);
  const eligibleCoupons = filterDiscountCouponsForVisitType(coupons, visitType, dateKey)
    .filter((coupon) => couponMatchesService(coupon, serviceOptionIds))
    .filter((coupon) => !coupon.per_customer_limit || !usedCouponIdSet.has(coupon.id))
    .map((coupon) => ({
      id: coupon.id,
      name: getDiscountCouponDisplayName(coupon),
      discountType: coupon.discount_type,
      discountValue: coupon.discount_value,
      discountAmount: calculateCouponAmount(coupon, safeOriginalAmount),
      combinationPolicy: coupon.combination_policy,
      serviceBenefitName: coupon.service_benefit_name?.trim() || undefined,
    }))
    .filter((coupon) => coupon.discountType === "service" || coupon.discountAmount > 0);

  const serviceCoupons = eligibleCoupons.filter((coupon) => coupon.discountType === "service");
  const monetaryCoupons = eligibleCoupons.filter((coupon) => coupon.discountType !== "service");
  const stackableCoupons = monetaryCoupons.filter((coupon) => coupon.combinationPolicy === "stackable");
  const candidates = [
    stackableCoupons,
    ...monetaryCoupons
      .filter((coupon) => coupon.combinationPolicy === "exclusive")
      .map((coupon) => [coupon]),
  ].filter((candidate) => candidate.length > 0);

  const appliedMonetaryCoupons = candidates.reduce<CustomerDiscountQuoteCoupon[]>((best, candidate) => {
    const bestAmount = best.reduce((sum, coupon) => sum + coupon.discountAmount, 0);
    const candidateAmount = candidate.reduce((sum, coupon) => sum + coupon.discountAmount, 0);
    if (candidateAmount > bestAmount) return candidate;
    if (candidateAmount === bestAmount && candidate.length < best.length) return candidate;
    return best;
  }, []);
  const appliedCoupons = [...appliedMonetaryCoupons, ...serviceCoupons];
  const discountAmount = Math.min(
    appliedCoupons.reduce((sum, coupon) => sum + coupon.discountAmount, 0),
    safeOriginalAmount,
  );

  return {
    visitType,
    originalAmount: safeOriginalAmount,
    discountAmount,
    finalAmount: safeOriginalAmount - discountAmount,
    eligibleCoupons,
    appliedCoupons,
  };
}
