/**
 * 관리자 화면의 공통 가독성 체계.
 *
 * 오너 PC에서 합의된 14 / 16 / 20 / 28px 역할을 그대로 사용해
 * 관리자 화면 안에서 임의의 작은 글자 크기가 다시 생기지 않게 한다.
 */
export const ADMIN_TYPOGRAPHY = {
  helper: "text-[14px] leading-[18px] font-normal",
  meta: "text-[14px] leading-5 font-medium",
  badge: "text-[14px] leading-5 font-semibold",
  label: "text-[16px] leading-6 font-medium",
  control: "text-[16px] leading-6 font-semibold",
  body: "text-[16px] leading-6 font-medium",
  bodyStrong: "text-[16px] leading-6 font-semibold",
  sectionTitle: "text-[20px] leading-7 font-semibold",
  pageTitle: "text-[28px] leading-9 font-semibold",
  cardTitle: "text-[16px] leading-6 font-medium",
  secondary: "text-[14px] leading-5 font-normal",
  button: "min-h-11 text-[16px] leading-6 font-semibold",
} as const;

export const ADMIN_SURFACE = "admin-readable min-h-screen bg-[#f4f6f5] px-4 py-5 text-[#172033] md:px-7 md:py-7";
