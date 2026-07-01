import { ownerPlanAllowsAutomaticVisitReminder, type OwnerPlanCode } from "@/lib/billing/owner-plans";
import { normalizeShopNotificationSettings } from "@/lib/notification-settings";
import { hasSupabaseServerEnv } from "@/lib/server-env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { dispatchNotification } from "@/server/notification-dispatch";
import type { Appointment, ShopNotificationSettings } from "@/types/domain";

type ReminderCandidate = Pick<
  Appointment,
  "id" | "shop_id" | "guardian_id" | "pet_id" | "status" | "start_at" | "visit_reminder_offset_minutes"
>;

type ShopReminderSettings = {
  id: string;
  owner_user_id: string | null;
  notification_settings: Partial<ShopNotificationSettings> | null;
};

type SubscriptionPlanRecord = {
  shop_id: string;
  current_plan_code: OwnerPlanCode | string | null;
  subscription_status: string | null;
};

type AutomaticVisitNoticeType = "visit_schedule_notice" | "visit_reminder_notice";

export type ProcessVisitReminderResult = {
  ok: boolean;
  scanned: number;
  dispatched: number;
  skipped: number;
  failed: number;
  reasons: Array<{
    appointmentId: string;
    reason: string;
  }>;
};

const MAX_VISIT_REMINDER_OFFSET_MINUTES = 180;
const VISIT_SCHEDULE_NOTICE_MIN_AHEAD_MINUTES = 24 * 60;
const VISIT_SCHEDULE_NOTICE_MAX_AHEAD_MINUTES = 72 * 60;
const DEFAULT_LOOKBACK_MINUTES = 15;
const DEFAULT_LIMIT = 100;

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function normalizeLimit(value: number | null | undefined) {
  if (!Number.isFinite(value ?? NaN)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.round(value ?? DEFAULT_LIMIT), 1), 300);
}

function isDueForVisitReminder(appointment: ReminderCandidate, now: Date, lookbackMinutes: number) {
  const startAt = new Date(appointment.start_at);
  if (Number.isNaN(startAt.getTime())) return false;

  const offsetMinutes =
    typeof appointment.visit_reminder_offset_minutes === "number"
      ? Math.min(Math.max(Math.round(appointment.visit_reminder_offset_minutes), 0), MAX_VISIT_REMINDER_OFFSET_MINUTES)
      : 10;
  const dueAt = addMinutes(startAt, -offsetMinutes);
  const oldestDueAt = addMinutes(now, -lookbackMinutes);

  return dueAt.getTime() <= now.getTime() && dueAt.getTime() >= oldestDueAt.getTime();
}

function getMinutesUntilStart(appointment: ReminderCandidate, now: Date) {
  const startAt = new Date(appointment.start_at);
  if (Number.isNaN(startAt.getTime())) return null;
  return Math.floor((startAt.getTime() - now.getTime()) / 60_000);
}

function isDueForVisitScheduleNotice(appointment: ReminderCandidate, now: Date) {
  const minutesUntilStart = getMinutesUntilStart(appointment, now);
  if (minutesUntilStart === null) return false;
  return (
    minutesUntilStart >= VISIT_SCHEDULE_NOTICE_MIN_AHEAD_MINUTES &&
    minutesUntilStart <= VISIT_SCHEDULE_NOTICE_MAX_AHEAD_MINUTES
  );
}

function isPlanActiveForAutomaticReminders(record: SubscriptionPlanRecord | null | undefined) {
  const planCode = record?.current_plan_code ?? "quarterly";
  if (!ownerPlanAllowsAutomaticVisitReminder(planCode)) return false;

  const status = record?.subscription_status ?? "trialing";
  return status === "trialing" || status === "trial_will_end" || status === "active";
}

function pushReason(
  result: Pick<ProcessVisitReminderResult, "reasons">,
  appointmentId: string,
  reason: string,
) {
  result.reasons.push({ appointmentId, reason });
}

async function dispatchAutomaticVisitNotice(params: {
  appointment: ReminderCandidate;
  type: AutomaticVisitNoticeType;
}) {
  return dispatchNotification({
    shopId: params.appointment.shop_id,
    appointmentId: params.appointment.id,
    guardianId: params.appointment.guardian_id,
    petId: params.appointment.pet_id,
    type: params.type,
    channel: "alimtalk",
    metadata: {
      source:
        params.type === "visit_schedule_notice"
          ? "automatic_visit_schedule_notice_processor"
          : "automatic_visit_reminder_processor",
    },
  });
}

