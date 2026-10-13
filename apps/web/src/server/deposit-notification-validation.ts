/** Validate the saved request snapshot, never preview placeholders. */
export function assertDepositNotificationValues(data: unknown): void {
  const snapshot = data as { policy?: Record<string, unknown>; deposit?: Record<string, unknown> } | null;
  const missing: string[] = [];
  const amount = snapshot?.deposit?.amount;
  if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount <= 0) missing.push("예약금액");
  for (const [key, label] of [["bankName", "은행"], ["bankAccount", "입금 계좌"], ["bankHolder", "예금주"]]) {
    const value = snapshot?.policy?.[key];
    if (typeof value !== "string" || !value.trim() || /#\{[^}]*\}|\[(?:은행|계좌번호|예금주) 미설정\]/.test(value)) missing.push(label);
  }
  if (missing.length) throw new Error(`예약금 안내를 보낼 수 없습니다. ${missing.join("·")} 정보를 등록해 주세요.`);
}
