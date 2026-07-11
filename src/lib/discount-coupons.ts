import type { CustomerDiscountCoupon } from "@/types/domain";

export type CustomerVisitType = "unknown" | "first_visit" | "revisit";

export type CustomerDiscountQuoteCoupon = {
  id: string;
  name: string;
  discountType: CustomerDiscountCoupon["discount_type"];
  discountValue: number;
  discountAmount: number;
  combinationPolicy: CustomerDiscountCoupon["combination_policy"];
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
  if (!coupon.enabled || !coupon.visible || coupon.discount_value <= 0) return false;
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
    if (coupon.audience === "all" || coupon.audience === "custom") return true;
    return coupon.audience === visitType;
  });
}

export function hasActiveVisitSpecificDiscountCoupon(coupons: CustomerDiscountCoupon[], todayKey: string) {
  return coupons.some((coupon) => isDiscountCouponActive(coupon, todayKey) && isVisitSpecificDiscountCoupon(coupon));
}

export function formatDiscountCouponValue(coupon: Pick<CustomerDiscountCoupon, "discount_type" | "discount_value">) {
  if (coupon.discount_type === "percent") return `${coupon.discount_value}% 할인`;
  return `${coupon.discount_value.toLocaleString("ko-KR")}원 할인`;
}

function couponMatchesService(coupon: CustomerDiscountCoupon, serviceOptionIds: string[]) {
  if (coupon.service_scope !== "specific") return true;
  if (coupon.service_option_ids.length === 0 || serviceOptionIds.length === 0) return false;
  return coupon.service_option_ids.some((serviceOptionId) => serviceOptionIds.includes(serviceOptionId));
}

function calculateCouponAmount(coupon: CustomerDiscountCoupon, originalAmount: number) {
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
      name: coupon.name,
      discountType: coupon.discount_type,
      discountValue: coupon.discount_value,
      discountAmount: calculateCouponAmount(coupon, safeOriginalAmount),
      combinationPolicy: coupon.combination_policy,
    }))
    .filter((coupon) => coupon.discountAmount > 0);

  const stackableCoupons = eligibleCoupons.filter((coupon) => coupon.combinationPolicy === "stackable");
  const candidates = [
    stackableCoupons,
    ...eligibleCoupons
      .filter((coupon) => coupon.combinationPolicy === "exclusive")
      .map((coupon) => [coupon]),
  ].filter((candidate) => candidate.length > 0);

  const appliedCoupons = candidates.reduce<CustomerDiscountQuoteCoupon[]>((best, candidate) => {
    const bestAmount = best.reduce((sum, coupon) => sum + coupon.discountAmount, 0);
    const candidateAmount = candidate.reduce((sum, coupon) => sum + coupon.discountAmount, 0);
    if (candidateAmount > bestAmount) return candidate;
    if (candidateAmount === bestAmount && candidate.length < best.length) return candidate;
    return best;
  }, []);
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
