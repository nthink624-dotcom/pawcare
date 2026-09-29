import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { logOperationalEvent } from "@/lib/observability";
import { AdminApiError, requireAdminSession } from "@/server/admin-api-auth";
import { dispatchNotification } from "@/server/notification-dispatch";
import type { ChannelType, Notification, NotificationType } from "@/types/domain";

const notificationTypes = [
  "booking_received",
  "booking_confirmed",
  "owner_booking_requested",
  "booking_cancelled",
  "appointment_reminder_10m",
  "visit_schedule_notice",
  "visit_reminder_notice",
  "grooming_started",
  "grooming_almost_done",
  "grooming_completed",
  "revisit_notice",
  "landing_feedback",
  "waitlist_interest",
  "birthday_greeting",
] as const satisfies readonly NotificationType[];

const channels = ["alimtalk", "sms", "in_app", "mock"] as const satisfies readonly ChannelType[];
const retrySchema = z.object({ notificationId: z.string().uuid() });
const notificationSelect = [
  "id",
  "shop_id",
  "appointment_id",
  "pet_id",
  "guardian_id",
  "type",
  "channel",
  "status",
  "template_key",
  "template_type",
  "metadata",
  "fail_reason",
  "scheduled_at",
  "created_at",
  "sent_at",
].join(",");

function getAdmin() {
  const admin = getSupabaseAdmin();
  if (!admin) throw new AdminApiError("관리자 데이터 연결을 확인하지 못했습니다.", 503);
  return admin;
}

function safeFailureReason(value: unknown) {
  if (typeof value !== "string") return null;
  return value
    .replace(/bearer\s+[^\s]+/gi, "bearer [redacted]")
    .replace(/01[016789][0-9-]{7,9}/g, "[phone-redacted]")
    .slice(0, 240);
}

function safeFailure(item: Partial<Notification>) {
  return {
    id: item.id,
    shopId: item.shop_id,
    appointmentId: item.appointment_id ?? null,
    type: item.type,
    channel: item.channel,
    status: item.status,
    failReason: safeFailureReason(item.fail_reason),
    scheduledAt: item.scheduled_at ?? null,
    createdAt: item.created_at,
    sentAt: item.sent_at ?? null,
  };
}

function parseNotificationType(value: unknown): NotificationType {
  if (typeof value !== "string" || !(notificationTypes as readonly string[]).includes(value)) {
    throw new AdminApiError("재처리할 수 없는 알림 유형입니다.", 422);
  }
  return value as NotificationType;
}

function parseChannel(value: unknown): ChannelType {
  if (typeof value !== "string" || !(channels as readonly string[]).includes(value)) {
    throw new AdminApiError("재처리할 수 없는 알림 채널입니다.", 422);
  }
  return value as ChannelType;
}

async function writeRetryAudit(params: {
  shopId: string;
  appointmentId: string | null;
  guardianId: string | null;
  petId: string | null;
  failedNotificationId: string;
  retryNotificationId: string | null;
  status: string;
}) {
  const admin = getAdmin();
  const result = await admin.from("owner_activity_events").insert({
    shop_id: params.shopId,
    actor_user_id: null,
    actor_label: "admin",
    action_source: "admin",
    action_type: "status_changed",
    entity_type: "notification",
    entity_id: params.failedNotificationId,
    appointment_id: params.appointmentId,
    guardian_id: params.guardianId,
    pet_id: params.petId,
    previous_payload: { status: "failed" },
    next_payload: {
      status: params.status,
      retryNotificationId: params.retryNotificationId,
    },
    note: "admin_notification_retry",
  });
  if (result.error) {
    logOperationalEvent("admin_notification_retry.audit_failed", {
      operation: "owner_activity_events.insert",
      code: "audit_insert_failed",
      status: 500,
    });
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminSession(request);
    const admin = getAdmin();
    const shopId = request.nextUrl.searchParams.get("shopId")?.trim() || null;
    let query = admin
      .from("notifications")
      .select(notificationSelect)
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(100);
    if (shopId) query = query.eq("shop_id", shopId);
    const result = await query;
    if (result.error) throw new AdminApiError("실패한 알림 목록을 불러오지 못했습니다.", 503);
    const failures = (result.data ?? []) as Array<Partial<Notification>>;
    return NextResponse.json({ ok: true, failures: failures.map(safeFailure) });
  } catch (error) {
    const status = error instanceof AdminApiError ? error.status : 500;
    const message = error instanceof AdminApiError ? error.message : "실패한 알림 목록을 불러오지 못했습니다.";
    return NextResponse.json({ ok: false, message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminSession(request);
    const body = retrySchema.parse(await request.json());
    const admin = getAdmin();
    const sourceResult = await admin
      .from("notifications")
      .select(notificationSelect)
      .eq("id", body.notificationId)
      .maybeSingle();
    if (sourceResult.error) throw new AdminApiError("실패한 알림을 확인하지 못했습니다.", 503);
    const source = sourceResult.data as Notification | null;
    if (!source) return NextResponse.json({ ok: false, message: "알림을 찾을 수 없습니다." }, { status: 404 });
    if (source.status !== "failed") {
      return NextResponse.json({ ok: false, message: "실패 상태인 알림만 재처리할 수 있습니다." }, { status: 409 });
    }

    const attachmentResult = await admin
      .from("notification_media_attachments")
      .select("media_asset_id,sort_order")
      .eq("notification_id", source.id)
      .order("sort_order", { ascending: true });
    if (attachmentResult.error) throw new AdminApiError("알림 첨부를 확인하지 못했습니다.", 503);

    const dispatched = await dispatchNotification({
      shopId: source.shop_id,
      appointmentId: source.appointment_id ?? null,
      petId: source.pet_id ?? null,
      guardianId: source.guardian_id ?? null,
      type: parseNotificationType(source.type),
      channel: parseChannel(source.channel),
      templateKey: source.template_key ?? null,
      templateType: source.template_type ?? null,
      mediaAssetIds: ((attachmentResult.data ?? []) as Array<{ media_asset_id: string }>).map(
        (item) => item.media_asset_id,
      ),
      metadata: { retryOfNotificationId: source.id },
      scheduledAt: null,
      skipIfExists: true,
      force: false,
    });

    await writeRetryAudit({
      shopId: source.shop_id,
      appointmentId: source.appointment_id ?? null,
      guardianId: source.guardian_id ?? null,
      petId: source.pet_id ?? null,
      failedNotificationId: source.id,
      retryNotificationId: dispatched.notification.id,
      status: dispatched.notification.status,
    });

    const responseStatus = dispatched.notification.status === "failed" ? 502 : 200;
    return NextResponse.json(
      { ok: responseStatus === 200, notification: safeFailure(dispatched.notification) },
      { status: responseStatus },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, message: "재처리할 알림 ID를 확인해 주세요." }, { status: 400 });
    }
    const status = error instanceof AdminApiError ? error.status : 500;
    const message = error instanceof AdminApiError ? error.message : "알림 재처리에 실패했습니다.";
    return NextResponse.json({ ok: false, message }, { status });
  }
}
