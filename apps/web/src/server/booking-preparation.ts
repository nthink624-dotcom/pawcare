import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { after } from "next/server";
import { DEFAULT_BOOKING_CONSENT_ID, DEFAULT_BOOKING_POLICY, type BookingPolicy, type BookingPreparation, type PreparationResponse } from "@petmanager/shared/contracts/booking-preparation";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { createBookingAccessToken, verifyBookingAccessToken } from "@/server/booking-access-token";
import { OwnerApiError } from "@/server/owner-api-auth";
import { dispatchNotification } from "@/server/notification-dispatch";
import { deliverCustomerBookingNotificationSafely } from "@/lib/customer-booking-notification";
import { getAppointmentWriteErrorMessage } from "@/lib/appointment-write-errors";
import { logOperationalEvent } from "@/lib/observability";

const rule = z.enum(["normal", "approval", "deposit", "blocked"]);
export const bookingPolicySchema = z.object({
  depositMode: z.enum(["off", "optional", "required"]), depositAudience: z.enum(["all", "new", "noshow"]),
  depositAmount: z.number().int().min(1).max(10000000), depositDueHours: z.number().int().min(1).max(720),
  bankName: z.string().trim().max(50), bankAccount: z.string().trim().max(60), bankHolder: z.string().trim().max(50),
  cancellationCutoffHours: z.number().int().min(0).max(720), cancellationNotice: z.string().trim().max(3000),
  firstNoshowRule: rule, repeatNoshowRule: rule, consentBeforeStart: z.boolean(),
  templates: z.array(z.object({
    id: z.string().uuid(), version: z.number().int().positive(), title: z.string().trim().min(1).max(100),
    body: z.string().trim().min(1).max(12000), required: z.boolean(), scope: z.enum(["pet", "appointment"]), enabled: z.boolean(),
    audience: z.enum(["all", "new", "unsigned", "manual"]).default("all"),
    archivedAt: z.string().datetime().optional(),
  })).max(100),
}).superRefine((p, ctx) => {
  if ((p.depositMode !== "off" || p.firstNoshowRule === "deposit" || p.repeatNoshowRule === "deposit") && (!p.bankName || !p.bankAccount || !p.bankHolder))
    ctx.addIssue({ code: "custom", message: "예약금 사용 시 입금 계좌를 모두 입력해 주세요." });
  if (new Set(p.templates.map(t => t.id)).size !== p.templates.length)
    ctx.addIssue({ code: "custom", message: "문서 식별자가 중복되었습니다." });
});
function db() {
  const admin = getSupabaseAdmin();
  if (!admin) throw new OwnerApiError("예약 관리 저장소가 연결되지 않았습니다.", 503);
  return admin;
}
function databaseError(error: { code?: string; message?: string } | null): never {
  if (error?.message?.includes("VERSION_CONFLICT")) throw new OwnerApiError("다른 화면에서 변경되었습니다. 새로 불러온 뒤 다시 처리해 주세요.", 409);
  if (error?.message?.includes("BOOKING_SIGNED_DOCUMENT_IMMUTABLE")) throw new OwnerApiError("이미 서명한 동의서는 변경할 수 없습니다.", 409);
  if (error?.code === "23P01" || /BOOKING_(DEPOSIT_REQUIRED|CONSENT_REQUIRED|ONLINE_RESTRICTED|DEPOSIT_NOT_CONFIGURED|POLICY_CHANGED|NOSHOW_NOT_STARTED)/.test(error?.message ?? ""))
    throw new OwnerApiError(getAppointmentWriteErrorMessage(error ?? {}), 409);
  if (error?.code === "42P01" || error?.code === "PGRST205" || error?.code === "PGRST202")
    throw new OwnerApiError("예약금·동의서 저장소 적용이 필요합니다.", 503);
  throw new OwnerApiError("예약 관리 내용을 저장하지 못했습니다.", 500);
}
export async function readBookingPolicy(shopId: string) {
  const result = await db().from("shop_booking_policies").select("policy,version").eq("shop_id", shopId).maybeSingle();
  if (result.error) databaseError(result.error);
  return { policy: (result.data?.policy ?? DEFAULT_BOOKING_POLICY) as BookingPolicy, version: Number(result.data?.version ?? 0) };
}
export async function readOptionalBookingPolicy(shopId: string) {
  const admin = getSupabaseAdmin(); if (!admin) return null;
  const r = await admin.from("shop_booking_policies").select("policy,version").eq("shop_id", shopId).maybeSingle();
  if (r.error && !["42P01", "PGRST205"].includes(r.error.code)) databaseError(r.error);
  return r.data ? { policy: r.data.policy as BookingPolicy, version: Number(r.data.version) } : null;
}
export async function saveBookingPolicy(shopId: string, input: unknown, version: number) {
  const policy = bookingPolicySchema.parse(input);
  if (!policy.templates.some(template => template.id === DEFAULT_BOOKING_CONSENT_ID && !template.archivedAt))
    throw new OwnerApiError("기본 동의서는 삭제할 수 없습니다. 필요하지 않으면 사용을 꺼 주세요.", 400);
  const current = await readBookingPolicy(shopId);
  if (current.version !== version) throw new OwnerApiError("매장 설정이 변경되었습니다. 다시 불러와 주세요.", 409);
  // Preserve template identifiers and increase the version whenever signed content/semantics change.
  for (const template of policy.templates) {
    const old = current.policy.templates.find(t => t.id === template.id);
    if (!old) { template.version = 1; continue; }
    const changed = ["title", "body", "required", "scope"].some(k => old[k as keyof typeof old] !== template[k as keyof typeof template]);
    template.version = old.version + (changed ? 1 : 0);
  }
  const result = version === 0
    ? await db().from("shop_booking_policies").insert({ shop_id: shopId, policy }).select("version").single()
    : await db().from("shop_booking_policies").update({ policy, version: version + 1, updated_at: new Date().toISOString() }).eq("shop_id", shopId).eq("version", version).select("version").maybeSingle();
  if (result.error?.code === "23505") throw new OwnerApiError("매장 설정이 변경되었습니다. 다시 불러와 주세요.", 409);
  if (result.error) databaseError(result.error);
  if (!result.data) throw new OwnerApiError("매장 설정이 변경되었습니다. 다시 불러와 주세요.", 409);
  return { policy, version: Number(result.data.version) };
}
export async function getPreparation(shopId: string, appointmentId: string, owner = false): Promise<PreparationResponse> {
  const admin = db();
  const [booking, preparation] = await Promise.all([
    admin.from("appointments").select("id,shop_id,guardian_id,pet_id,status,start_at,final_service_price").eq("shop_id", shopId).eq("id", appointmentId).maybeSingle(),
    admin.from("booking_preparations").select("version,data").eq("shop_id", shopId).eq("appointment_id", appointmentId).maybeSingle(),
  ]);
  if (preparation.error) databaseError(preparation.error);
  if (booking.error || !booking.data) throw new OwnerApiError("예약을 찾을 수 없습니다.", 404);
  if (!preparation.data) throw new OwnerApiError("이 예약에는 예약 준비 요청이 없습니다. 정책 저장 후 등록한 예약부터 적용됩니다.", 404);
  const a = booking.data;
  const result: PreparationResponse = {
    appointmentId: a.id, shopId: a.shop_id, guardianId: a.guardian_id, petId: a.pet_id,
    appointmentStatus: a.status, startAt: a.start_at, version: preparation.data.version, data: preparation.data.data as BookingPreparation,
  };
  const balance = result.data.deposit.receivedAmount - result.data.deposit.refundedAmount;
  result.serviceAmount = a.final_service_price ?? null;
  result.remainingAmount = a.final_service_price == null ? null : Math.max(0, a.final_service_price - balance);
  result.excessDeposit = a.final_service_price == null ? 0 : Math.max(0, balance - a.final_service_price);
  const guardian = await admin.from("guardians").select("notification_settings").eq("shop_id", shopId).eq("id", a.guardian_id).maybeSingle();
  if (guardian.error || !guardian.data) throw new OwnerApiError("고객 수신 설정을 확인할 수 없습니다.");
  const settings = guardian.data.notification_settings;
  result.notificationPreferences = { enabled: settings?.enabled !== false, consent: settings?.consent_request_enabled !== false, deposit: settings?.deposit_request_enabled !== false };
  if (owner) {
    const [condition, noshows, livePolicy] = await Promise.all([
      admin.from("guardian_booking_conditions").select("rule").eq("shop_id", shopId).eq("guardian_id", a.guardian_id).maybeSingle(),
      admin.from("appointments").select("id", { count: "exact", head: true }).eq("shop_id", shopId).eq("guardian_id", a.guardian_id).eq("status", "noshow"),
      readBookingPolicy(shopId),
    ]);
    if (condition.error || noshows.error) databaseError(condition.error ?? noshows.error);
    result.nextBookingRule = condition.data?.rule ?? ((noshows.count ?? 0) >= 2 ? livePolicy.policy.repeatNoshowRule : (noshows.count ?? 0) === 1 ? livePolicy.policy.firstNoshowRule : "normal");
    const petTemplates = result.data.policy.templates.filter(t => t.enabled && !t.archivedAt && t.scope === "pet");
    const signedIds = new Set(result.data.consents.filter(c => c.scope === "pet" && c.status === "signed" && petTemplates.some(t => t.id === c.id && t.version === c.version)).map(c => c.id));
    const unresolvedTemplates = petTemplates.filter(t => !signedIds.has(t.id));
    if (unresolvedTemplates.length) {
      const signedRows = await Promise.all(unresolvedTemplates.map(template => admin.from("booking_preparations").select("appointment_id")
        .eq("shop_id", shopId).eq("guardian_id", a.guardian_id).eq("pet_id", a.pet_id)
        .contains("data", { consents: [{ id: template.id, version: template.version, status: "signed" }] })
        .order("updated_at", { ascending: false }).limit(1).maybeSingle()));
      for (let i = 0; i < unresolvedTemplates.length; i++) {
        if (signedRows[i].error) databaseError(signedRows[i].error);
        if (signedRows[i].data) signedIds.add(unresolvedTemplates[i].id);
      }
    }
    result.signedPetConsentIds = [...signedIds];
    const token = createBookingAccessToken({ shopId, guardianId: a.guardian_id, petId: a.pet_id, appointmentId, action: "manage" });
    result.manageUrl = `/book/${encodeURIComponent(shopId)}/manage?t=${encodeURIComponent(token)}`;
  }
  return result;
}
export async function initializePreparation(shopId: string, appointmentId: string) {
  const admin = db(), p = await readBookingPolicy(shopId);
  if (!p.version) throw new OwnerApiError("매장 정보에서 예약 정책을 먼저 저장해 주세요.");
  const a = await admin.from("appointments").select("id,guardian_id,pet_id,status").eq("shop_id", shopId).eq("id", appointmentId).maybeSingle();
  if (!a.data || !["pending", "confirmed"].includes(a.data.status)) throw new OwnerApiError("대기·확정 예약에서만 요청을 만들 수 있습니다.");
  const visits = await admin.from("appointments").select("id", { head: true, count: "exact" }).eq("shop_id", shopId).eq("guardian_id", a.data.guardian_id).in("status", ["completed", "in_progress", "almost_done"]);
  if (visits.error) databaseError(visits.error);
  const data: BookingPreparation = {
    policy: p.policy, policyVersion: p.version,
    deposit: { status: "not_requested", required: false, amount: p.policy.depositAmount, receivedAmount: 0, refundedAmount: 0, dueAt: null, payerName: "", reportedAt: null, confirmedAt: null, confirmedBy: null },
    consents: p.policy.templates.filter(t => t.enabled && !t.archivedAt && t.audience !== "manual" && (t.audience !== "new" || !visits.count)).map(t => ({ ...t, status: "pending" as const })),
    cancellation: null, history: [], requests: [],
  };
  const [guardian, pet] = await Promise.all([
    admin.from("guardians").select("name").eq("shop_id", shopId).eq("id", a.data.guardian_id).maybeSingle(),
    admin.from("pets").select("name").eq("shop_id", shopId).eq("id", a.data.pet_id).maybeSingle(),
  ]);
  if (guardian.error || pet.error || !guardian.data || !pet.data) throw new OwnerApiError("예약자와 반려동물 정보를 확인할 수 없습니다.");
  data.guardianName = guardian.data.name; data.petName = pet.data.name;
  for (const template of data.consents) {
    if (template.scope !== "pet") continue;
    const old = await admin.from("booking_preparations").select("data").eq("shop_id", shopId).eq("guardian_id", a.data.guardian_id).eq("pet_id", a.data.pet_id)
      .contains("data", { consents: [{ id: template.id, version: template.version, status: "signed" }] }).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (old.error) databaseError(old.error);
    const signed = (old.data?.data as BookingPreparation | undefined)?.consents.find(c => c.id === template.id && c.version === template.version && c.status === "signed");
    if (signed) data.consents[data.consents.indexOf(template)] = signed;
  }
  // Existing bookings are not retroactively made deposit-required without owner action.
  const r = await admin.from("booking_preparations").insert({ appointment_id: appointmentId, shop_id: shopId, guardian_id: a.data.guardian_id, pet_id: a.data.pet_id, data });
  if (r.error && r.error.code !== "23505") databaseError(r.error);
  return getPreparation(shopId, appointmentId, true);
}
export async function listConsentArchive(shopId: string, cursor?: string, guardianId?: string, petId?: string) {
  let q = db().from("booking_preparations").select("appointment_id,guardian_id,pet_id,data").eq("shop_id", shopId).order("appointment_id").limit(21);
  if (cursor) q = q.gt("appointment_id", cursor);
  if (guardianId) q = q.eq("guardian_id", guardianId);
  if (petId) q = q.eq("pet_id", petId);
  const r = await q; if (r.error) databaseError(r.error);
  const rows = (r.data ?? []).slice(0, 20);
  return { documents: rows.flatMap(row => (row.data as BookingPreparation).consents.filter(c => c.status === "signed").map(document => ({ appointmentId: row.appointment_id, guardianId: row.guardian_id, petId: row.pet_id, guardianName: (row.data as BookingPreparation).guardianName, petName: (row.data as BookingPreparation).petName, document }))), nextCursor: (r.data?.length ?? 0) > 20 ? rows.at(-1)?.appointment_id ?? null : null };
}
export async function authorizePreparationToken(token: string, appointmentId: string) {
  let access: ReturnType<typeof verifyBookingAccessToken>;
  try { access = verifyBookingAccessToken(token); }
  catch { throw new OwnerApiError("예약 확인 링크가 만료되었거나 올바르지 않습니다.", 401); }
  if (access.action !== "manage" || (access.appointmentId && access.appointmentId !== appointmentId)) throw new OwnerApiError("이 예약에 접근할 수 없습니다.", 403);
  const result = await getPreparation(access.shopId, appointmentId);
  if (result.guardianId !== access.guardianId || result.petId !== access.petId) throw new OwnerApiError("이 예약에 접근할 수 없습니다.", 403);
  return result;
}
export const preparationActionSchema = z.object({
  action: z.enum(["request_deposit", "report_deposit", "confirm_deposit", "correct_deposit", "waive_deposit", "refund_record", "sign", "add_consent", "waive_consent", "cancel", "request_cancel", "noshow", "correct_noshow", "set_condition", "set_preferences", "approve", "request_guidance", "auto_request_required_consent"]),
  rule: rule.optional(),
  cancellationKind: z.enum(["owner", "customer", "late_customer"]).optional(),
  version: z.number().int().positive(), note: z.string().trim().max(2000).default(""),
  amount: z.number().int().min(0).max(10000000).optional(), payerName: z.string().trim().max(50).optional(),
  templateId: z.string().uuid().optional(), signerName: z.string().trim().min(1).max(50).optional(),
  signature: z.array(z.array(z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })).min(2).max(1500)).min(1).max(40).optional(),
  agreed: z.literal(true).optional(), consent: z.boolean().optional(), deposit: z.boolean().optional(),
});
export async function actOnPreparation(current: PreparationResponse, raw: unknown, actor: { kind: "owner" | "customer" | "system"; userId: string | null }) {
  const input = preparationActionSchema.parse(raw);
  if (actor.kind === "system" && input.action !== "auto_request_required_consent") throw new OwnerApiError("처리 권한이 없습니다.", 403);
  if (input.action === "auto_request_required_consent" && actor.kind !== "system") throw new OwnerApiError("처리 권한이 없습니다.", 403);
  if (input.version !== current.version) throw new OwnerApiError("예약 내용이 변경되었습니다. 다시 불러와 주세요.", 409);
  if (actor.kind === "customer" && !["report_deposit", "sign", "cancel", "request_cancel", "set_preferences"].includes(input.action)) throw new OwnerApiError("처리 권한이 없습니다.", 403);
  if (actor.kind === "owner" && ["sign", "set_preferences"].includes(input.action)) throw new OwnerApiError("보호자가 직접 처리해야 합니다.", 403);
  const data = structuredClone(current.data), deposit = data.deposit, now = new Date().toISOString();
  const previousReceipt = deposit.receivedAmount;
  const active = ["pending", "confirmed"].includes(current.appointmentStatus);
  let nextStatus: string | null = null, nextRule: string | null = null;
  let consentRequestId: string | null = null;
  let preferences: { consent: boolean; deposit: boolean } | null = null;
  if (!active && !["refund_record", "correct_noshow", "set_condition", "set_preferences"].includes(input.action)) throw new OwnerApiError("진행 중이거나 종료된 예약은 이 작업을 처리할 수 없습니다.", 409);
  switch (input.action) {
    case "set_preferences":
      if (typeof input.consent !== "boolean" || typeof input.deposit !== "boolean") throw new OwnerApiError("수신 설정을 확인해 주세요.");
      preferences = { consent: input.consent, deposit: input.deposit }; break;
    case "add_consent": {
      const template = data.policy.templates.find(t => t.id === input.templateId && t.enabled && !t.archivedAt);
      if (!template || data.consents.some(t => t.id === template.id)) throw new OwnerApiError("추가 가능한 동의서를 선택해 주세요.");
      let signed: BookingPreparation["consents"][number] | undefined;
      if (template.scope === "pet") {
        const old = await db().from("booking_preparations").select("data").eq("shop_id", current.shopId).eq("guardian_id", current.guardianId).eq("pet_id", current.petId)
          .contains("data", { consents: [{ id: template.id, version: template.version, status: "signed" }] }).order("updated_at", { ascending: false }).limit(1).maybeSingle();
        if (old.error) databaseError(old.error);
        signed = (old.data?.data as BookingPreparation | undefined)?.consents.find(t => t.id === template.id && t.version === template.version && t.status === "signed");
        if (signed) throw new OwnerApiError("이 반려동물은 현재 동의서에 이미 서명했습니다.");
      }
      data.consents.push({ ...template, status: "pending" }); break;
    }
    case "set_condition":
      if (!input.note || !input.rule) throw new OwnerApiError("다음 예약 조건과 변경 사유를 입력해 주세요.");
      if (input.rule === "deposit" && !(await readBookingPolicy(current.shopId)).policy.bankAccount) throw new OwnerApiError("예약금 계좌를 먼저 설정해 주세요.");
      nextRule = input.rule; break;
    case "correct_noshow":
      if (current.appointmentStatus !== "noshow" || !input.note) throw new OwnerApiError("노쇼 기록과 정정 사유를 확인해 주세요.");
      data.cancellation = null; nextStatus = "confirmed"; break;
    case "request_cancel":
      if (!input.note) throw new OwnerApiError("취소 요청 사유를 입력해 주세요.");
      data.cancelRequest = { reason: input.note, at: now }; break;
    case "request_deposit":
      if (!["not_requested", "cancelled"].includes(deposit.status)) throw new OwnerApiError("이미 요청되었거나 확인된 예약금입니다.", 409);
      if (!data.policy.bankAccount || !data.policy.bankHolder || data.policy.depositMode === "off") throw new OwnerApiError("매장 예약금 설정을 먼저 확인해 주세요.");
      deposit.status = "pending";
      deposit.dueAt = new Date(Math.min(Date.now() + data.policy.depositDueHours * 3600000, Date.parse(current.startAt))).toISOString();
      if (Date.parse(deposit.dueAt) <= Date.now()) throw new OwnerApiError("납부 기한을 확보할 수 없습니다. 매장에 문의해 주세요.");
      break;
    case "report_deposit":
      if (!["pending", "reported"].includes(deposit.status)) throw new OwnerApiError("현재 입금 신고를 받을 수 없습니다.", 409);
      if (!input.payerName) throw new OwnerApiError("입금자명을 입력해 주세요.");
      deposit.status = "reported"; deposit.payerName = input.payerName; deposit.reportedAt = now; break;
    case "confirm_deposit":
      if (!["pending", "reported"].includes(deposit.status)) throw new OwnerApiError("확인 대기 중인 예약금만 처리할 수 있습니다.", 409);
      if (input.amount === undefined || input.amount < deposit.amount || !input.payerName) throw new OwnerApiError("실제 입금액과 입금자명을 확인해 주세요. 부족 입금은 납부 완료 처리할 수 없습니다.");
      deposit.status = "confirmed"; deposit.receivedAmount = input.amount; deposit.payerName = input.payerName;
      deposit.confirmedAt = now; deposit.confirmedBy = actor.userId;
      if (deposit.required && current.appointmentStatus === "pending" && !data.approvalRequired) nextStatus = "confirmed";
      break;
    case "waive_deposit":
      if (!input.note) throw new OwnerApiError("면제 사유를 입력해 주세요.");
      if (deposit.receivedAmount - deposit.refundedAmount > 0) throw new OwnerApiError("입금된 예약금은 면제 대신 환불로 처리해 주세요.");
      deposit.status = "waived";
      if (deposit.required && current.appointmentStatus === "pending" && !data.approvalRequired) nextStatus = "confirmed";
      break;
    case "correct_deposit":
      if (deposit.status !== "confirmed" || deposit.refundedAmount > 0 || input.amount === undefined || !input.note)
        throw new OwnerApiError("환불 전 입금 확인 내역과 정정 사유를 확인해 주세요.");
      deposit.receivedAmount = input.amount; deposit.payerName = input.payerName || deposit.payerName;
      if (input.amount < deposit.amount) {
        deposit.status = "reported"; deposit.confirmedAt = null; deposit.confirmedBy = null;
        if (deposit.required && current.appointmentStatus === "confirmed") nextStatus = "pending";
      }
      break;
    case "refund_record":
      if (!input.note || !input.amount || deposit.receivedAmount <= 0 || input.amount > deposit.receivedAmount - deposit.refundedAmount)
        throw new OwnerApiError("실제 환불액과 처리 사유를 확인해 주세요.");
      deposit.refundedAmount += input.amount;
      if (deposit.refundedAmount === deposit.receivedAmount) deposit.status = "refunded";
      break;
    case "sign": {
      const doc = data.consents.find(t => t.id === input.templateId);
      if (!doc || doc.status !== "pending") throw new OwnerApiError("작성 대기 중인 동의서를 찾을 수 없습니다.", 409);
      if (!input.signature || !input.signerName || input.agreed !== true) throw new OwnerApiError("내용 확인과 서명을 완료해 주세요.");
      const points = input.signature.flat();
      if (points.length > 12000 || Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x)) < 0.02)
        throw new OwnerApiError("서명창에 직접 서명해 주세요.");
      doc.status = "signed"; doc.signerName = input.signerName; doc.signedAt = now; doc.signature = input.signature; break;
    }
    case "waive_consent": {
      const doc = data.consents.find(t => t.id === input.templateId);
      if (!doc || doc.status !== "pending" || !input.note) throw new OwnerApiError("작성 대기 문서와 예외 사유를 확인해 주세요.");
      doc.status = "waived"; doc.waivedReason = input.note; break;
    }
    case "cancel": case "noshow":
      if (!input.note) throw new OwnerApiError("처리 사유를 입력해 주세요.");
      if (input.action === "noshow" && (current.appointmentStatus !== "confirmed" || Date.now() < Date.parse(current.startAt)))
        throw new OwnerApiError("예약 시작 시간이 지난 확정 예약만 노쇼 처리할 수 있습니다.");
      if (actor.kind === "customer" && Date.now() > Date.parse(current.startAt) - data.policy.cancellationCutoffHours * 3600000)
        throw new OwnerApiError("직접 취소 가능 시간이 지났습니다. 매장에 취소를 요청해 주세요.");
      data.cancellation = { kind: input.action === "noshow" ? "noshow" : actor.kind === "owner" ? input.cancellationKind ?? (data.cancelRequest ? "late_customer" : "owner") : "customer", reason: actor.kind === "customer" ? input.note : input.action === "noshow" ? "예약 미방문으로 기록되었습니다." : "매장에서 취소 처리했습니다.", at: now };
      data.cancelRequest = null;
      if (["pending", "reported", "not_requested"].includes(deposit.status)) deposit.status = "cancelled";
      nextStatus = input.action === "noshow" ? "noshow" : "cancelled"; break;
    case "approve":
      if (current.appointmentStatus !== "pending") throw new OwnerApiError("승인 대기 중인 예약이 아닙니다.");
      if (deposit.required && !["confirmed", "waived"].includes(deposit.status)) throw new OwnerApiError("예약금을 확인하거나 면제한 뒤 승인해 주세요.");
      nextStatus = "confirmed"; break;
    case "request_guidance": case "auto_request_required_consent": {
      const automatic = input.action === "auto_request_required_consent";
      if (automatic) {
        if (current.appointmentStatus !== "confirmed" || !data.consents.some(c => c.required && c.status === "pending")) break;
        if (deposit.required && !["confirmed", "waived"].includes(deposit.status)) break;
        if (data.requests.some(r => r.purposes.includes("consent"))) break;
      } else {
        if (!input.consent) throw new OwnerApiError("\uB3D9\uC758\uC11C \uC694\uCCAD\uB9CC \uC54C\uB9BC\uD1A1\uC73C\uB85C \uBCF4\uB0BC \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
        if (input.deposit) throw new OwnerApiError("\uC608\uC57D\uAE08 \uC694\uCCAD \uC54C\uB9BC\uD1A1\uC740 \uBCC4\uB3C4 \uD15C\uD50C\uB9BF \uC2B9\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4. \uC608\uC57D\uAE08\uC744 \uC120\uD0DD \uD574\uC81C\uD558\uACE0 \uB3D9\uC758\uC11C \uC694\uCCAD\uC744 \uBCF4\uB0B4 \uC8FC\uC138\uC694.");
        if (!data.consents.some(c => c.status === "pending")) throw new OwnerApiError("\uC791\uC131 \uB300\uAE30 \uC911\uC778 \uB3D9\uC758\uC11C\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.");
        const previousRequest = [...data.requests].reverse().find(r => r.purposes.includes("consent") && ["sending", "queued", "sent"].includes(r.status));
        if (previousRequest) throw new OwnerApiError("\uC774 \uC608\uC57D\uC758 \uB3D9\uC758\uC11C \uC694\uCCAD\uC740 \uC774\uBBF8 \uBC1C\uC1A1\uD588\uAC70\uB098 \uCC98\uB9AC \uC911\uC785\uB2C8\uB2E4.", 409);
      }
      const prefs = current.notificationPreferences;
      const preferenceBlocked = prefs?.enabled === false || prefs?.consent === false;
      if (preferenceBlocked && !automatic) throw new OwnerApiError("고객이 동의서 요청 알림 수신을 꺼 두었습니다.", 409);
      consentRequestId = randomUUID();
      data.requests.push({ id: consentRequestId, at: now, purposes: ["consent"], status: preferenceBlocked ? "blocked" : "sending", reason: preferenceBlocked ? "고객이 동의서 알림 수신을 꺼 두었습니다." : "\uC54C\uB9BC\uD1A1 \uBC1C\uC1A1\uC744 \uD655\uC778\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4." });
      break;
    }
  }
  data.history.push({ action: input.action, at: now, actor: actor.kind === "system" ? "system" : actor.kind === "customer" ? "customer" : actor.userId ?? "owner", note:
    ["confirm_deposit", "correct_deposit", "refund_record"].includes(input.action)
      ? `${input.note} · 이전 입금 ${previousReceipt}원 · 현재 입금 ${deposit.receivedAmount}원 · 누적 환불 ${deposit.refundedAmount}원` : input.note });
  const result = await db().rpc("save_booking_preparation", { p_shop: current.shopId, p_appointment: current.appointmentId, p_version: current.version, p_data: data, p_status: nextStatus, p_rule: nextRule, p_preferences: preferences });
  if (result.error) databaseError(result.error);
  if (consentRequestId) {
    const createdRequest = data.requests.find(item => item.id === consentRequestId);
    let requestStatus: BookingPreparation["requests"][number]["status"] = createdRequest?.status === "blocked" ? "blocked" : "failed";
    let requestReason = createdRequest?.status === "blocked" ? createdRequest.reason : "\uC54C\uB9BC\uD1A1 \uBC1C\uC1A1\uC744 \uCC98\uB9AC\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uBC1C\uC1A1 \uC774\uB825\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694.";
    if (createdRequest?.status !== "blocked") {
      try {
        const delivery = await dispatchNotification({
          shopId: current.shopId, appointmentId: current.appointmentId,
          guardianId: current.guardianId, petId: current.petId,
          type: "booking_consent_request", channel: "alimtalk", skipIfExists: true,
          metadata: { bookingPreparationRequestId: consentRequestId },
        });
        if (delivery.notification.status === "sent") {
          requestStatus = "sent";
          requestReason = "동의서 요청 알림톡을 보냈습니다.";
        } else if (delivery.notification.status === "queued") {
          requestStatus = "queued";
          requestReason = delivery.notification.fail_reason || "\uC54C\uB9BC\uD1A1 \uBC1C\uC1A1 \uB300\uAE30 \uC911\uC785\uB2C8\uB2E4.";
        } else if (delivery.notification.status === "skipped") {
          requestStatus = "blocked";
          requestReason = delivery.notification.fail_reason || "수신 설정 또는 중복 발송 방지 조건으로 보내지 않았습니다.";
        } else if (delivery.notification.status === "mocked") {
          requestReason = "테스트 모드에서는 실제 알림톡을 보내지 않았습니다.";
        } else {
          requestReason = delivery.notification.fail_reason || requestReason;
        }
      } catch {
        // Keep provider responses and secrets out of the owner UI.
      }
    }
    const latest = await getPreparation(current.shopId, current.appointmentId, actor.kind === "owner");
    const settled = structuredClone(latest.data);
    const request = settled.requests.find(item => item.id === consentRequestId);
    if (request) { request.status = requestStatus; request.reason = requestReason; }
    settled.history.push({ action: input.action, at: new Date().toISOString(), actor: actor.kind === "system" ? "system" : actor.userId ?? "owner", note: requestReason });
    const settledResult = await db().rpc("save_booking_preparation", {
      p_shop: current.shopId, p_appointment: current.appointmentId, p_version: latest.version,
      p_data: settled, p_status: null, p_rule: null, p_preferences: null,
    });
    if (settledResult.error) databaseError(settledResult.error);
  }

  if ((nextStatus === "confirmed" && input.action !== "correct_noshow") || (input.action === "cancel" && data.cancellation?.kind === "owner")) {
    const type = nextStatus === "confirmed" ? "booking_confirmed" as const : "booking_cancelled" as const;
    const task = () => deliverCustomerBookingNotificationSafely({ shopId: current.shopId, appointmentId: current.appointmentId,
      guardianId: current.guardianId, petId: current.petId, type, channel: "alimtalk", skipIfExists: true }, dispatchNotification)
      .then(() => nextStatus === "confirmed" ? requestRequiredConsentAfterConfirmation(current.shopId, current.appointmentId) : undefined);
    try { after(task); } catch { await task(); }
  }
  return getPreparation(current.shopId, current.appointmentId, actor.kind === "owner");
}

