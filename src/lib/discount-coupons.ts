import type { CustomerDiscountCoupon } from "@/types/domain";

export type CustomerVisitType = "unknown" | "first_visit" | "revisit";

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