export async function processAutomaticVisitReminders(options?: {
  now?: Date;
  lookbackMinutes?: number;
  limit?: number;
}): Promise<ProcessVisitReminderResult> {
  const result: ProcessVisitReminderResult = {
    ok: true,
    scanned: 0,
    dispatched: 0,
    skipped: 0,
    failed: 0,
    reasons: [],
  };

  if (!hasSupabaseServerEnv()) {
    result.ok = false;
    return { ...result, reasons: [{ appointmentId: "system", reason: "Supabase server environment is not configured." }] };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    result.ok = false;
    return { ...result, reasons: [{ appointmentId: "system", reason: "Supabase admin client is not available." }] };
  }

  const now = options?.now ?? new Date();
  const lookbackMinutes = Math.min(Math.max(Math.round(options?.lookbackMinutes ?? DEFAULT_LOOKBACK_MINUTES), 1), 60);
  const limit = normalizeLimit(options?.limit);
  const startLowerBound = addMinutes(now, -lookbackMinutes).toISOString();
  const startUpperBound = addMinutes(now, VISIT_SCHEDULE_NOTICE_MAX_AHEAD_MINUTES).toISOString();

  const { data: appointments, error: appointmentsError } = await supabase
    .from("appointments")
    .select("id, shop_id, guardian_id, pet_id, status, start_at, visit_reminder_offset_minutes")
    .eq("status", "confirmed")
    .gte("start_at", startLowerBound)
    .lte("start_at", startUpperBound)
    .order("start_at", { ascending: true })
    .limit(limit);

  if (appointmentsError) {
    result.ok = false;
    return { ...result, reasons: [{ appointmentId: "system", reason: appointmentsError.message }] };
  }

  const candidates = ((appointments ?? []) as ReminderCandidate[]).filter(
    (appointment) =>
      isDueForVisitScheduleNotice(appointment, now) ||
      isDueForVisitReminder(appointment, now, lookbackMinutes),
  );

  result.scanned = candidates.length;
  if (candidates.length === 0) return result;

  const shopIds = Array.from(new Set(candidates.map((appointment) => appointment.shop_id)));
  const { data: shops, error: shopsError } = await supabase
    .from("shops")
    .select("id, owner_user_id, notification_settings")
    .in("id", shopIds);

  if (shopsError) {
    result.ok = false;
    return { ...result, reasons: [{ appointmentId: "system", reason: shopsError.message }] };
  }

  const shopById = new Map((shops ?? []).map((shop) => [shop.id, shop as ShopReminderSettings]));
  const { data: subscriptions } = await supabase
    .from("owner_subscriptions")
    .select("shop_id, current_plan_code, subscription_status")
    .in("shop_id", shopIds);
  const subscriptionByShopId = new Map(
    ((subscriptions ?? []) as SubscriptionPlanRecord[]).map((subscription) => [subscription.shop_id, subscription]),
  );

  for (const appointment of candidates) {
    const shop = shopById.get(appointment.shop_id);
    if (!shop) {
      result.skipped += 1;
      pushReason(result, appointment.id, "Shop not found.");
      continue;
    }

    const settings = normalizeShopNotificationSettings(shop.notification_settings);
    if (
      !settings.enabled ||
      !settings.appointment_reminder_10m_enabled ||
      settings.appointment_reminder_10m_mode !== "auto"
    ) {
      result.skipped += 1;
      pushReason(result, appointment.id, "Automatic visit reminder is disabled by shop settings.");
      continue;
    }

    if (!isPlanActiveForAutomaticReminders(subscriptionByShopId.get(appointment.shop_id))) {
      result.skipped += 1;
      pushReason(result, appointment.id, "Current plan does not allow automatic visit reminders.");
      continue;
    }

    const noticeTypes: AutomaticVisitNoticeType[] = [];
    if (isDueForVisitScheduleNotice(appointment, now)) {
      noticeTypes.push("visit_schedule_notice");
    }
    if (isDueForVisitReminder(appointment, now, lookbackMinutes)) {
      noticeTypes.push("visit_reminder_notice");
    }

    for (const type of noticeTypes) {
      try {
        const dispatchResult = await dispatchAutomaticVisitNotice({ appointment, type });

        if (dispatchResult.notification.status === "sent" || dispatchResult.notification.status === "mocked") {
          result.dispatched += 1;
        } else if (dispatchResult.notification.status === "failed") {
          result.failed += 1;
          pushReason(result, appointment.id, dispatchResult.notification.fail_reason ?? "Notification dispatch failed.");
        } else {
          result.skipped += 1;
          pushReason(result, appointment.id, dispatchResult.notification.fail_reason ?? dispatchResult.notification.status);
        }
      } catch (error) {
        result.failed += 1;
        pushReason(result, appointment.id, error instanceof Error ? error.message : String(error));
      }
    }
  }

  result.ok = result.failed === 0;
  return result;
}
