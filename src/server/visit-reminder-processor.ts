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

type AutomaticVisitNoticeType = "visit_schedule_notice" | "visit_reminder_notice" | "appointment_reminder_10m";

const automaticVisitNoticeTypes: AutomaticVisitNoticeType[] = [
  "visit_schedule_notice",
  "visit_reminder_notice",
  "appointment_reminder_10m",
];

const handledAutomaticVisitNoticeStatuses = ["queued", "sent", "mocked"];

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
const KST_OFFSET_MINUTES = 9 * 60;
const TOMORROW_NOTICE_START_MINUTE_OF_DAY_KST = 18 * 60;
const TODAY_NOTICE_START_MINUTE_OF_DAY_KST = 9 * 60;
const DEFAULT_LOOKBACK_MINUTES = 15;
const DEFAULT_LIMIT = 300;

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function getReminderOffsetMinutes(appointment: ReminderCandidate) {
  return typeof appointment.visit_reminder_offset_minutes === "number"
    ? Math.min(Math.max(Math.round(appointment.visit_reminder_offset_minutes), 0), MAX_VISIT_REMINDER_OFFSET_MINUTES)
    : 10;
}

function getKstParts(date: Date) {
  const shifted = addMinutes(date, KST_OFFSET_MINUTES);
  return {
    dateKey: shifted.toISOString().slice(0, 10),
    minuteOfDay: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

function addDaysToDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

function getUtcStartOfKstDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return addMinutes(new Date(Date.UTC(year, month - 1, day)), -KST_OFFSET_MINUTES);
}

function normalizeLimit(value: number | null | undefined) {
  if (!Number.isFinite(value ?? NaN)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.round(value ?? DEFAULT_LIMIT), 1), 500);
}

function isDueForVisitReminder(appointment: ReminderCandidate, now: Date, lookbackMinutes: number) {
  const startAt = new Date(appointment.start_at);
  if (Number.isNaN(startAt.getTime())) return false;

  const offsetMinutes = getReminderOffsetMinutes(appointment);
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
  const startAt = new Date(appointment.start_at);
  if (Number.isNaN(startAt.getTime())) return false;

  const nowKst = getKstParts(now);
  const startKst = getKstParts(startAt);
  return (
    startKst.dateKey === addDaysToDateKey(nowKst.dateKey, 1) &&
    nowKst.minuteOfDay >= TOMORROW_NOTICE_START_MINUTE_OF_DAY_KST
  );
}

function isDueForTodayVisitNotice(appointment: ReminderCandidate, now: Date, lookbackMinutes: number) {
  const startAt = new Date(appointment.start_at);
  if (Number.isNaN(startAt.getTime())) return false;

  const nowKst = getKstParts(now);
  const startKst = getKstParts(startAt);
  const minutesUntilStart = getMinutesUntilStart(appointment, now);
  if (minutesUntilStart === null) return false;

  const minimumAheadMinutes = Math.max(getReminderOffsetMinutes(appointment) + lookbackMinutes, 30);
  return (
    startKst.dateKey === nowKst.dateKey &&
    nowKst.minuteOfDay >= TODAY_NOTICE_START_MINUTE_OF_DAY_KST &&
    minutesUntilStart > minimumAheadMinutes
  );
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
    skipIfExists: true,
    metadata: {
      source: `automatic_${params.type}_processor`,
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
  const todayKstDateKey = getKstParts(now).dateKey;
  const startLowerBound = getUtcStartOfKstDate(todayKstDateKey).toISOString();
  const startUpperBound = getUtcStartOfKstDate(addDaysToDateKey(todayKstDateKey, 2)).toISOString();

  const { data: appointments, error: appointmentsError } = await supabase
    .from("appointments")
    .select("id, shop_id, guardian_id, pet_id, status, start_at, visit_reminder_offset_minutes")
    .eq("status", "confirmed")
    .gte("start_at", startLowerBound)
    .lt("start_at", startUpperBound)
    .order("start_at", { ascending: true })
    .limit(limit);

  if (appointmentsError) {
    result.ok = false;
    return { ...result, reasons: [{ appointmentId: "system", reason: appointmentsError.message }] };
  }

  const candidates = ((appointments ?? []) as ReminderCandidate[]).filter(
    (appointment) =>
      isDueForVisitScheduleNotice(appointment, now) ||
      isDueForTodayVisitNotice(appointment, now, lookbackMinutes) ||
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
  const appointmentIds = candidates.map((appointment) => appointment.id);
  const { data: existingVisitNotices, error: existingVisitNoticesError } = await supabase
    .from("notifications")
    .select("appointment_id, type, status")
    .in("appointment_id", appointmentIds)
    .in("type", automaticVisitNoticeTypes)
    .in("status", handledAutomaticVisitNoticeStatuses);

  if (existingVisitNoticesError) {
    result.ok = false;
    return { ...result, reasons: [{ appointmentId: "system", reason: existingVisitNoticesError.message }] };
  }

  const appointmentIdsWithHandledVisitNotice = new Set(
    (existingVisitNotices ?? [])
      .map((notice) => notice.appointment_id)
      .filter((appointmentId): appointmentId is string => typeof appointmentId === "string" && appointmentId.length > 0),
  );

  for (const appointment of candidates) {
    if (appointmentIdsWithHandledVisitNotice.has(appointment.id)) {
      result.skipped += 1;
      pushReason(result, appointment.id, "Reservation visit notice was already handled for this appointment.");
      continue;
    }

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

    const noticeTypes: AutomaticVisitNoticeType[] = [];
    if (isDueForVisitScheduleNotice(appointment, now)) {
      noticeTypes.push("visit_schedule_notice");
    } else if (isDueForTodayVisitNotice(appointment, now, lookbackMinutes)) {
      noticeTypes.push("visit_reminder_notice");
    } else if (isDueForVisitReminder(appointment, now, lookbackMinutes)) {
      noticeTypes.push("appointment_reminder_10m");
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
