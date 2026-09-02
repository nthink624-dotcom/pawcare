/**
 * 관리자 화면의 공통 가독성 체계.
 *
 * 오너 PC에서 합의된 14 / 16 / 20 / 28px 역할을 그대로 사용해
 * 관리자 화면 안에서 임의의 작은 글자 크기가 다시 생기지 않게 한다.
 */
export const ADMIN_TYPOGRAPHY = {
  helper: "text-[14px] leading-5 font-normal",
  meta: "text-[14px] leading-5 font-medium",
  badge: "text-[12px] leading-[18px] font-medium",
  label: "text-[14px] leading-5 font-medium",
  control: "text-[16px] leading-6 font-medium",
  body: "text-[16px] leading-6 font-normal",
  bodyStrong: "text-[16px] leading-6 font-medium",
  sectionTitle: "text-[20px] leading-7 font-semibold",
  pageTitle: "text-[28px] leading-9 font-semibold",
} as const;
