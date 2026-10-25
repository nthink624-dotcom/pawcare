import { after, NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { assertOwnerOrManager, requireOwnerShop, OwnerApiError } from "@/server/owner-api-auth";
import { flushDepositOutbox, depositError, ensureDevelopmentDepositClock, developmentDepositClockStatus } from "@/server/booking-deposit-ledger";
import { getPreparation } from "@/server/booking-preparation";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";
import type { BookingDepositNotice } from "@petmanager/shared/contracts/booking-deposit-notice";
const cors = { methods: "GET, PATCH, OPTIONS" };
export function OPTIONS(request: NextRequest) { return ownerMobileCorsPreflight(request, cors); }
const headers = { "Cache-Control": "no-store" };
const customerSchema = z.object({ guardianId: z.string().uuid(), depositException: z.enum(["inherit", "always", "exempt"]), establishedCustomer: z.boolean() });
export async function GET(request: NextRequest) {
  try {
    const owner = await requireOwnerShop(request, request.nextUrl.searchParams.get("shopId") ?? undefined); assertOwnerOrManager(owner);
    const admin = getSupabaseAdmin(); if (!admin) throw new OwnerApiError("저장소를 확인해 주세요.", 503);
    if (request.nextUrl.searchParams.get("clock") === "1") return ownerMobileCorsJson(request, { clock: developmentDepositClockStatus() }, { headers }, cors);
    const id = request.nextUrl.searchParams.get("guardianId");
    if (id) {
      const guardian = await admin.from("guardians").select("id,deposit_exception,established_customer").eq("shop_id", owner.shopId).eq("id", z.string().uuid().parse(id)).maybeSingle();
      if (guardian.error || !guardian.data) throw new OwnerApiError("고객을 찾을 수 없습니다.", 404);
      return ownerMobileCorsJson(request, guardian.data, { headers }, cors);
    }
    ensureDevelopmentDepositClock();
    const notices = await admin.rpc("pm_deposit_notices", { p_shop: owner.shopId, p_user: owner.userId });
    if (notices.error) depositError(notices.error);
    return ownerMobileCorsJson(request, { notices: notices.data }, { headers }, cors);
  } catch (error) { return failure(error, request); }
}
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json(); const owner = await requireOwnerShop(request, body.shopId); assertOwnerOrManager(owner);
    const admin = getSupabaseAdmin(); if (!admin) throw new OwnerApiError("저장소를 확인해 주세요.", 503);
    if (body.action === "acknowledge") {
      const input = z.object({ accountId: z.string().uuid(), noticeKey: z.string().min(1).max(180) }).parse(body);
      const current = await admin.rpc("pm_deposit_notices", { p_shop: owner.shopId, p_user: owner.userId });
      if (current.error) depositError(current.error);
      if (!(current.data as BookingDepositNotice[]).some(n => n.accountId === input.accountId && n.key === input.noticeKey)) {
        // An idempotent retry is permitted only for an account in this shop.
        const account = await admin.from("booking_deposit_accounts").select("id").eq("shop_id", owner.shopId).eq("id", input.accountId).maybeSingle();
        if (account.error || !account.data) throw new OwnerApiError("알림을 찾을 수 없습니다.", 404);
        return ownerMobileCorsJson(request, { acknowledged: true }, { headers }, cors);
      }
      const saved = await admin.from("booking_deposit_notice_reads").upsert({ account_id: input.accountId, user_id: owner.userId, notice_key: input.noticeKey }, { onConflict: "account_id,user_id,notice_key", ignoreDuplicates: true });
      if (saved.error) depositError(saved.error);
      return ownerMobileCorsJson(request, { acknowledged: true }, { headers }, cors);
    }
    if (body.action === "carry" || body.action === "refund_source") {
      const input = z.object({ appointmentId: z.string().uuid(), sourceAccountId: z.string().uuid(), amount: z.number().int().positive().max(10000000), requestKey: z.string().uuid(), note: z.string().trim().max(2000).optional() }).parse(body);
      const changed = body.action === "carry" ? await admin.rpc("pm_deposit_carry", { p_shop: owner.shopId, p_destination: input.appointmentId, p_source: input.sourceAccountId, p_amount: input.amount, p_key: input.requestKey, p_actor: owner.userId })
        : await admin.rpc("pm_deposit_refund_source", { p_shop: owner.shopId, p_appointment: input.appointmentId, p_source: input.sourceAccountId, p_amount: input.amount, p_key: input.requestKey, p_actor: owner.userId, p_note: input.note ?? "" });
      if (changed.error) depositError(changed.error);
      after(() => flushDepositOutbox(owner.shopId));
      return ownerMobileCorsJson(request, await getPreparation(owner.shopId, input.appointmentId), { headers }, cors);
    }
    const input = customerSchema.parse(body);
    const changed = await admin.rpc("pm_deposit_set_customer", { p_shop: owner.shopId, p_guardian: input.guardianId,
      p_exception: input.depositException, p_established: input.establishedCustomer, p_actor: owner.userId });
    if (changed.error) depositError(changed.error);
    return ownerMobileCorsJson(request, { saved: true }, { headers }, cors);
  } catch (error) { return failure(error, request); }
}
function failure(error: unknown, request: NextRequest) { return ownerMobileCorsJson(request, { message: error instanceof OwnerApiError ? error.message : "예약금 정보를 확인해 주세요." }, { status: error instanceof OwnerApiError ? error.status : 400, headers }, cors); }
