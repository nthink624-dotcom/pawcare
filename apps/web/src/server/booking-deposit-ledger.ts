import "server-only";
import { z } from "zod";
import type { BookingDepositLedger } from "@petmanager/shared/contracts/booking-deposit-ledger";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { OwnerApiError } from "@/server/owner-api-auth";
import type { NotificationType } from "@/types/domain";
import { serverEnv } from "@/lib/server-env";

function db() { const admin = getSupabaseAdmin(); if (!admin) throw new OwnerApiError("예약금 저장소를 확인해 주세요.", 503); return admin; }
export function depositError(error: { message?: string; code?: string } | null): never {
  const code = error?.message ?? "";
  const message = code.includes("VERSION_CONFLICT") ? "다른 화면에서 변경되었습니다. 새로고침해 주세요."
    : code.includes("MANUAL_SETTLEMENT_REQUIRED") ? "이미 사용·환불했거나 다른 날짜로 옮긴 예약금은 확인을 취소할 수 없습니다. 기존 정산 내역을 확인해 수동으로 처리해 주세요."
    : code.includes("RECONFIRM_AMOUNT_REQUIRED") ? "계좌에서 실제로 확인한 금액을 입력한 뒤 다시 확인해 주세요."
    : code.includes("EXPIRED") ? "입금 신고 기한이 지났습니다. 이체하지 말고 매장에 문의해 주세요."
    : code.includes("TRANSFER_DECISION_REQUIRED") ? "날짜를 바꿀 때 예약금 승계 여부를 선택해 주세요."
    : code.includes("TRANSFER_REVIEW_REQUIRED") ? "변경할 날짜의 예약금 조건이 다릅니다. 기존 금액을 먼저 정리해 주세요."
    : code.includes("MONEY_ALREADY_USED") ? "사용·환불·수수료 처리된 금액보다 낮게 정정할 수 없습니다. 기존 정산을 먼저 확인해 주세요."
    : code.includes("REFUND_EXCEEDS") ? "이미 사용하거나 반환한 금액은 다시 환불할 수 없습니다."
    : code.includes("PAYER_REQUIRED") ? "실제 입금자명을 입력해 주세요."
    : "예약금 내용을 저장하지 못했습니다. 내용을 확인한 뒤 다시 시도해 주세요.";
  throw new OwnerApiError(message, code.includes("NOT_FOUND") ? 404 : 409);
}
export async function readDepositLedger(shopId: string, appointmentId: string, includeHistory = true, includeOwnerLabels = false): Promise<BookingDepositLedger | null> {
  const r = await db().rpc(includeHistory ? "pm_deposit_view" : "pm_deposit_summary", { p_shop: shopId, p_appointment: appointmentId });
  if (r.error) depositError(r.error);
  const ledger = r.data as BookingDepositLedger | null;
  if (!includeHistory || !ledger || !includeOwnerLabels) return ledger;
  // Labels only, on disclosure. Financial totals stay owned by the existing RPC.
  const movements = ledger.history.filter(event => ["carry_in", "carry_out", "date_moved_in", "date_moved_out"].includes(event.action) && Number(event.details.amount) > 0);
  const otherIds = [...new Set(movements.flatMap(event => [event.details.from, event.details.to].filter((id): id is string => typeof id === "string")))];
  const [links, others] = await Promise.all([
    ledger.bookingCount > 1 ? db().from("booking_deposit_links").select("used_amount,appointments!inner(id,shop_id,appointment_date,appointment_time,pets:pets!appointments_pet_guardian_shop_tenant_fk(name))").eq("account_id", ledger.id).eq("appointments.shop_id", shopId) : Promise.resolve({ data: [], error: null }),
    otherIds.length ? db().from("booking_deposit_accounts").select("id,booking_date").eq("shop_id", shopId).in("id", otherIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (links.error || others.error) depositError(links.error ?? others.error);
  ledger.relatedBookings = (links.data ?? []).map((row: any) => ({ id: row.appointments.id, date: row.appointments.appointment_date, time: row.appointments.appointment_time.slice(0, 5), petName: row.appointments.pets?.name ?? "반려동물", usedAmount: row.used_amount }));
  const dates = new Map((others.data ?? []).map((row: any) => [row.id, row.booking_date]));
  ledger.movements = movements.flatMap(event => {
    const incoming = event.action.endsWith("in");
    const date = dates.get(incoming ? event.details.from : event.details.to);
    return typeof date === "string" ? [{ date, direction: incoming ? "in" as const : "out" as const, amount: Number(event.details.amount) }] : [];
  });
  return ledger;
}
export const depositActionInput = z.object({
  requestKey: z.string().uuid(), ledgerVersion: z.number().int().positive(),
});
const actions: Record<string, string> = { report_deposit: "report", confirm_deposit: "confirm", correct_deposit: "correct", revoke_deposit: "revoke", refund_record: "refund", waive_deposit: "waive", retry_deposit: "retry" };
export function isLedgerAction(action: string) { return Boolean(actions[action]); }
export async function actOnDepositLedger(shopId: string, appointmentId: string, input: {
  action: string; requestKey?: string; ledgerVersion?: number; amount?: number; payerName?: string; note: string;
}, actor: { kind: "owner" | "customer" | "system"; userId: string | null }) {
  if (actor.kind !== "owner" && input.action !== "report_deposit") throw new OwnerApiError("처리 권한이 없습니다.", 403);
  const key = depositActionInput.parse(input);
  const r = await db().rpc("pm_deposit_act", {
    p_shop: shopId, p_appointment: appointmentId, p_action: actions[input.action], p_key: key.requestKey,
    p_actor: actor.kind === "customer" ? "customer" : actor.userId ?? "owner", p_amount: input.amount ?? null,
    p_name: input.payerName ?? null, p_note: input.note, p_version: key.ledgerVersion,
  });
  if (r.error) depositError(r.error);
}

/** Durable claim before dispatch. Uncertain/failed results are not automatically retried. */
export async function flushDepositOutbox(shopId: string, target?: { accountId: string; dedupeKey: string }) {
  ensureDevelopmentDepositClock();
  const admin = db();
  const accounts = await admin.from("booking_deposit_accounts").select("id").eq("shop_id", shopId);
  if (accounts.error) depositError(accounts.error);
  if (!accounts.data?.length) return;
  let pending = admin.from("booking_deposit_outbox").select("*").in("account_id", accounts.data.map(a => a.id)).eq("state", "pending");
  if (target) pending = pending.eq("account_id", target.accountId).eq("dedupe_key", target.dedupeKey);
  const queue = await pending.order("created_at").limit(20);
  if (queue.error) depositError(queue.error);
  const { dispatchNotification } = await import("@/server/notification-dispatch");
  for (const item of queue.data ?? []) {
    const claim = await admin.from("booking_deposit_outbox").update({ state: "processing" }).eq("id", item.id).eq("state", "pending").select("id").maybeSingle();
    if (claim.error || !claim.data) continue;
    let state = "failed", reason = "발송 결과를 확인하지 못했습니다.";
    try {
      const booking = await admin.from("appointments").select("guardian_id,pet_id").eq("shop_id", shopId).eq("id", item.appointment_id).single();
      if (booking.error) throw new Error("예약 정보를 확인하지 못했습니다.");
      const types: Record<string, NotificationType> = { request: "booking_deposit_request", confirmed: "booking_confirmed", expired: "booking_deposit_expired", cancelled: "booking_deposit_cancelled", owner_cancelled: "booking_cancelled", refunded: "booking_deposit_refunded" };
      if (!types[item.purpose]) throw new Error("Unknown deposit delivery purpose");
      const sent = await dispatchNotification({ shopId, appointmentId: item.appointment_id, guardianId: booking.data.guardian_id, petId: booking.data.pet_id,
        type: types[item.purpose], channel: "alimtalk", skipIfExists: item.purpose === "confirmed", metadata: { depositOutboxId: item.id, depositDedupeKey: item.dedupe_key } });
      state = sent.notification.status === "mocked" ? "mocked" : sent.notification.status === "sent" ? "sent" : sent.notification.status === "skipped" ? "blocked" : "failed";
      reason = sent.notification.status === "mocked" ? "개발 환경 모의 발송 · 실제 발송 아님" : sent.notification.fail_reason ?? sent.notification.status;
    } catch { reason = "승인 템플릿 또는 발송 경로를 확인해 주세요. 같은 요청은 자동 재발송하지 않습니다."; }
    const recorded = await admin.from("booking_deposit_outbox").update({ state, reason, processed_at: new Date().toISOString() }).eq("id", item.id).eq("state", "processing");
    if (recorded.error) depositError(recorded.error);
  }
}

export async function readDepositRetryDelivery(shopId: string, target: { accountId: string; dedupeKey: string }) {
  const account = await db().from("booking_deposit_accounts").select("id").eq("shop_id", shopId).eq("id", target.accountId).maybeSingle();
  if (account.error || !account.data) throw new OwnerApiError("예약금 발송 결과를 확인하지 못했습니다. 상태를 새로고침해 주세요.", 409);
  const result = await db().from("booking_deposit_outbox").select("state,reason").eq("account_id", target.accountId).eq("dedupe_key", target.dedupeKey).maybeSingle();
  if (result.error) depositError(result.error);
  const status = (result.data?.state ?? "failed") as "pending" | "processing" | "sent" | "mocked" | "blocked" | "failed";
  const reason = result.data?.reason ?? "";
  const safeReason = /disabled by shop|notification disabled/i.test(reason) ? "매장 알림이 꺼져 있습니다."
    : /수신|guardian|customer notification/i.test(reason) ? "고객의 알림 수신 설정으로 차단되었습니다."
    : /credit|잔여|크레딧/i.test(reason) ? "알림톡 잔여 건수를 확인해 주세요."
    : /phone|연락처/i.test(reason) ? "보호자 연락처를 확인해 주세요."
    : "발송 설정과 승인 템플릿 연결을 확인해 주세요.";
  const message = status === "sent" ? "입금 재요청 알림톡을 보냈습니다."
    : status === "mocked" ? "입금 재요청을 모의 발송했습니다. 실제 메시지는 보내지 않았습니다."
    : status === "pending" || status === "processing" ? "입금 재요청 발송 확인 중입니다. 같은 요청을 다시 누르지 마세요."
    : `${status === "blocked" ? "입금 재요청 알림톡을 보내지 않았습니다." : "입금 재요청 알림톡 발송에 실패했습니다."} ${safeReason}`;
  return { status, message };
}

/** One finite scheduler invocation; no timer or activation is installed in production. */
export async function runDepositMaintenance(shopId?: string) {
  const admin = db();
  const tick = await admin.rpc("pm_deposit_tick", { p_shop: shopId ?? null });
  if (tick.error) depositError(tick.error);
  const shops = new Set<string>(shopId ? [shopId] : []);
  if (!shopId) {
    const pending = await admin.from("booking_deposit_outbox")
      .select("booking_deposit_accounts!inner(shop_id)").eq("state", "pending")
      .order("created_at").limit(100);
    if (pending.error) depositError(pending.error);
    for (const row of pending.data ?? []) {
      const account = row.booking_deposit_accounts as unknown as { shop_id: string };
      if (account?.shop_id) shops.add(account.shop_id);
    }
  }
  for (const shop of shops) await flushDepositOutbox(shop);
  return { ...tick.data, deliveryShops: shops.size };
}

type ClockState = { timer: ReturnType<typeof setInterval>; running: boolean; run: () => Promise<void>; lastRunAt?: string; lastResult?: unknown; lastError?: string };
const clockGlobal = globalThis as typeof globalThis & { pmDepositClock?: ClockState };
export function developmentDepositClockStatus() {
  if (serverEnv.supabaseEnvName !== "development") return null;
  const state = clockGlobal.pmDepositClock;
  return state ? { enabled: true, running: state.running, lastRunAt: state.lastRunAt ?? null, lastError: state.lastError ?? null } : { enabled: false };
}
/** Development execution path. Lives in the existing app process; never starts a helper server. */
export function ensureDevelopmentDepositClock() {
  if (serverEnv.supabaseEnvName !== "development" || new URL(serverEnv.supabaseUrl ?? "http://invalid").hostname !== "qefxdtmdtvnzgupmjlom.supabase.co") return;
  const run = async () => {
    const state = clockGlobal.pmDepositClock; if (!state || state.running) return; state.running = true; state.lastRunAt = new Date().toISOString();
    try {
      state.lastResult = await runDepositMaintenance(); state.lastError = undefined;
    } catch { state.lastError = "DEPOSIT_CLOCK_FAILED"; /* Durable outbox is retained; no uncertain provider delivery is retried. */ }
    finally { if (clockGlobal.pmDepositClock) clockGlobal.pmDepositClock.running = false; }
  };
  if (clockGlobal.pmDepositClock) { clockGlobal.pmDepositClock.run = run; return; }
  const timer = setInterval(() => { void clockGlobal.pmDepositClock?.run(); }, 15000); timer.unref?.();
  clockGlobal.pmDepositClock = { timer, running: false, run };
}
