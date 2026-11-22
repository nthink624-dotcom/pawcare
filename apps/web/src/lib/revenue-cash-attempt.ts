import { revenuePaymentMethods, type RevenueCashMutation } from "@petmanager/shared/contracts/revenue-analytics";

type AttemptStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type AttemptScope = { shopId: string; entryId: string; type: "payment" | "refund"; paymentEventId?: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const key = (scope: AttemptScope) => `pm-revenue-pending:v1:${scope.shopId}:${scope.entryId}:${scope.type}:${scope.paymentEventId ?? ""}`;

/** Pending operation metadata only; the server ledger remains the source of truth. */
export function restoreRevenueCashAttempt(store: AttemptStore, scope: AttemptScope): RevenueCashMutation | null {
  const raw = store.getItem(key(scope));
  if (raw === null) return null;
  let value: RevenueCashMutation;
  try { value = JSON.parse(raw) as RevenueCashMutation; } catch { throw new Error("이전 저장 요청을 읽지 못했습니다. 새 수금을 입력하기 전에 저장 결과를 확인해 주세요."); }
  if (!value || !uuid.test(value.requestId ?? "") || value.entryId !== scope.entryId || value.type !== scope.type || value.paymentEventId !== scope.paymentEventId || !Number.isFinite(Date.parse(value.occurredAt)) || !Array.isArray(value.tenders) || !value.tenders.length || value.tenders.length > 6 || value.tenders.some(row => !row || !revenuePaymentMethods.includes(row.method) || !Number.isSafeInteger(row.amount) || row.amount <= 0 || row.amount > 999_999_999)) throw new Error("이전 저장 요청을 확인하지 못했습니다. 새 수금을 입력하기 전에 저장 결과를 확인해 주세요.");
  return value;
}

export function persistRevenueCashAttempt(store: AttemptStore, scope: AttemptScope, request: RevenueCashMutation) {
  const existing = restoreRevenueCashAttempt(store, scope);
  if (existing && JSON.stringify(existing) !== JSON.stringify(request)) throw new Error("아직 결과를 확인하지 못한 저장 요청이 있습니다. 기존 요청의 결과를 먼저 확인해 주세요.");
  try { store.setItem(key(scope), JSON.stringify(request)); }
  catch { throw new Error("중복 기록을 방지할 저장 공간을 사용할 수 없어 저장하지 않았습니다. 브라우저 설정을 확인해 주세요."); }
}

export function clearRevenueCashAttempt(store: AttemptStore, scope: AttemptScope, requestId: string) {
  if (restoreRevenueCashAttempt(store, scope)?.requestId === requestId) store.removeItem(key(scope));
}
