import { randomUUID } from "node:crypto";

import { hasSupabaseServerEnv } from "@/lib/server-env";
import { hasLaterRebooking, REBOOKING_APPOINTMENT_STATUSES } from "@/lib/revisit-reminder";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { addDate, currentDateInTimeZone } from "@/lib/utils";
import { dispatchNotification } from "@/server/notification-dispatch";
import type { AppointmentStatus } from "@/types/domain";

type RevisitReminderCandidate = {
  id: string;
  shop_id: string;
  appointment_id: string | null;
  guardian_id: string;
  pet_id: string;
  groomed_at: string;
  next_recommended_visit_date: string;
};

type LaterAppointment = {
  id: string;
  pet_id: string;
  start_at: string;
  status: AppointmentStatus;
};

const handledStatuses = ["queued", "sent", "mocked", "skipped"];
const DEFAULT_LIMIT = 300;
const CATCH_UP_DAYS = 7;

export type ProcessRevisitReminderResult = {
  ok: boolean;
  scanned: number;
  dispatched: number;
  cancelledForRebooking: number;
  skipped: number;
  failed: number;
  reasons: Array<{ groomingRecordId: string; reason: string }>;
};

function normalizeLimit(value: number | null | undefined) {
  if (!Number.isFinite(value ?? Number.NaN)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.round(value ?? DEFAULT_LIMIT), 1), 500);
}

async function recordCancelledReminder(
  candidate: RevisitReminderCandidate,
  reminderDate: string,
) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase admin client is not available.");

  const inserted = await supabase.from("notifications").insert({
    id: randomUUID(),
    shop_id: candidate.shop_id,
    appointment_id: candidate.appointment_id,
    pet_id: candidate.pet_id,
    guardian_id: candidate.guardian_id,
    type: "revisit_notice",
    channel: "alimtalk",
    message: "다음 예약이 이미 있어 재방문 알림을 보내지 않았습니다.",
    status: "skipped",
    template_key: null,
    template_type: "alimtalk",
    provider: null,
    provider_message_id: null,
    recipient_phone: null,
    fail_reason: "already_rebooked",
    scheduled_at: `${reminderDate}T09:00:00+09:00`,
    metadata: {
      source: "automatic_revisit_reminder_processor",
      groomingRecordId: candidate.id,
      reminderDate,
      autoCancelledReason: "already_rebooked",
    },
    sent_at: null,
  });

  if (inserted.error && inserted.error.code !== "23505") {
    throw new Error(inserted.error.message);
  }
}

export async function processAutomaticRevisitReminders(options?: {
  today?: string;
  limit?: number;
}): Promise<ProcessRevisitReminderResult> {
  const result: ProcessRevisitReminderResult = {
    ok: true,
    scanned: 0,
    dispatched: 0,
    cancelledForRebooking: 0,
    skipped: 0,
    failed: 0,
    reasons: [],
  };

  if (!hasSupabaseServerEnv()) {
    return {
      ...result,
      ok: false,
      reasons: [{ groomingRecordId: "system", reason: "Supabase server environment is not configured." }],
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return {
      ...result,
      ok: false,
      reasons: [{ groomingRecordId: "system", reason: "Supabase admin client is not available." }],
    };
  }

  const today = options?.today ?? currentDateInTimeZone();
  const earliestReminderDate = addDate(today, -CATCH_UP_DAYS);
  const limit = normalizeLimit(options?.limit);

  const { data: records, error: recordsError } = await supabase
    .from("grooming_records")
    .select("id, shop_id, appointment_id, guardian_id, pet_id, groomed_at, next_recommended_visit_date")
    .not("appointment_id", "is", null)
    .not("next_recommended_visit_date", "is", null)
    .gte("next_recommended_visit_date", earliestReminderDate)
    .lte("next_recommended_visit_date", today)
    .order("next_recommended_visit_date", { ascending: true })
    .limit(limit);

  if (recordsError) {
    return {
      ...result,
      ok: false,
      reasons: [{ groomingRecordId: "system", reason: recordsError.message }],
    };
  }

  const candidates = (records ?? []) as RevisitReminderCandidate[];
  result.scanned = candidates.length;
  if (candidates.length === 0) return result;

  const appointmentIds = candidates
    .map((candidate) => candidate.appointment_id)
    .filter((appointmentId): appointmentId is string => Boolean(appointmentId));
  const { data: existingNotices, error: existingNoticesError } = await supabase
    .from("notifications")
    .select("appointment_id, status")
    .eq("type", "revisit_notice")
    .in("appointment_id", appointmentIds)
    .in("status", handledStatuses);

  if (existingNoticesError) {
    return {
      ...result,
      ok: false,
      reasons: [{ groomingRecordId: "system", reason: existingNoticesError.message }],
    };
  }

  const handledAppointmentIds = new Set(
    (existingNotices ?? [])
      .map((notice) => notice.appointment_id)
      .filter((appointmentId): appointmentId is string => Boolean(appointmentId)),
  );
  const petIds = Array.from(new Set(candidates.map((candidate) => candidate.pet_id)));
  const earliestGroomedAt = candidates.reduce(
    (earliest, candidate) => candidate.groomed_at < earliest ? candidate.groomed_at : earliest,
    candidates[0].groomed_at,
  );
  const { data: appointments, error: appointmentsError } = await supabase
    .from("appointments")
    .select("id, pet_id, start_at, status")
    .in("pet_id", petIds)
    .in("status", REBOOKING_APPOINTMENT_STATUSES)
    .gt("start_at", earliestGroomedAt)
    .order("start_at", { ascending: true });

  if (appointmentsError) {
    return {
      ...result,
      ok: false,
      reasons: [{ groomingRecordId: "system", reason: appointmentsError.message }],
    };
  }

  const laterAppointments = (appointments ?? []) as LaterAppointment[];

  for (const candidate of candidates) {
    if (!candidate.appointment_id || handledAppointmentIds.has(candidate.appointment_id)) {
      result.skipped += 1;
      result.reasons.push({ groomingRecordId: candidate.id, reason: "Revisit reminder was already handled." });
      continue;
    }

    try {
      if (hasLaterRebooking(candidate, laterAppointments)) {
        await recordCancelledReminder(candidate, candidate.next_recommended_visit_date);
        result.cancelledForRebooking += 1;
        continue;
      }

      const dispatched = await dispatchNotification({
        shopId: candidate.shop_id,
        appointmentId: candidate.appointment_id,
        guardianId: candidate.guardian_id,
        petId: candidate.pet_id,
        type: "revisit_notice",
        channel: "alimtalk",
        skipIfExists: true,
        metadata: {
          source: "automatic_revisit_reminder_processor",
          groomingRecordId: candidate.id,
          reminderDate: candidate.next_recommended_visit_date,
        },
      });

      if (dispatched.notification.status === "sent" || dispatched.notification.status === "mocked") {
        result.dispatched += 1;
      } else if (dispatched.notification.status === "failed") {
        result.failed += 1;
        result.reasons.push({
          groomingRecordId: candidate.id,
          reason: dispatched.notification.fail_reason ?? "Revisit reminder dispatch failed.",
        });
      } else {
        result.skipped += 1;
        result.reasons.push({
          groomingRecordId: candidate.id,
          reason: dispatched.notification.fail_reason ?? dispatched.notification.status,
        });
      }
    } catch (error) {
      result.failed += 1;
      result.reasons.push({
        groomingRecordId: candidate.id,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  result.ok = result.failed === 0;
  return result;
}