/** Automatically requests only required, still-pending consent after the booking is confirmed. */
export async function requestRequiredConsentAfterConfirmation(shopId: string, appointmentId: string) {
  try {
    const current = await getPreparation(shopId, appointmentId, true);
    if (current.appointmentStatus !== "confirmed") return;
    if (!current.data.consents.some(consent => consent.required && consent.status === "pending")) return;
    if (current.data.deposit.required && !["confirmed", "waived"].includes(current.data.deposit.status)) return;
    if (current.data.requests.some(request => request.purposes.includes("consent"))) return;
    await actOnPreparation(current, { action: "auto_request_required_consent", version: current.version }, { kind: "system", userId: null });
  } catch (error) {
    if (!(error instanceof OwnerApiError && [404, 409].includes(error.status))) {
      logOperationalEvent("booking_consent_auto_request.failed", {
        operation: "booking_consent_auto_request",
        code: error instanceof OwnerApiError ? `http_${error.status}` : "unexpected",
        status: error instanceof OwnerApiError ? error.status : 500,
      });
    }
  }
}

/** Existing installations keep their legacy cutoff until the new migration/policy exists. */
export async function cancellationCutoffHours(shopId: string, appointmentId: string) {
  const admin = getSupabaseAdmin(); if (!admin) return 2;
  const r = await admin.from("booking_preparations").select("data").eq("shop_id", shopId).eq("appointment_id", appointmentId).maybeSingle();
  if (r.error && !["42P01", "PGRST205"].includes(r.error.code)) databaseError(r.error);
  return Number(r.data?.data?.policy?.cancellationCutoffHours ?? 2);
}
