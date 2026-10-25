/** Explicit fixture identity, never inferred from a person's or shop's display name. */
export function isDepositPreviewShop(environment: string | undefined, shopId: string) {
  return environment === "development" && shopId === "deposit-preview-12b5026a";
}
export default function BookingDevelopmentNotice({ environment, shopId }: { environment?: string; shopId: string }) {
  if (!isDepositPreviewShop(environment, shopId)) return null;
  return <p data-booking-development-notice className="bg-[#fffaf0] px-3 py-2 text-[13px] leading-5 text-[#8a5b11]">테스트 화면 · 실제 송금 및 메시지 발송 금지</p>;
}
