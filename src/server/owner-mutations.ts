import { randomUUID } from "node:crypto";

import { computeAvailableSlots, isRegularClosedOnDate, isSlotAvailable } from "@/lib/availability";
import { getAppointmentEffectiveWindow } from "@/lib/appointment-time";
import { concurrentCapacityForApprovalMode } from "@/lib/booking-slot-settings";
import { getBusinessHoursForWeekday } from "@/lib/business-hours";
import { normalizeCustomerPageSettings } from "@/lib/customer-page-settings";
import {
  coerceEnabledShopNotificationSettings,
  defaultGuardianNotificationSettings,
  normalizeBootstrapNotifications,
  normalizeGuardianNotificationSettings,
  normalizeShopNotificationSettings,
} from "@/lib/notification-settings";
import { hasBlockedWindowOverlap, normalizeReservationPolicySettings } from "@/lib/reservation-policy-settings";
import { hasSupabaseServerEnv } from "@/lib/server-env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { addDate, currentDateInTimeZone, currentMinutesInTimeZone, minutesFromTime, nowIso, timeFromMinutes } from "@/lib/utils";
import { getBootstrap } from "@/server/bootstrap";
import { getMockStore, setMockStore } from "@/server/mock-store";
import { dispatchNotification } from "@/server/notification-dispatch";
import {
  appointmentInputSchema,
  appointmentEditSchema,
  appointmentStatusSchema,
  guardianDeleteSchema,
  customerPageSettingsSchema,
  guardianInputSchema,
  guardianRestoreSchema,
  guardianUpdateSchema,
  petDeleteSchema,
  petInputSchema,
  petStaffNoteUpsertSchema,
  petUpdateSchema,
  serviceDeleteSchema,
  serviceInputSchema,
  shopSettingsSchema,
} from "@/server/schemas";
import type { Appointment, AppointmentChangeEvent, AppointmentStatus, Guardian, Pet, PetStaffNote, Service, Shop } from "@/types/domain";

const weekdayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const scheduleActiveStatuses = ["confirmed", "in_progress", "almost_done"] as const;
const defaultVisitReminderOffsetMinutes = 10;
const defaultPickupReadyEtaMinutes = 5;

function isMissingPetBiteLevelColumn(error: { message?: string; code?: string } | null | undefined) {
  return Boolean(error?.message?.includes("bite_level") && error.message.includes("schema cache"));
}

function buildAppointmentWindow(date: string, time: string, durationMinutes: number) {
  const endMinute = minutesFromTime(time) + durationMinutes;

  return {
    start_at: `${date}T${time}:00+09:00`,
    end_at: `${addDate(date, Math.floor(endMinute / (24 * 60)))}T${timeFromMinutes(endMinute % (24 * 60))}:00+09:00`,
  };
}

function toTimestampString(date: string, time: string) {
  const normalizedTime = /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : time;
  return `${date}T${normalizedTime}+09:00`;
}

function getRejectionReason(payload: {
  rejectionReasonTemplate?: string;
  rejectionReasonCustom?: string;
}) {
  if (payload.rejectionReasonTemplate === "湲고? 吏곸젒 ?낅젰") {
    return payload.rejectionReasonCustom?.trim() || "湲고? ?ъ쑀";
  }

  return payload.rejectionReasonTemplate?.trim() || payload.rejectionReasonCustom?.trim() || null;
}

function assertPhotoRequirementForAppointmentStatus(params: {
  status: AppointmentStatus;
  previousStatus: AppointmentStatus;
  mediaAssetIds: string[];
  shop: Shop;
}) {
  if (params.mediaAssetIds.length > 0) return;

}

function getAppointmentStatusLabel(status: AppointmentStatus) {
  const labels: Record<AppointmentStatus, string> = {
    confirmed: "예약 확정",
    in_progress: "미용 시작",
    almost_done: "픽업 준비",
    completed: "완료",
    cancelled: "취소",
    rejected: "거절",
    noshow: "노쇼",
  };
  return labels[status];
}

function assertAppointmentStatusIsNotRepeated(params: {
  previousStatus: AppointmentStatus;
  nextStatus: AppointmentStatus;
}) {
  if (params.previousStatus !== params.nextStatus) return;

  const label = getAppointmentStatusLabel(params.nextStatus);
  throw new Error(`이미 '${label}' 상태입니다. 같은 상태 버튼은 두 번 이상 처리하거나 알림을 다시 보낼 수 없어요.`);
}

function assertAppointmentStatusTransitionAllowed(params: {
  previousStatus: AppointmentStatus;
  nextStatus: AppointmentStatus;
}) {
  const terminalStatuses = new Set<AppointmentStatus>(["completed", "cancelled", "rejected", "noshow"]);

  if (terminalStatuses.has(params.previousStatus)) {
    throw new Error("이미 종료된 예약은 다시 상태를 변경할 수 없어요. 새 예약을 만들거나 별도 변경으로 처리해 주세요.");
  }

  if (params.nextStatus === "confirmed") {
    throw new Error("이미 확정된 예약만 처리할 수 있어요. 종료된 예약을 다시 확정 상태로 되돌릴 수 없습니다.");
  }

  if (params.nextStatus === "in_progress" && params.previousStatus !== "confirmed") {
    throw new Error("미용 시작은 예약 확정 상태에서만 처리할 수 있어요.");
  }

  if (params.nextStatus === "almost_done" && params.previousStatus !== "in_progress") {
    throw new Error("픽업 준비는 미용 시작 후에만 처리할 수 있어요.");
  }

  if (params.nextStatus === "completed" && !["in_progress", "almost_done"].includes(params.previousStatus)) {
    throw new Error("미용 완료는 미용 시작 또는 픽업 준비 상태에서만 처리할 수 있어요.");
  }

  if (params.nextStatus === "rejected" && params.previousStatus !== "confirmed") {
    throw new Error("예약 거절은 예약 확정 상태에서만 처리할 수 있어요.");
  }

  if (params.nextStatus === "noshow" && params.previousStatus !== "confirmed") {
    throw new Error("노쇼 처리는 예약 확정 상태에서만 처리할 수 있어요.");
  }
}

function normalizeAppointmentTimeForCompare(value: string | null | undefined) {
  return (value ?? "").slice(0, 5);
}

function isMissingAppointmentChangeEventsError(error: { code?: string | null; message?: string | null } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    message.includes("appointment_change_events") ||
    message.includes("schema cache")
  );
}

function buildAppointmentHistorySnapshot(appointment: Appointment) {
  return {
    status: appointment.status,
    service_id: appointment.service_id,
    staff_id: appointment.staff_id ?? null,
    appointment_date: appointment.appointment_date,
    appointment_time: normalizeAppointmentTimeForCompare(appointment.appointment_time),
    memo: appointment.memo,
    rejection_reason: appointment.rejection_reason,
    start_at: appointment.start_at,
    end_at: appointment.end_at,
    actual_started_at: appointment.actual_started_at ?? null,
    actual_completed_at: appointment.actual_completed_at ?? null,
    visit_reminder_offset_minutes: appointment.visit_reminder_offset_minutes ?? null,
    pickup_ready_eta_minutes: appointment.pickup_ready_eta_minutes ?? null,
  };
}

function createAppointmentChangeEvent(params: {
  before: Appointment;
  after: Appointment;
  eventType: AppointmentChangeEvent["event_type"];
  note?: string | null;
  createdAt?: string;
}): AppointmentChangeEvent {
  return {
    id: randomUUID(),
    shop_id: params.after.shop_id,
    appointment_id: params.after.id,
    event_type: params.eventType,
    previous_values: buildAppointmentHistorySnapshot(params.before),
    next_values: buildAppointmentHistorySnapshot(params.after),
    note: params.note ?? null,
    created_at: params.createdAt ?? nowIso(),
  };
}

async function persistAppointmentChangeEvent(event: AppointmentChangeEvent) {
  if (!hasSupabaseServerEnv()) {
    const store = getMutableStore();
    store.appointmentChangeEvents = [event, ...(store.appointmentChangeEvents ?? [])];
    setMockStore(store);
    return;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const { error } = await supabase.from("appointment_change_events").insert(event);
  if (error) {
    if (isMissingAppointmentChangeEventsError(error)) {
      console.warn("[owner-mutations] appointment_change_events table is not ready; skipped history event");
      return;
    }
    console.warn("[owner-mutations] appointment change history insert failed", error.message);
  }
}

function hasNotificationRelevantAppointmentDetailChange(params: {
  appointment: Appointment;
  serviceId: string;
  staffId: string | null | undefined;
  appointmentDate: string;
  appointmentTime: string;
  durationMinutes: number;
  visitReminderOffsetMinutes?: number;
  pickupReadyEtaMinutes?: number;
}) {
  const currentDuration = getAppointmentDurationMinutes(params.appointment, []);
  return (
    params.appointment.service_id !== params.serviceId ||
    (params.appointment.staff_id ?? null) !== (params.staffId ?? null) ||
    params.appointment.appointment_date !== params.appointmentDate ||
    normalizeAppointmentTimeForCompare(params.appointment.appointment_time) !== normalizeAppointmentTimeForCompare(params.appointmentTime) ||
    (currentDuration !== null && currentDuration !== params.durationMinutes) ||
    (typeof params.visitReminderOffsetMinutes === "number" &&
      params.appointment.visit_reminder_offset_minutes !== params.visitReminderOffsetMinutes) ||
    (typeof params.pickupReadyEtaMinutes === "number" &&
      params.appointment.pickup_ready_eta_minutes !== params.pickupReadyEtaMinutes)
  );
}

function ensureAppointmentCanBeConfirmed(params: {
  appointment: Appointment;
  shop: Shop;
  services: Service[];
  appointments: Appointment[];
}) {
  const { appointment, shop, services, appointments } = params;
  const service = services.find((item) => item.id === appointment.service_id);

  if (!service) {
    throw new Error("서비스 정보를 찾을 수 없어 승인할 수 없습니다.");
  }

  const today = currentDateInTimeZone();
  const appointmentStartMinute = minutesFromTime(appointment.appointment_time);
  if (
    appointment.appointment_date < today ||
    (appointment.appointment_date === today && appointmentStartMinute <= currentMinutesInTimeZone())
  ) {
    throw new Error("이미 지난 예약 시간입니다. 시간을 변경한 뒤 확정해 주세요.");
  }

  const available = isSlotAvailable({
    date: appointment.appointment_date,
    startMinute: appointmentStartMinute,
    durationMinutes: service.duration_minutes,
    services,
    appointments: appointment.staff_id
      ? appointments.filter((item) => item.staff_id === appointment.staff_id)
      : appointments,
    excludeAppointmentId: appointment.id,
  });

  if (!available) {
    throw new Error("같은 시간에 이미 확정된 예약이 있어 승인할 수 없습니다.");
  }
}

function getAppointmentDurationMinutes(appointment: Appointment, services: Service[]) {
  const start = new Date(appointment.start_at).getTime();
  const end = new Date(appointment.end_at).getTime();
  if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
    return Math.round((end - start) / 60 / 1000);
  }

  return services.find((item) => item.id === appointment.service_id)?.duration_minutes ?? null;
}

function ensureStaffAvailableForWindow(params: {
  staffMembers: Awaited<ReturnType<typeof getBootstrap>>["staffMembers"];
  staffScheduleOverrides?: Awaited<ReturnType<typeof getBootstrap>>["staffScheduleOverrides"];
  staffId?: string | null;
  date: string;
  appointmentTime: string;
  durationMinutes: number;
}) {
  const { staffMembers, staffScheduleOverrides = [], staffId, date, appointmentTime, durationMinutes } = params;
  if (!staffId) return;

  const staffMember = staffMembers.find((item) => item.id === staffId);
  if (!staffMember) {
    throw new Error("담당 직원 정보를 찾을 수 없습니다.");
  }

  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(year, (month ?? 1) - 1, day ?? 1).getDay();
  const dayKey = weekdayKeys[weekday];

  const startMinute = minutesFromTime(appointmentTime);
  const endMinute = startMinute + durationMinutes;
  const override = staffScheduleOverrides.find((item) => item.staff_id === staffId && item.work_date === date);

  if (override) {
    if (override.status === "off" || override.status === "annual") {
      throw new Error("선택한 담당자는 해당 날짜에 근무하지 않습니다.");
    }

    if (override.status === "half") {
      const splitMinute = minutesFromTime("13:00");
      const availableStart = override.period === "오전" ? splitMinute : minutesFromTime(staffMember.startTime);
      const availableEnd = override.period === "오후" ? splitMinute : minutesFromTime(staffMember.endTime);
      if (startMinute < availableStart || endMinute > availableEnd) {
        throw new Error("예약 시간이 담당자 반차 시간을 벗어납니다.");
      }
      return;
    }

    if (override.status === "work") {
      const availableStart = minutesFromTime(override.start_time ?? staffMember.startTime);
      const availableEnd = minutesFromTime(override.end_time ?? staffMember.endTime);
      if (startMinute < availableStart || endMinute > availableEnd) {
        throw new Error("예약 시간이 담당자 예외 근무시간을 벗어납니다.");
      }
      return;
    }
  }

  if (!staffMember.defaultDays.includes(dayKey)) {
    throw new Error("선택한 담당자는 해당 요일에 근무하지 않습니다.");
  }

  if (startMinute < minutesFromTime(staffMember.startTime) || endMinute > minutesFromTime(staffMember.endTime)) {
    throw new Error("예약 시간이 담당자 근무시간을 벗어납니다.");
  }
}

function ensureOwnerScheduleAdjustmentAvailable(params: {
  appointment: Appointment;
  shop: Shop;
  services: Service[];
  staffMembers: Awaited<ReturnType<typeof getBootstrap>>["staffMembers"];
  staffScheduleOverrides?: Awaited<ReturnType<typeof getBootstrap>>["staffScheduleOverrides"];
  appointments: Appointment[];
  date: string;
  appointmentTime: string;
  durationMinutes: number;
  staffId?: string | null;
  allowOutsideShopHours?: boolean;
}) {
  const { appointment, shop, services, staffMembers, staffScheduleOverrides, appointments, date, appointmentTime, durationMinutes, staffId, allowOutsideShopHours = false } = params;
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(year, (month ?? 1) - 1, day ?? 1).getDay();
  const hours = getBusinessHoursForWeekday(shop, weekday);
  const startMinute = minutesFromTime(appointmentTime);
  const endMinute = startMinute + durationMinutes;

  if (isRegularClosedOnDate(shop, date) || shop.temporary_closed_dates.includes(date)) {
    throw new Error("매장 휴무일에는 예약 시간을 조정할 수 없습니다.");
  }

  if (!allowOutsideShopHours && (!hours?.enabled || startMinute < minutesFromTime(hours.open) || endMinute > minutesFromTime(hours.close))) {
    throw new Error("예약 시간이 매장 운영시간을 벗어납니다.");
  }

  if (hasBlockedWindowOverlap(shop.reservation_policy_settings, startMinute, endMinute)) {
    throw new Error("예약 제외 시간에는 예약 시간을 조정할 수 없습니다.");
  }

  if (!staffId) return;

  if (!allowOutsideShopHours) {
    ensureStaffAvailableForWindow({
      staffMembers,
      staffScheduleOverrides,
      staffId,
      date,
      appointmentTime,
      durationMinutes,
    });
  }

  const hasConflict = appointments.some((item) => {
    if (item.id === appointment.id) return false;
    if (item.appointment_date !== date) return false;
    if (item.staff_id !== staffId) return false;
    if (["cancelled", "rejected", "noshow"].includes(item.status)) return false;

    const effectiveWindow = getAppointmentEffectiveWindow(item, services);
    if (!effectiveWindow || effectiveWindow.date !== date) return false;
    return effectiveWindow.startMinute < endMinute && startMinute < effectiveWindow.endMinute;
  });

  if (hasConflict) {
    throw new Error("선택한 담당자에게 같은 시간 예약이 있습니다.");
  }
}

function ensureAppointmentScheduleCanBeActivated(params: {
  appointment: Appointment;
  shop: Shop;
  services: Service[];
  staffMembers: Awaited<ReturnType<typeof getBootstrap>>["staffMembers"];
  staffScheduleOverrides?: Awaited<ReturnType<typeof getBootstrap>>["staffScheduleOverrides"];
  appointments: Appointment[];
}) {
  const durationMinutes = getAppointmentDurationMinutes(params.appointment, params.services);
  if (!durationMinutes) {
    throw new Error("예약 소요 시간을 확인할 수 없습니다.");
  }

  ensureOwnerScheduleAdjustmentAvailable({
    appointment: params.appointment,
    shop: params.shop,
    services: params.services,
    staffMembers: params.staffMembers,
    staffScheduleOverrides: params.staffScheduleOverrides,
    appointments: params.appointments,
    date: params.appointment.appointment_date,
    appointmentTime: params.appointment.appointment_time,
    durationMinutes,
    staffId: params.appointment.staff_id ?? null,
  });
}

function hasMissingColumnError(
  error: {
    code?: string | null;
    message?: string | null;
    details?: string | null;
    hint?: string | null;
  } | null | undefined,
  column: string,
) {
  const haystack = [error?.message, error?.details, error?.hint].filter(Boolean).join(" ").toLowerCase();
  const needle = column.toLowerCase();
  const isPostgrestSchemaCacheMiss = error?.code === "PGRST204" || haystack.includes("schema cache");
  return (
    haystack.includes(needle) &&
    (haystack.includes("column") || haystack.includes("could not find") || isPostgrestSchemaCacheMiss)
  );
}

function getMutableStore() {
  return normalizeBootstrapNotifications(getMockStore());
}

function resolveGuardianIds(payload: { guardianId?: string; guardianIds?: string[] }) {
  const ids = new Set<string>();
  if (payload.guardianId) ids.add(payload.guardianId);
  for (const guardianId of payload.guardianIds ?? []) {
    if (guardianId) ids.add(guardianId);
  }
  return Array.from(ids);
}

type AppointmentStatusNotificationType =
  | "booking_confirmed"
  | "booking_rescheduled_confirmed"
  | "booking_rejected"
  | "booking_cancelled"
  | "grooming_started"
  | "grooming_almost_done"
  | "grooming_completed";

function getAppointmentNotificationReason(result: Awaited<ReturnType<typeof dispatchNotification>>) {
  if (result.notification.fail_reason) return result.notification.fail_reason;
  if (result.skipped) return "skipped";
  if (result.alreadyExists) return "already exists";
  return null;
}

async function dispatchAppointmentNotificationWithLogs(params: {
  shopId: string;
  appointment: Pick<Appointment, "id" | "guardian_id" | "pet_id">;
  type: AppointmentStatusNotificationType;
  skipIfExists?: boolean;
  mediaAssetIds?: string[];
  force?: boolean;
}) {
  console.log("[appointments-api] notification dispatch start", {
    appointmentId: params.appointment.id,
    notificationType: params.type,
    target: "guardian",
  });

  try {
    const result = await dispatchNotification({
      shopId: params.shopId,
      appointmentId: params.appointment.id,
      guardianId: params.appointment.guardian_id,
      petId: params.appointment.pet_id,
      type: params.type,
      mediaAssetIds: params.mediaAssetIds,
      force: params.force === true,
      ...(params.skipIfExists ? { skipIfExists: true } : {}),
    });

    console.log("[appointments-api] notification dispatch result", {
      appointmentId: params.appointment.id,
      notificationType: params.type,
      ok: result.notification.status !== "failed",
      reason: getAppointmentNotificationReason(result),
    });

    return result;
  } catch (error) {
    console.log("[appointments-api] notification dispatch result", {
      appointmentId: params.appointment.id,
      notificationType: params.type,
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function updateShopSettings(input: unknown) {
  const payload = shopSettingsSchema.parse(input);
  const nextNotificationSettings = {
    enabled: payload.notificationSettings.enabled,
    alimtalk_sender_mode: payload.notificationSettings.alimtalkSenderMode,
    alimtalk_shop_channel_status: payload.notificationSettings.alimtalkShopChannelStatus,
    alimtalk_shop_channel_name: payload.notificationSettings.alimtalkShopChannelName,
    alimtalk_shop_channel_url: payload.notificationSettings.alimtalkShopChannelUrl,
    alimtalk_sender_profile_key: payload.notificationSettings.alimtalkSenderProfileKey,
    alimtalk_channel_requested_at: payload.notificationSettings.alimtalkChannelRequestedAt,
    alimtalk_channel_admin_note: payload.notificationSettings.alimtalkChannelAdminNote,
    alimtalk_business_channel_verified: payload.notificationSettings.alimtalkBusinessChannelVerified,
    alimtalk_template_request_note: payload.notificationSettings.alimtalkTemplateRequestNote,
    alimtalk_template_request_updated_at: payload.notificationSettings.alimtalkTemplateRequestUpdatedAt,
    revisit_enabled: payload.notificationSettings.revisitEnabled,
    booking_confirmed_enabled: payload.notificationSettings.bookingConfirmedEnabled,
    booking_rejected_enabled: payload.notificationSettings.bookingRejectedEnabled,
    booking_cancelled_enabled: payload.notificationSettings.bookingCancelledEnabled,
    booking_rescheduled_enabled: payload.notificationSettings.bookingRescheduledEnabled,
    appointment_reminder_10m_enabled: payload.notificationSettings.appointmentReminder10mEnabled,
    appointment_reminder_10m_mode: payload.notificationSettings.appointmentReminder10mMode,
    visit_reminder_offset_minutes: payload.notificationSettings.visitReminderOffsetMinutes,
    grooming_started_enabled: payload.notificationSettings.groomingStartedEnabled,
    grooming_almost_done_enabled: payload.notificationSettings.groomingAlmostDoneEnabled,
    pickup_ready_eta_minutes: payload.notificationSettings.pickupReadyEtaMinutes,
    grooming_completed_enabled: payload.notificationSettings.groomingCompletedEnabled,
    grooming_start_without_photo_enabled: payload.notificationSettings.groomingStartWithoutPhotoEnabled,
    grooming_complete_without_photo_enabled: payload.notificationSettings.groomingCompleteWithoutPhotoEnabled,
  };
  const normalizedNotificationSettings = coerceEnabledShopNotificationSettings(nextNotificationSettings);
  const concurrentCapacity = concurrentCapacityForApprovalMode(payload.approvalMode);
  const regularClosedAnchorDate = payload.regularClosedCycle === "biweekly" ? payload.regularClosedAnchorDate : null;
  const normalizedReservationPolicySettings = {
    ...normalizeReservationPolicySettings(payload.reservationPolicySettings),
    regular_closed_cycle: payload.regularClosedCycle,
    regular_closed_anchor_date: regularClosedAnchorDate,
  };
  const fullUpdatePayload = {
    name: payload.name,
    phone: payload.phone,
    address: payload.address,
    description: payload.description,
    concurrent_capacity: concurrentCapacity,
    booking_slot_interval_minutes: payload.bookingSlotIntervalMinutes,
    booking_slot_offset_minutes: payload.bookingSlotOffsetMinutes,
    booking_available_start_time: payload.bookingAvailableStartTime,
    booking_available_end_time: payload.bookingAvailableEndTime,
    approval_mode: payload.approvalMode,
    regular_closed_days: payload.regularClosedDays,
    temporary_closed_dates: payload.temporaryClosedDates,
    business_hours: payload.businessHours,
    reservation_policy_settings: normalizedReservationPolicySettings,
    notification_settings: normalizedNotificationSettings,
    updated_at: nowIso(),
  };

  if (!hasSupabaseServerEnv()) {
    const store = getMutableStore();
    store.shop = {
      ...store.shop,
      id: payload.shopId,
      name: payload.name,
      phone: payload.phone,
      address: payload.address,
      description: payload.description,
      concurrent_capacity: concurrentCapacity,
      booking_slot_interval_minutes: payload.bookingSlotIntervalMinutes,
      booking_slot_offset_minutes: payload.bookingSlotOffsetMinutes,
      booking_available_start_time: payload.bookingAvailableStartTime,
      booking_available_end_time: payload.bookingAvailableEndTime,
      approval_mode: payload.approvalMode,
      regular_closed_days: payload.regularClosedDays,
      regular_closed_cycle: payload.regularClosedCycle,
      regular_closed_anchor_date: regularClosedAnchorDate,
      temporary_closed_dates: payload.temporaryClosedDates,
      business_hours: Object.fromEntries(Object.entries(payload.businessHours).map(([key, value]) => [Number(key), value])),
      reservation_policy_settings: normalizedReservationPolicySettings,
      notification_settings: normalizedNotificationSettings,
      updated_at: nowIso(),
    };

    setMockStore(store);
    return store.shop;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase 설정을 확인해 주세요.");

    const runShopUpdate = async ({
      includeBookingSlotSettings,
      includeNotificationSettings,
      includeBookingAvailableTimeWindow,
      includeRegularClosedCycleSettings,
    }: {
      includeBookingSlotSettings: boolean;
      includeNotificationSettings: boolean;
      includeBookingAvailableTimeWindow: boolean;
      includeRegularClosedCycleSettings: boolean;
    }) => {
      const nextPayload: Record<string, unknown> = {
        ...fullUpdatePayload,
      };

    if (!includeBookingSlotSettings) {
      delete nextPayload.booking_slot_interval_minutes;
      delete nextPayload.booking_slot_offset_minutes;
    }

      if (!includeBookingAvailableTimeWindow) {
        delete nextPayload.booking_available_start_time;
        delete nextPayload.booking_available_end_time;
      }

      if (!includeRegularClosedCycleSettings) {
        delete nextPayload.regular_closed_cycle;
        delete nextPayload.regular_closed_anchor_date;
      }
  
      if (!includeNotificationSettings) {
        delete nextPayload.notification_settings;
      }

    return supabase
      .from("shops")
      .update(nextPayload)
      .eq("id", payload.shopId)
      .select("*")
      .single();
  };

    const withRegularClosedSettings = (shop: Shop): Shop => ({
      ...shop,
      regular_closed_cycle: payload.regularClosedCycle,
      regular_closed_anchor_date: regularClosedAnchorDate,
      reservation_policy_settings: {
        ...normalizeReservationPolicySettings(shop.reservation_policy_settings),
        regular_closed_cycle: payload.regularClosedCycle,
        regular_closed_anchor_date: regularClosedAnchorDate,
      },
    });

    const { data, error } = await runShopUpdate({
      includeBookingSlotSettings: true,
      includeNotificationSettings: true,
      includeBookingAvailableTimeWindow: true,
      includeRegularClosedCycleSettings: false,
    });
  
    if (error) {
      const missingBookingSlotSettings =
        hasMissingColumnError(error, "booking_slot_interval_minutes") ||
      hasMissingColumnError(error, "booking_slot_offset_minutes");
      const missingBookingAvailableTimeWindow =
        hasMissingColumnError(error, "booking_available_start_time") ||
        hasMissingColumnError(error, "booking_available_end_time");
      const missingRegularClosedCycleSettings =
        hasMissingColumnError(error, "regular_closed_cycle") ||
        hasMissingColumnError(error, "regular_closed_anchor_date");
      const missingNotificationSettings = hasMissingColumnError(error, "notification_settings");
  
      if (missingBookingSlotSettings || missingNotificationSettings || missingBookingAvailableTimeWindow || missingRegularClosedCycleSettings) {
        let fallback = await runShopUpdate({
          includeBookingSlotSettings: !missingBookingSlotSettings,
          includeNotificationSettings: !missingNotificationSettings,
          includeBookingAvailableTimeWindow: !missingBookingAvailableTimeWindow,
          includeRegularClosedCycleSettings: !missingRegularClosedCycleSettings,
        });
  
        if (
          fallback.error &&
          !missingNotificationSettings &&
        hasMissingColumnError(fallback.error, "notification_settings")
      ) {
          fallback = await runShopUpdate({
            includeBookingSlotSettings: !missingBookingSlotSettings,
            includeNotificationSettings: false,
            includeBookingAvailableTimeWindow: !missingBookingAvailableTimeWindow,
            includeRegularClosedCycleSettings: !missingRegularClosedCycleSettings,
          });
        }

      if (fallback.error) {
        throw new Error(fallback.error.message);
      }

      return withRegularClosedSettings(fallback.data as Shop);
    }

    throw new Error(error.message);
  }

  return withRegularClosedSettings(data as Shop);
}

export async function upsertService(input: unknown) {
  const payload = serviceInputSchema.parse(input);
  const service: Service = {
    id: payload.serviceId ?? randomUUID(),
    shop_id: payload.shopId,
    name: payload.name,
    price: payload.price,
    price_type: payload.priceType,
    duration_minutes: payload.durationMinutes,
    is_active: payload.isActive,
    category: payload.category,
    description: payload.description,
    sort_order: payload.sortOrder,
    capacity_label: payload.capacityLabel,
    staff_selection_mode: payload.staffSelectionMode,
    price_guide: payload.priceGuide ?? {},
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  if (!hasSupabaseServerEnv()) {
    const store = getMutableStore();
    const index = store.services.findIndex((item) => item.id === service.id);
    if (index >= 0) {
      store.services[index] = { ...store.services[index], ...service, created_at: store.services[index].created_at };
    } else {
      store.services = [...store.services, service];
    }
    setMockStore(store);
    return service;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase ?ㅼ젙???뺤씤??二쇱꽭??");

  const { error } = await supabase.from("services").upsert(service);
  if (error) {
    if (hasMissingColumnError(error, "price_type")) {
      const { error: fallbackError } = await supabase.from("services").upsert({
        id: service.id,
        shop_id: service.shop_id,
        name: service.name,
        price: service.price,
        duration_minutes: service.duration_minutes,
        is_active: service.is_active,
        created_at: service.created_at,
        updated_at: service.updated_at,
      });

      if (fallbackError) throw new Error(fallbackError.message);
      return service;
    }

    if (
      hasMissingColumnError(error, "category") ||
      hasMissingColumnError(error, "description") ||
      hasMissingColumnError(error, "sort_order") ||
      hasMissingColumnError(error, "capacity_label") ||
      hasMissingColumnError(error, "staff_selection_mode") ||
      hasMissingColumnError(error, "price_guide")
    ) {
      const { error: fallbackError } = await supabase.from("services").upsert({
        id: service.id,
        shop_id: service.shop_id,
        name: service.name,
        price: service.price,
        price_type: service.price_type,
        duration_minutes: service.duration_minutes,
        is_active: service.is_active,
        created_at: service.created_at,
        updated_at: service.updated_at,
      });

      if (fallbackError) throw new Error(fallbackError.message);
      return service;
    }

    throw new Error(error.message);
  }
  return service;
}

export async function deleteService(input: unknown) {
  const payload = serviceDeleteSchema.parse(input);

  if (!hasSupabaseServerEnv()) {
    const store = getMutableStore();
    const beforeCount = store.services.length;
    store.services = store.services.filter((item) => !(item.id === payload.serviceId && item.shop_id === payload.shopId));
    if (store.services.length === beforeCount) {
      throw new Error("삭제할 서비스 항목을 찾을 수 없습니다.");
    }
    setMockStore(store);
    return { success: true, serviceId: payload.serviceId };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase 설정을 확인해 주세요.");

  const { data, error } = await supabase
    .from("services")
    .delete()
    .eq("id", payload.serviceId)
    .eq("shop_id", payload.shopId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("삭제할 서비스 항목을 찾을 수 없습니다.");

  return { success: true, serviceId: payload.serviceId };
}

export async function updateCustomerPageSettings(input: unknown) {
  const payload = customerPageSettingsSchema.parse(input);
  const rawSettings =
    input && typeof input === "object" && !Array.isArray(input) && "customerPageSettings" in input
      ? (input as { customerPageSettings?: unknown }).customerPageSettings
      : null;
  const rawSettingsObject = rawSettings && typeof rawSettings === "object" && !Array.isArray(rawSettings)
    ? (rawSettings as Record<string, unknown>)
    : {};
  const hasHeroImageUrl = Object.prototype.hasOwnProperty.call(rawSettingsObject, "hero_image_url");
  const hasHeroImageUrls = Object.prototype.hasOwnProperty.call(rawSettingsObject, "hero_image_urls");
  const hasHeroMediaAssetId = Object.prototype.hasOwnProperty.call(rawSettingsObject, "hero_media_asset_id");
  const hasHeroMediaAssetIds = Object.prototype.hasOwnProperty.call(rawSettingsObject, "hero_media_asset_ids");

  function mergeWithExistingCustomerPageSettings(existing: unknown) {
    const current = normalizeCustomerPageSettings(existing as Partial<Shop["customer_page_settings"]> | null | undefined);
    return normalizeCustomerPageSettings({
      ...payload.customerPageSettings,
      hero_image_url: hasHeroImageUrl ? payload.customerPageSettings.hero_image_url : current.hero_image_url,
      hero_image_urls: hasHeroImageUrls ? payload.customerPageSettings.hero_image_urls : current.hero_image_urls,
      hero_media_asset_id: hasHeroMediaAssetId ? payload.customerPageSettings.hero_media_asset_id : current.hero_media_asset_id,
      hero_media_asset_ids: hasHeroMediaAssetIds ? payload.customerPageSettings.hero_media_asset_ids : current.hero_media_asset_ids,
    });
  }

  if (!hasSupabaseServerEnv()) {
    const store = getMutableStore();
    const nextCustomerPageSettings = mergeWithExistingCustomerPageSettings(store.shop.customer_page_settings);
    store.shop = {
      ...store.shop,
      id: payload.shopId,
      customer_page_settings: nextCustomerPageSettings,
      updated_at: nowIso(),
    };
    setMockStore(store);
    return store.shop.customer_page_settings;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase ?ㅼ젙???뺤씤??二쇱꽭??");

  const currentShopResult = await supabase
    .from("shops")
    .select("customer_page_settings")
    .eq("id", payload.shopId)
    .maybeSingle<{ customer_page_settings: Record<string, unknown> | null }>();

  if (currentShopResult.error) {
    if (hasMissingColumnError(currentShopResult.error, "customer_page_settings")) {
      throw new Error("怨좉컼 ?몄텧 ?뺣낫 而щ읆???꾩쭅 ?놁뒿?덈떎. ?덈궡?쒕┛ SQL????踰덈쭔 ?ㅽ뻾??二쇱꽭??");
    }
    throw new Error(currentShopResult.error.message);
  }

  const nextCustomerPageSettings = mergeWithExistingCustomerPageSettings(currentShopResult.data?.customer_page_settings);

  const { data, error } = await supabase
    .from("shops")
    .update({
      customer_page_settings: nextCustomerPageSettings,
      updated_at: nowIso(),
    })
    .eq("id", payload.shopId)
    .select("customer_page_settings")
    .single();

  if (error) {
    if (hasMissingColumnError(error, "customer_page_settings")) {
      throw new Error("怨좉컼 ?몄텧 ?뺣낫 而щ읆???꾩쭅 ?놁뒿?덈떎. ?덈궡?쒕┛ SQL????踰덈쭔 ?ㅽ뻾??二쇱꽭??");
    }
    throw new Error(error.message);
  }
  return normalizeCustomerPageSettings(data?.customer_page_settings);
}

export async function createGuardian(input: unknown) {
  const payload = guardianInputSchema.parse(input);
  const guardian: Guardian = {
    id: randomUUID(),
    shop_id: payload.shopId,
    name: payload.name,
    phone: payload.phone,
    memo: payload.memo ?? "",
    notification_settings: defaultGuardianNotificationSettings,
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  if (!hasSupabaseServerEnv()) {
    const store = getMutableStore();
    store.guardians = [...store.guardians, guardian];
    setMockStore(store);
    return guardian;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase ?ㅼ젙???뺤씤??二쇱꽭??");

  const { data, error } = await supabase
    .from("guardians")
    .insert({
      id: guardian.id,
      shop_id: guardian.shop_id,
      name: guardian.name,
      phone: guardian.phone,
      memo: guardian.memo,
      notification_settings: guardian.notification_settings,
      created_at: guardian.created_at,
      updated_at: guardian.updated_at,
    })
    .select("*")
    .single();

  if (error) {
    if (hasMissingColumnError(error, "notification_settings")) {
      const fallback = await supabase
        .from("guardians")
        .insert({
          id: guardian.id,
          shop_id: guardian.shop_id,
          name: guardian.name,
          phone: guardian.phone,
          memo: guardian.memo,
          created_at: guardian.created_at,
          updated_at: guardian.updated_at,
        })
        .select("*")
        .single();

      if (fallback.error) throw new Error(fallback.error.message);
      return {
        ...guardian,
        ...(fallback.data ?? {}),
      };
    }

    throw new Error(error.message);
  }

  return {
    ...guardian,
    ...(data ?? {}),
  };
}

export async function updateGuardian(input: unknown) {
  const payload = guardianUpdateSchema.parse(input);
  const notificationSettingsPatch = {
    ...(payload.notificationSettings ?? {}),
    ...(typeof payload.enabled === "boolean" ? { enabled: payload.enabled } : {}),
    ...(typeof payload.revisitEnabled === "boolean" ? { revisit_enabled: payload.revisitEnabled } : {}),
  };
  const hasNotificationSettingsPatch = Object.keys(notificationSettingsPatch).length > 0;

  if (!hasSupabaseServerEnv()) {
    const store = getMutableStore();
    const guardian = store.guardians.find((item) => item.id === payload.guardianId && (!payload.shopId || item.shop_id === payload.shopId));
    if (!guardian) throw new Error("怨좉컼 ?뺣낫瑜?李얠쓣 ???놁뼱??");

    if (typeof payload.name === "string") guardian.name = payload.name;
    if (typeof payload.phone === "string") guardian.phone = payload.phone;
    if (typeof payload.memo === "string") guardian.memo = payload.memo;
    if (hasNotificationSettingsPatch) {
      guardian.notification_settings = normalizeGuardianNotificationSettings({
        ...guardian.notification_settings,
        ...notificationSettingsPatch,
      });
    }
    guardian.updated_at = nowIso();
    setMockStore(store);
    return guardian;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase ?ㅼ젙???뺤씤??二쇱꽭??");

  let currentGuardianQuery = supabase.from("guardians").select("*").eq("id", payload.guardianId);
  if (payload.shopId) currentGuardianQuery = currentGuardianQuery.eq("shop_id", payload.shopId);

  const currentGuardian = await currentGuardianQuery.single();
  if (currentGuardian.error) throw new Error(currentGuardian.error.message);

  const nextNotificationSettings = normalizeGuardianNotificationSettings({
    ...((currentGuardian.data?.notification_settings as Partial<Guardian["notification_settings"]> | null) ?? {}),
    ...notificationSettingsPatch,
  });

  const nextValues = {
    ...(typeof payload.name === "string" ? { name: payload.name } : {}),
    ...(typeof payload.phone === "string" ? { phone: payload.phone } : {}),
    ...(typeof payload.memo === "string" ? { memo: payload.memo } : {}),
    ...(hasNotificationSettingsPatch ? { notification_settings: nextNotificationSettings } : {}),
    updated_at: nowIso(),
  };

  let updateQuery = supabase
    .from("guardians")
    .update(nextValues)
    .eq("id", payload.guardianId);
  if (payload.shopId) updateQuery = updateQuery.eq("shop_id", payload.shopId);

  const { data, error } = await updateQuery.select("*").single();

  if (error) {
    if (hasMissingColumnError(error, "notification_settings")) {
      const { notification_settings: _ignored, ...fallbackValues } = nextValues as typeof nextValues & {
        notification_settings?: unknown;
      };

      let fallbackQuery = supabase
        .from("guardians")
        .update(fallbackValues)
        .eq("id", payload.guardianId);
      if (payload.shopId) fallbackQuery = fallbackQuery.eq("shop_id", payload.shopId);

      const fallback = await fallbackQuery.select("*").single();

      if (fallback.error) throw new Error(fallback.error.message);
      return fallback.data;
    }

    throw new Error(error.message);
  }

  return data;
}

export async function deleteGuardian(input: unknown) {
  const payload = guardianDeleteSchema.parse(input);

  if (!hasSupabaseServerEnv()) {
    const store = getMutableStore();
    const guardian = store.guardians.find((item) => item.id === payload.guardianId);
    if (!guardian) throw new Error("怨좉컼 ?뺣낫瑜?李얠쓣 ???놁뼱??");

    const petIds = new Set(store.pets.filter((item) => item.guardian_id === payload.guardianId).map((item) => item.id));

    store.guardians = store.guardians.filter((item) => item.id !== payload.guardianId);
    store.pets = store.pets.filter((item) => item.guardian_id !== payload.guardianId);
    store.appointments = store.appointments.filter((item) => item.guardian_id !== payload.guardianId);
    store.groomingRecords = store.groomingRecords.filter((item) => item.guardian_id !== payload.guardianId);
    store.notifications = store.notifications.filter(
      (item) => item.guardian_id !== payload.guardianId && !(item.pet_id && petIds.has(item.pet_id)),
    );

    setMockStore(store);
    return { success: true, guardianId: payload.guardianId };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase ?ㅼ젙???뺤씤??二쇱꽭??");

  const petQuery = await supabase.from("pets").select("id").eq("guardian_id", payload.guardianId);
  if (petQuery.error) throw new Error(petQuery.error.message);
  const petIds = (petQuery.data ?? []).map((item) => item.id);

  const notificationDelete = await supabase.from("notifications").delete().eq("guardian_id", payload.guardianId);
  if (notificationDelete.error) throw new Error(notificationDelete.error.message);

  if (petIds.length > 0) {
    const orphanNotificationDelete = await supabase.from("notifications").delete().in("pet_id", petIds);
    if (orphanNotificationDelete.error) throw new Error(orphanNotificationDelete.error.message);
  }

  const recordDelete = await supabase.from("grooming_records").delete().eq("guardian_id", payload.guardianId);
  if (recordDelete.error) throw new Error(recordDelete.error.message);

  const appointmentDelete = await supabase.from("appointments").delete().eq("guardian_id", payload.guardianId);
  if (appointmentDelete.error) throw new Error(appointmentDelete.error.message);

  const petDelete = await supabase.from("pets").delete().eq("guardian_id", payload.guardianId);
  if (petDelete.error) throw new Error(petDelete.error.message);

  const guardianDelete = await supabase.from("guardians").delete().eq("id", payload.guardianId);
  if (guardianDelete.error) throw new Error(guardianDelete.error.message);

  return { success: true, guardianId: payload.guardianId };
}

export async function softDeleteGuardians(input: unknown) {
  const payload = guardianDeleteSchema.parse(input);
  const guardianIds = resolveGuardianIds(payload);

  if (guardianIds.length === 0) {
    throw new Error("??젣??怨좉컼???좏깮??二쇱꽭??");
  }

  const deletedAt = nowIso();
  const restoreUntil = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

  if (!hasSupabaseServerEnv()) {
    const store = getMutableStore();
    const existingIds = new Set(store.guardians.map((guardian) => guardian.id));
    const missingId = guardianIds.find((guardianId) => !existingIds.has(guardianId));
    if (missingId) throw new Error("??젣??怨좉컼 ?뺣낫瑜?李얠쓣 ???놁뒿?덈떎.");

    store.guardians = store.guardians.map((guardian) =>
      guardianIds.includes(guardian.id)
        ? {
            ...guardian,
            deleted_at: deletedAt,
            deleted_restore_until: restoreUntil,
            updated_at: deletedAt,
          }
        : guardian,
    );

    setMockStore(store);
    return { success: true, guardianIds, restoreUntil };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase ?ㅼ젙???뺤씤??二쇱꽭??");

  let query = supabase
    .from("guardians")
    .update({
      deleted_at: deletedAt,
      deleted_restore_until: restoreUntil,
      updated_at: deletedAt,
    })
    .in("id", guardianIds);

  if (payload.shopId) {
    query = query.eq("shop_id", payload.shopId);
  }

  const { data, error } = await query.select("id");

  if (error) throw new Error(error.message);
  const deletedIds = (data ?? []).map((guardian) => guardian.id);
  if (deletedIds.length !== guardianIds.length) {
    throw new Error("삭제할 고객을 찾지 못했거나 해당 매장의 고객이 아닙니다.");
  }

  return { success: true, guardianIds: deletedIds, restoreUntil };
}

export async function restoreGuardians(input: unknown) {
  const payload = guardianRestoreSchema.parse(input);
  const guardianIds = resolveGuardianIds(payload);

  if (guardianIds.length === 0) {
    throw new Error("蹂듦뎄??怨좉컼???좏깮??二쇱꽭??");
  }

  if (!hasSupabaseServerEnv()) {
    const store = getMutableStore();
    const now = Date.now();

    store.guardians = store.guardians.map((guardian) => {
      if (!guardianIds.includes(guardian.id)) return guardian;
      const restoreUntil = guardian.deleted_restore_until ? new Date(guardian.deleted_restore_until).getTime() : 0;
      if (!guardian.deleted_at || (restoreUntil && restoreUntil < now)) return guardian;

      return {
        ...guardian,
        deleted_at: null,
        deleted_restore_until: null,
        updated_at: nowIso(),
      };
    });

    setMockStore(store);
    return { success: true, guardianIds };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase ?ㅼ젙???뺤씤??二쇱꽭??");

  const guardiansQuery = await supabase
    .from("guardians")
    .select("id, deleted_at, deleted_restore_until")
    .in("id", guardianIds);

  if (guardiansQuery.error) throw new Error(guardiansQuery.error.message);

  const restorableIds = (guardiansQuery.data ?? [])
    .filter((guardian) => guardian.deleted_at)
    .filter((guardian) => guardian.deleted_restore_until && new Date(guardian.deleted_restore_until).getTime() >= Date.now())
    .map((guardian) => guardian.id);

  if (restorableIds.length === 0) {
    throw new Error("蹂듦뎄 媛?ν븳 怨좉컼???놁뒿?덈떎.");
  }

  const { error } = await supabase
    .from("guardians")
    .update({
      deleted_at: null,
      deleted_restore_until: null,
      updated_at: nowIso(),
    })
    .in("id", restorableIds);

  if (error) throw new Error(error.message);

  return { success: true, guardianIds: restorableIds };
}

export async function createPet(input: unknown) {
  const payload = petInputSchema.parse(input);
  const pet: Pet = {
    id: randomUUID(),
    shop_id: payload.shopId,
    guardian_id: payload.guardianId,
    name: payload.name,
    breed: payload.breed,
    weight: payload.weight ?? null,
    age: payload.age ?? null,
    notes: payload.notes ?? "",
    bite_level: payload.biteLevel ?? "none",
    birthday: payload.birthday ?? null,
    grooming_cycle_weeks: payload.groomingCycleWeeks,
    avatar_seed: payload.name.trim().slice(0, 1) || "P",
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  if (!hasSupabaseServerEnv()) {
    const store = getMutableStore();
    const guardian = store.guardians.find((item) => item.id === payload.guardianId && item.shop_id === payload.shopId);
    if (!guardian) throw new Error("고객 정보를 찾을 수 없습니다.");
    store.pets = [...store.pets, pet];
    setMockStore(store);
    return pet;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase ?ㅼ젙???뺤씤??二쇱꽭??");

  const guardian = await supabase.from("guardians").select("id").eq("id", payload.guardianId).eq("shop_id", payload.shopId).single();
  if (guardian.error) throw new Error("고객 정보를 찾을 수 없습니다.");

  const { data, error } = await supabase.from("pets").insert(pet).select("*").single();
  if (error) {
    if (isMissingPetBiteLevelColumn(error)) {
      const { bite_level: _biteLevel, ...petWithoutBiteLevel } = pet;
      const retry = await supabase.from("pets").insert(petWithoutBiteLevel).select("*").single();
      if (retry.error) throw new Error(retry.error.message);
      return retry.data;
    }
    throw new Error(error.message);
  }
  return data;
}

export async function updatePet(input: unknown) {
  const payload = petUpdateSchema.parse(input);

  if (!hasSupabaseServerEnv()) {
    const store = getMutableStore();
    const pet = store.pets.find((item) => item.id === payload.petId && (!payload.shopId || item.shop_id === payload.shopId));
    if (!pet) throw new Error("諛섎젮?숇Ъ ?뺣낫瑜?李얠쓣 ???놁뼱??");

    pet.name = payload.name;
    pet.breed = payload.breed;
    pet.birthday = payload.birthday ?? null;
    if (payload.weight !== undefined) pet.weight = payload.weight;
    if (payload.age !== undefined) pet.age = payload.age;
    if (payload.notes !== undefined) pet.notes = payload.notes;
    if (payload.biteLevel !== undefined) pet.bite_level = payload.biteLevel;
    if (payload.groomingCycleWeeks !== undefined) pet.grooming_cycle_weeks = payload.groomingCycleWeeks;
    pet.updated_at = nowIso();
    setMockStore(store);
    return pet;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase ?ㅼ젙???뺤씤??二쇱꽭??");

  let updateQuery = supabase
    .from("pets")
    .update({
      name: payload.name,
      breed: payload.breed,
      birthday: payload.birthday ?? null,
      ...(payload.weight !== undefined ? { weight: payload.weight } : {}),
      ...(payload.age !== undefined ? { age: payload.age } : {}),
      ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
      ...(payload.biteLevel !== undefined ? { bite_level: payload.biteLevel } : {}),
      ...(payload.groomingCycleWeeks !== undefined ? { grooming_cycle_weeks: payload.groomingCycleWeeks } : {}),
      updated_at: nowIso(),
    })
    .eq("id", payload.petId);
  if (payload.shopId) updateQuery = updateQuery.eq("shop_id", payload.shopId);

  const { data, error } = await updateQuery.select("*").single();

  if (error) {
    if (isMissingPetBiteLevelColumn(error)) {
      let retryQuery = supabase
        .from("pets")
        .update({
          name: payload.name,
          breed: payload.breed,
          birthday: payload.birthday ?? null,
          ...(payload.weight !== undefined ? { weight: payload.weight } : {}),
          ...(payload.age !== undefined ? { age: payload.age } : {}),
          ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
          ...(payload.groomingCycleWeeks !== undefined ? { grooming_cycle_weeks: payload.groomingCycleWeeks } : {}),
          updated_at: nowIso(),
        })
        .eq("id", payload.petId);
      if (payload.shopId) retryQuery = retryQuery.eq("shop_id", payload.shopId);
      const retry = await retryQuery.select("*").single();
      if (retry.error) throw new Error(retry.error.message);
      return retry.data;
    }
    throw new Error(error.message);
  }
  return data;
}

export async function upsertPetStaffNote(input: unknown) {
  const payload = petStaffNoteUpsertSchema.parse(input);
  const timestamp = nowIso();
  const noteValues = {
    shop_id: payload.shopId,
    guardian_id: payload.guardianId,
    pet_id: payload.petId ?? null,
    note: payload.note.trim(),
    note_scope: "staff_shared" as const,
    source: "owner_web" as const,
    updated_by_user_id: payload.userId ?? null,
    updated_at: timestamp,
  };

  if (!hasSupabaseServerEnv()) {
    return {
      id: payload.petId ? `${payload.shopId}-${payload.petId}-staff-note` : `${payload.shopId}-${payload.guardianId}-staff-note`,
      ...noteValues,
      created_by_user_id: payload.userId ?? null,
      created_at: timestamp,
    } satisfies PetStaffNote;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase 설정을 확인해 주세요.");

  const guardian = await supabase
    .from("guardians")
    .select("id")
    .eq("id", payload.guardianId)
    .eq("shop_id", payload.shopId)
    .single();
  if (guardian.error) throw new Error("고객 정보를 찾을 수 없습니다.");

  if (payload.petId) {
    const pet = await supabase
      .from("pets")
      .select("id")
      .eq("id", payload.petId)
      .eq("guardian_id", payload.guardianId)
      .eq("shop_id", payload.shopId)
      .single();
    if (pet.error) throw new Error("반려동물 정보를 찾을 수 없습니다.");
  }

  let existingQuery = supabase
    .from("pet_staff_notes")
    .select("id")
    .eq("shop_id", payload.shopId)
    .eq("guardian_id", payload.guardianId);
  existingQuery = payload.petId ? existingQuery.eq("pet_id", payload.petId) : existingQuery.is("pet_id", null);
  const existing = await existingQuery.maybeSingle();
  if (existing.error) throw new Error(existing.error.message);

  if (existing.data?.id) {
    const { data, error } = await supabase
      .from("pet_staff_notes")
      .update(noteValues)
      .eq("id", existing.data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as PetStaffNote;
  }

  const { data, error } = await supabase
    .from("pet_staff_notes")
    .insert({
      id: randomUUID(),
      ...noteValues,
      created_by_user_id: payload.userId ?? null,
      created_at: timestamp,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as PetStaffNote;
}

export async function deletePet(input: unknown) {
  const payload = petDeleteSchema.parse(input);

  if (!hasSupabaseServerEnv()) {
    const store = getMutableStore();
    const pet = store.pets.find((item) => item.id === payload.petId && (!payload.shopId || item.shop_id === payload.shopId));
    if (!pet) throw new Error("반려동물 정보를 찾을 수 없습니다.");
    const hasLinkedData =
      store.appointments.some((item) => item.pet_id === payload.petId) ||
      store.groomingRecords.some((item) => item.pet_id === payload.petId) ||
      store.notifications.some((item) => item.pet_id === payload.petId);
    if (hasLinkedData) throw new Error("예약이나 기록이 연결된 반려동물은 삭제할 수 없습니다.");

    store.pets = store.pets.filter((item) => item.id !== payload.petId);
    setMockStore(store);
    return { success: true, petId: payload.petId };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase ?ㅼ젙???뺤씤??二쇱꽭??");

  let petQuery = supabase.from("pets").select("id").eq("id", payload.petId);
  if (payload.shopId) petQuery = petQuery.eq("shop_id", payload.shopId);
  const pet = await petQuery.single();
  if (pet.error) throw new Error("반려동물 정보를 찾을 수 없습니다.");

  const [appointments, records, notifications] = await Promise.all([
    supabase.from("appointments").select("id").eq("pet_id", payload.petId).limit(1),
    supabase.from("grooming_records").select("id").eq("pet_id", payload.petId).limit(1),
    supabase.from("notifications").select("id").eq("pet_id", payload.petId).limit(1),
  ]);
  if (appointments.error) throw new Error(appointments.error.message);
  if (records.error) throw new Error(records.error.message);
  if (notifications.error) throw new Error(notifications.error.message);
  if ((appointments.data?.length ?? 0) > 0 || (records.data?.length ?? 0) > 0 || (notifications.data?.length ?? 0) > 0) {
    throw new Error("예약이나 기록이 연결된 반려동물은 삭제할 수 없습니다.");
  }

  const result = await supabase.from("pets").delete().eq("id", payload.petId);
  if (result.error) throw new Error(result.error.message);
  return { success: true, petId: payload.petId };
}

export async function createAppointment(input: unknown) {
  const payload = appointmentInputSchema.parse(input);
  const data = await getBootstrap(payload.shopId, {
    includeLanding: false,
    includeNotifications: false,
    includeGroomingRecords: false,
    appointmentsFrom: payload.appointmentDate,
    appointmentsTo: payload.appointmentDate,
  });
  const service = data.services.find((item) => item.id === payload.serviceId);

  if (!service) throw new Error("서비스 정보를 찾을 수 없습니다.");

  let resolvedStaffId = payload.staffId ?? null;
  if (!resolvedStaffId && data.staffMembers.length > 0) {
    const availableStaff = data.staffMembers.find((staffMember) =>
      computeAvailableSlots({
        date: payload.appointmentDate,
        serviceId: service.id,
        shop: data.shop,
        services: data.services,
        appointments: data.appointments,
        staffId: staffMember.id,
        staffMembers: data.staffMembers,
        staffScheduleOverrides: data.staffScheduleOverrides,
      }).includes(payload.appointmentTime),
    );

    if (!availableStaff) {
      throw new Error("선택한 시간에는 예약할 수 없습니다.");
    }

    resolvedStaffId = availableStaff.id;
  }

  const availableSlots = computeAvailableSlots({
    date: payload.appointmentDate,
    serviceId: service.id,
    shop: data.shop,
    services: data.services,
    appointments: data.appointments,
    staffId: resolvedStaffId,
    staffMembers: data.staffMembers,
    staffScheduleOverrides: data.staffScheduleOverrides,
  });

  if (!availableSlots.includes(payload.appointmentTime)) {
    throw new Error("선택한 시간에는 예약할 수 없습니다.");
  }

  ensureStaffAvailableForWindow({
    staffMembers: data.staffMembers,
    staffScheduleOverrides: data.staffScheduleOverrides,
    staffId: resolvedStaffId,
    date: payload.appointmentDate,
    appointmentTime: payload.appointmentTime,
    durationMinutes: service.duration_minutes,
  });

  const status = "confirmed";
  const appointmentWindow = buildAppointmentWindow(payload.appointmentDate, payload.appointmentTime, service.duration_minutes);
  const shopNotificationSettings = normalizeShopNotificationSettings(data.shop.notification_settings);
  const appointment: Appointment = {
    id: randomUUID(),
    shop_id: payload.shopId,
    guardian_id: payload.guardianId,
    pet_id: payload.petId,
    service_id: service.id,
    staff_id: resolvedStaffId,
    appointment_date: payload.appointmentDate,
    appointment_time: payload.appointmentTime,
    status,
    memo: payload.memo,
    rejection_reason: null,
    start_at: appointmentWindow.start_at,
    end_at: appointmentWindow.end_at,
    visit_reminder_offset_minutes:
      payload.visitReminderOffsetMinutes ?? shopNotificationSettings.visit_reminder_offset_minutes ?? defaultVisitReminderOffsetMinutes,
    pickup_ready_eta_minutes:
      payload.pickupReadyEtaMinutes ?? shopNotificationSettings.pickup_ready_eta_minutes ?? defaultPickupReadyEtaMinutes,
    source: payload.source,
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  if (data.mode !== "supabase" || !hasSupabaseServerEnv()) {
    const store = getMutableStore();
    store.appointments = [...store.appointments, appointment];
    setMockStore(store);
    if (appointment.status === "confirmed" && appointment.source === "owner") {
      await dispatchAppointmentNotificationWithLogs({
        shopId: appointment.shop_id,
        appointment,
        type: "booking_confirmed",
      });
    }
    return appointment;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase 설정을 확인해 주세요.");
  const { error } = await supabase.from("appointments").insert(appointment);
  if (error) {
    const missingRejectionReason = hasMissingColumnError(error, "rejection_reason");
    const missingStaffId = hasMissingColumnError(error, "staff_id");
    const missingVisitReminderOffset = hasMissingColumnError(error, "visit_reminder_offset_minutes");
    const missingPickupReadyEta = hasMissingColumnError(error, "pickup_ready_eta_minutes");

    if (missingRejectionReason || missingStaffId || missingVisitReminderOffset || missingPickupReadyEta) {
      const fallbackPayload: Record<string, unknown> = {
        id: appointment.id,
        shop_id: appointment.shop_id,
        guardian_id: appointment.guardian_id,
        pet_id: appointment.pet_id,
        service_id: appointment.service_id,
        appointment_date: appointment.appointment_date,
        appointment_time: appointment.appointment_time,
        status: appointment.status,
        memo: appointment.memo,
        start_at: appointment.start_at,
        end_at: appointment.end_at,
        source: appointment.source,
        created_at: appointment.created_at,
        updated_at: appointment.updated_at,
      };

      if (!missingStaffId) {
        fallbackPayload.staff_id = appointment.staff_id ?? null;
      }
      if (!missingVisitReminderOffset) {
        fallbackPayload.visit_reminder_offset_minutes = appointment.visit_reminder_offset_minutes;
      }
      if (!missingPickupReadyEta) {
        fallbackPayload.pickup_ready_eta_minutes = appointment.pickup_ready_eta_minutes;
      }

      const { error: fallbackError } = await supabase.from("appointments").insert(fallbackPayload);

      if (fallbackError) throw new Error(fallbackError.message);
      if (appointment.status === "confirmed" && appointment.source === "owner") {
        await dispatchAppointmentNotificationWithLogs({
          shopId: appointment.shop_id,
          appointment,
          type: "booking_confirmed",
        });
      }
      return appointment;
    }

    throw new Error(error.message);
  }
  if (appointment.status === "confirmed" && appointment.source === "owner") {
    await dispatchAppointmentNotificationWithLogs({
      shopId: appointment.shop_id,
      appointment,
      type: "booking_confirmed",
    });
  }

  return appointment;
}

export async function updateAppointmentStatus(input: unknown) {
  const payload = appointmentStatusSchema.parse(input);
  const rejectionReason = payload.status === "rejected" ? getRejectionReason(payload) : null;
  const statusMediaAssetIds = payload.mediaAssetIds ?? [];
  const shouldNotifyCustomer = payload.notifyCustomer !== false;
  const activatesSchedule = scheduleActiveStatuses.includes(payload.status as (typeof scheduleActiveStatuses)[number]);
  const statusChangedAt = nowIso();

  if (!hasSupabaseServerEnv()) {
    const store = getMutableStore();
    const appointment = store.appointments.find((item) => item.id === payload.appointmentId);
    if (!appointment) throw new Error("예약을 찾을 수 없습니다.");
    const previousAppointment = { ...appointment };

    assertAppointmentStatusIsNotRepeated({
      previousStatus: appointment.status,
      nextStatus: payload.status,
    });
    assertAppointmentStatusTransitionAllowed({
      previousStatus: appointment.status,
      nextStatus: payload.status,
    });

    assertPhotoRequirementForAppointmentStatus({
      status: payload.status,
      previousStatus: appointment.status,
      mediaAssetIds: statusMediaAssetIds,
      shop: store.shop,
    });

    if (payload.status === "confirmed") {
      ensureAppointmentCanBeConfirmed({
        appointment,
        shop: store.shop,
        services: store.services,
        appointments: store.appointments,
      });
    }
    if (activatesSchedule) {
      ensureAppointmentScheduleCanBeActivated({
        appointment,
        shop: store.shop,
        services: store.services,
        staffMembers: store.staffMembers,
        staffScheduleOverrides: store.staffScheduleOverrides,
        appointments: store.appointments,
      });
    }

    appointment.status = payload.status;
    appointment.rejection_reason = rejectionReason;
    if (payload.status === "in_progress") {
      appointment.actual_started_at = statusChangedAt;
    }
    if (payload.status === "completed") {
      appointment.actual_completed_at = statusChangedAt;
    }
    appointment.updated_at = statusChangedAt;

    if (payload.status === "completed" && !store.groomingRecords.some((record) => record.appointment_id === appointment.id)) {
      const service = store.services.find((item) => item.id === appointment.service_id);
      store.groomingRecords = [
        {
          id: randomUUID(),
          shop_id: appointment.shop_id,
          guardian_id: appointment.guardian_id,
          pet_id: appointment.pet_id,
        service_id: appointment.service_id,
        appointment_id: appointment.id,
        style_notes: appointment.memo,
        memo: "",
        price_paid: service?.price ?? 0,
        groomed_at: appointment.actual_completed_at ?? statusChangedAt,
        created_at: statusChangedAt,
        updated_at: statusChangedAt,
      },
        ...store.groomingRecords,
      ];
    }

    setMockStore(store);
    await persistAppointmentChangeEvent(createAppointmentChangeEvent({
      before: previousAppointment,
      after: appointment,
      eventType: "status",
      note: payload.eventType ?? null,
      createdAt: statusChangedAt,
    }));
    if (shouldNotifyCustomer && payload.status === "confirmed" && payload.eventType === "booking_rescheduled_confirmed") {
      await dispatchAppointmentNotificationWithLogs({
        shopId: appointment.shop_id,
        appointment,
        type: "booking_rescheduled_confirmed",
      });
    }
    if (shouldNotifyCustomer && payload.status === "rejected") {
      await dispatchAppointmentNotificationWithLogs({
        shopId: appointment.shop_id,
        appointment,
        type: "booking_rejected",
      });
    }
    if (shouldNotifyCustomer && payload.status === "cancelled") {
      await dispatchAppointmentNotificationWithLogs({
        shopId: appointment.shop_id,
        appointment,
        type: "booking_cancelled",
      });
    }
    if (shouldNotifyCustomer && payload.status === "in_progress") {
      await dispatchAppointmentNotificationWithLogs({
        shopId: appointment.shop_id,
        appointment,
        type: "grooming_started",
        mediaAssetIds: statusMediaAssetIds,
        force: true,
      });
    }
    if (shouldNotifyCustomer && payload.status === "almost_done") {
      await dispatchAppointmentNotificationWithLogs({
        shopId: appointment.shop_id,
        appointment,
        type: "grooming_almost_done",
        mediaAssetIds: statusMediaAssetIds,
        force: true,
      });
    }
    if (shouldNotifyCustomer && payload.status === "completed") {
      await dispatchAppointmentNotificationWithLogs({
        shopId: appointment.shop_id,
        appointment,
        type: "grooming_completed",
        mediaAssetIds: statusMediaAssetIds,
        force: true,
      });
    }
    return appointment;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase 설정을 확인해 주세요.");

  const { data: currentAppointment, error: appointmentError } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", payload.appointmentId)
    .single();

  if (appointmentError) throw new Error(appointmentError.message);
  const previousAppointment = currentAppointment as Appointment;

  assertAppointmentStatusIsNotRepeated({
    previousStatus: currentAppointment.status,
    nextStatus: payload.status,
  });
  assertAppointmentStatusTransitionAllowed({
    previousStatus: currentAppointment.status,
    nextStatus: payload.status,
  });

  const bootstrap = await getBootstrap(currentAppointment.shop_id);
  assertPhotoRequirementForAppointmentStatus({
    status: payload.status,
    previousStatus: currentAppointment.status,
    mediaAssetIds: statusMediaAssetIds,
    shop: bootstrap.shop,
  });

  if (payload.status === "confirmed") {
    ensureAppointmentCanBeConfirmed({
      appointment: currentAppointment,
      shop: bootstrap.shop,
      services: bootstrap.services,
      appointments: bootstrap.appointments,
    });
  }

  if (activatesSchedule) {
    ensureAppointmentScheduleCanBeActivated({
      appointment: currentAppointment,
      shop: bootstrap.shop,
      services: bootstrap.services,
      staffMembers: bootstrap.staffMembers,
      staffScheduleOverrides: bootstrap.staffScheduleOverrides,
      appointments: bootstrap.appointments,
    });
  }

  const appointmentUpdate: Record<string, unknown> = {
    status: payload.status,
    rejection_reason: rejectionReason,
    updated_at: statusChangedAt,
  };
  if (payload.status === "in_progress") {
    appointmentUpdate.actual_started_at = statusChangedAt;
  }
  if (payload.status === "completed") {
    appointmentUpdate.actual_completed_at = statusChangedAt;
  }

  const { data: updatedAppointment, error } = await supabase
    .from("appointments")
    .update(appointmentUpdate)
    .eq("id", payload.appointmentId)
    .neq("status", payload.status)
    .select("*")
    .single();

  let resolvedAppointment = updatedAppointment;

  if (error) {
    const missingActualGroomingTimes =
      hasMissingColumnError(error, "actual_started_at") ||
      hasMissingColumnError(error, "actual_completed_at");
    if (hasMissingColumnError(error, "rejection_reason") || missingActualGroomingTimes) {
      const fallback = await supabase
        .from("appointments")
        .update({
          status: payload.status,
          ...(hasMissingColumnError(error, "rejection_reason") ? {} : { rejection_reason: rejectionReason }),
          updated_at: statusChangedAt,
        })
        .eq("id", payload.appointmentId)
        .neq("status", payload.status)
        .select("*")
        .single();

      if (fallback.error) throw new Error(fallback.error.message);
      resolvedAppointment = {
        ...fallback.data,
        rejection_reason: rejectionReason,
        ...(payload.status === "in_progress" ? { actual_started_at: statusChangedAt } : {}),
        ...(payload.status === "completed" ? { actual_completed_at: statusChangedAt } : {}),
      };
    } else {
      if (error.code === "PGRST116" || error.message.includes("JSON object requested")) {
        throw new Error(`이미 '${getAppointmentStatusLabel(payload.status)}' 상태로 처리되었습니다. 같은 상태 알림은 반복 발송할 수 없어요.`);
      }
      throw new Error(error.message);
    }
  }

  if (payload.status === "completed") {
    const existingRecord = await supabase.from("grooming_records").select("id").eq("appointment_id", payload.appointmentId).maybeSingle();
    if (existingRecord.error) throw new Error(existingRecord.error.message);

    let groomingRecordId = existingRecord.data?.id ?? null;

    if (!existingRecord.data?.id) {
      const bootstrap = await getBootstrap(resolvedAppointment.shop_id);
      const service = bootstrap.services.find((item) => item.id === resolvedAppointment.service_id);
      groomingRecordId = randomUUID();

      const { error: recordError } = await supabase.from("grooming_records").insert({
        id: groomingRecordId,
        shop_id: resolvedAppointment.shop_id,
        guardian_id: resolvedAppointment.guardian_id,
        pet_id: resolvedAppointment.pet_id,
        service_id: resolvedAppointment.service_id,
        appointment_id: resolvedAppointment.id,
        style_notes: resolvedAppointment.memo,
        memo: "",
        price_paid: service?.price ?? 0,
        groomed_at: resolvedAppointment.actual_completed_at ?? statusChangedAt,
        created_at: statusChangedAt,
        updated_at: statusChangedAt,
      });

      if (recordError) throw new Error(recordError.message);
    }

    if (groomingRecordId) {
      const mediaLinkResult = await supabase
        .from("media_assets")
        .update({ grooming_record_id: groomingRecordId, updated_at: statusChangedAt })
        .eq("shop_id", resolvedAppointment.shop_id)
        .eq("appointment_id", resolvedAppointment.id)
        .is("grooming_record_id", null);

      if (mediaLinkResult.error) {
        console.warn("[owner-mutations] media record link failed", mediaLinkResult.error.message);
      }
    }
  }

  await persistAppointmentChangeEvent(createAppointmentChangeEvent({
    before: previousAppointment,
    after: resolvedAppointment as Appointment,
    eventType: "status",
    note: payload.eventType ?? null,
    createdAt: statusChangedAt,
  }));

  if (shouldNotifyCustomer && payload.status === "confirmed" && payload.eventType === "booking_rescheduled_confirmed") {
    await dispatchAppointmentNotificationWithLogs({
      shopId: resolvedAppointment.shop_id,
      appointment: resolvedAppointment,
      type: "booking_rescheduled_confirmed",
    });
  }
  if (shouldNotifyCustomer && payload.status === "rejected") {
    await dispatchAppointmentNotificationWithLogs({
      shopId: resolvedAppointment.shop_id,
      appointment: resolvedAppointment,
      type: "booking_rejected",
    });
  }
  if (shouldNotifyCustomer && payload.status === "cancelled") {
    await dispatchAppointmentNotificationWithLogs({
      shopId: resolvedAppointment.shop_id,
      appointment: resolvedAppointment,
      type: "booking_cancelled",
    });
  }
  if (shouldNotifyCustomer && payload.status === "in_progress") {
    await dispatchAppointmentNotificationWithLogs({
      shopId: resolvedAppointment.shop_id,
      appointment: resolvedAppointment,
      type: "grooming_started",
      mediaAssetIds: statusMediaAssetIds,
      force: true,
    });
  }
  if (shouldNotifyCustomer && payload.status === "almost_done") {
    await dispatchAppointmentNotificationWithLogs({
      shopId: resolvedAppointment.shop_id,
      appointment: resolvedAppointment,
      type: "grooming_almost_done",
      mediaAssetIds: statusMediaAssetIds,
      force: true,
    });
  }
  if (shouldNotifyCustomer && payload.status === "completed") {
    await dispatchAppointmentNotificationWithLogs({
      shopId: resolvedAppointment.shop_id,
      appointment: resolvedAppointment,
      type: "grooming_completed",
      mediaAssetIds: statusMediaAssetIds,
      force: true,
    });
  }

  return resolvedAppointment;
}

export async function updateAppointmentDetails(input: unknown) {
  const payload = appointmentEditSchema.parse(input);
  const data = await getBootstrap(payload.shopId);
  const appointment = data.appointments.find((item) => item.id === payload.appointmentId);

  if (!appointment) throw new Error("예약 정보를 찾을 수 없습니다.");
  const scheduleBoardAdjustment = payload.preserveStatus || !payload.notifyCustomer || payload.enforceShopCapacity === false;
  const editableStatuses = scheduleBoardAdjustment
    ? ["confirmed", "in_progress", "almost_done"]
    : ["confirmed", "cancelled"];
  if (!editableStatuses.includes(appointment.status)) {
    throw new Error("현재 예약 상태에서는 일정 수정이 어렵습니다.");
  }

  const service = data.services.find((item) => item.id === payload.serviceId);
  if (!service) throw new Error("서비스 정보를 찾을 수 없습니다.");
  const durationMinutes = payload.durationMinutes ?? service.duration_minutes;
  const notificationRelevantDetailsChanged = hasNotificationRelevantAppointmentDetailChange({
    appointment,
    serviceId: payload.serviceId,
    staffId: payload.staffId ?? appointment.staff_id ?? null,
    appointmentDate: payload.appointmentDate,
    appointmentTime: payload.appointmentTime,
    durationMinutes,
    visitReminderOffsetMinutes: payload.visitReminderOffsetMinutes,
    pickupReadyEtaMinutes: payload.pickupReadyEtaMinutes,
  });

  if (payload.notifyCustomer && !notificationRelevantDetailsChanged) {
    throw new Error("예약 날짜, 시간, 서비스, 담당자 등 고객에게 안내할 변경 사항이 없습니다. 같은 변경 완료 알림은 반복 발송할 수 없어요.");
  }

  if (payload.enforceShopCapacity) {
    const availableSlots = computeAvailableSlots({
      date: payload.appointmentDate,
      serviceId: payload.serviceId,
      durationMinutesOverride: durationMinutes,
      shop: data.shop,
      services: data.services,
      appointments: data.appointments,
      excludeAppointmentId: payload.appointmentId,
      staffId: payload.staffId ?? appointment.staff_id ?? null,
      staffMembers: data.staffMembers,
      staffScheduleOverrides: data.staffScheduleOverrides,
    });

    if (!availableSlots.includes(payload.appointmentTime)) {
      throw new Error("선택한 시간에는 예약할 수 없습니다.");
    }
  } else {
    ensureOwnerScheduleAdjustmentAvailable({
      appointment,
      shop: data.shop,
      services: data.services,
      staffMembers: data.staffMembers,
      staffScheduleOverrides: data.staffScheduleOverrides,
      appointments: data.appointments,
      date: payload.appointmentDate,
      appointmentTime: payload.appointmentTime,
      durationMinutes,
      staffId: payload.staffId ?? appointment.staff_id ?? null,
      allowOutsideShopHours: payload.allowOutsideShopHours,
    });
  }

  if (!payload.allowOutsideShopHours) {
    ensureStaffAvailableForWindow({
      staffMembers: data.staffMembers,
      staffScheduleOverrides: data.staffScheduleOverrides,
      staffId: payload.staffId ?? appointment.staff_id ?? null,
      date: payload.appointmentDate,
      appointmentTime: payload.appointmentTime,
      durationMinutes,
    });
  }

  const appointmentWindow = buildAppointmentWindow(payload.appointmentDate, payload.appointmentTime, durationMinutes);
  const nextValues = {
    service_id: payload.serviceId,
    staff_id: payload.staffId ?? null,
    appointment_date: payload.appointmentDate,
    appointment_time: payload.appointmentTime,
    memo: payload.memo.trim(),
    status: payload.preserveStatus ? appointment.status : ("confirmed" as const),
    rejection_reason: payload.preserveStatus ? appointment.rejection_reason : null,
    start_at: appointmentWindow.start_at,
    end_at: appointmentWindow.end_at,
    visit_reminder_offset_minutes:
      payload.visitReminderOffsetMinutes ?? appointment.visit_reminder_offset_minutes ?? defaultVisitReminderOffsetMinutes,
    pickup_ready_eta_minutes:
      payload.pickupReadyEtaMinutes ?? appointment.pickup_ready_eta_minutes ?? defaultPickupReadyEtaMinutes,
    updated_at: nowIso(),
  };

  if (data.mode !== "supabase" || !hasSupabaseServerEnv()) {
    const store = getMutableStore();
    const target = store.appointments.find((item) => item.id === payload.appointmentId);
    if (!target) throw new Error("예약 정보를 찾을 수 없습니다.");
    const previousAppointment = { ...target };

    Object.assign(target, nextValues);
    setMockStore(store);
    await persistAppointmentChangeEvent(createAppointmentChangeEvent({
      before: previousAppointment,
      after: target,
      eventType: "details",
      note: payload.eventType ?? null,
      createdAt: String(nextValues.updated_at),
    }));

    if (payload.notifyCustomer) {
      await dispatchNotification({
        shopId: target.shop_id,
        appointmentId: target.id,
        guardianId: target.guardian_id,
        petId: target.pet_id,
        type: payload.eventType === "booking_rescheduled_confirmed" ? "booking_rescheduled_confirmed" : "booking_rescheduled_confirmed",
      });
    }

    return target;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase 연결을 확인할 수 없습니다.");

  const { data: updatedAppointment, error } = await supabase
    .from("appointments")
    .update(nextValues)
    .eq("id", payload.appointmentId)
    .select("*")
    .single();

  let resolvedAppointment = updatedAppointment;

  if (error) {
    const missingRejectionReason = hasMissingColumnError(error, "rejection_reason");
    const missingStaffId = hasMissingColumnError(error, "staff_id");
    const missingVisitReminderOffset = hasMissingColumnError(error, "visit_reminder_offset_minutes");
    const missingPickupReadyEta = hasMissingColumnError(error, "pickup_ready_eta_minutes");

    if (missingRejectionReason || missingStaffId || missingVisitReminderOffset || missingPickupReadyEta) {
      const {
        rejection_reason: _ignored,
        staff_id: _ignoredStaffId,
        visit_reminder_offset_minutes: _ignoredVisitReminderOffset,
        pickup_ready_eta_minutes: _ignoredPickupReadyEta,
        ...fallbackValues
      } = nextValues;
      const nextFallbackValues: Record<string, unknown> = { ...fallbackValues };
      if (!missingStaffId) {
        nextFallbackValues.staff_id = nextValues.staff_id;
      }
      if (!missingVisitReminderOffset) {
        nextFallbackValues.visit_reminder_offset_minutes = nextValues.visit_reminder_offset_minutes;
      }
      if (!missingPickupReadyEta) {
        nextFallbackValues.pickup_ready_eta_minutes = nextValues.pickup_ready_eta_minutes;
      }
      const fallback = await supabase
        .from("appointments")
        .update(nextFallbackValues)
        .eq("id", payload.appointmentId)
        .select("*")
        .single();

      if (fallback.error) throw new Error(fallback.error.message);
      resolvedAppointment = {
        ...fallback.data,
        rejection_reason: null,
        visit_reminder_offset_minutes: nextValues.visit_reminder_offset_minutes,
        pickup_ready_eta_minutes: nextValues.pickup_ready_eta_minutes,
      };
    } else {
      throw new Error(error.message);
    }
  }

  await persistAppointmentChangeEvent(createAppointmentChangeEvent({
    before: appointment,
    after: resolvedAppointment as Appointment,
    eventType: "details",
    note: payload.eventType ?? null,
    createdAt: String(nextValues.updated_at),
  }));

  if (payload.notifyCustomer) {
    await dispatchNotification({
      shopId: resolvedAppointment.shop_id,
      appointmentId: resolvedAppointment.id,
      guardianId: resolvedAppointment.guardian_id,
      petId: resolvedAppointment.pet_id,
      type: payload.eventType === "booking_rescheduled_confirmed" ? "booking_rescheduled_confirmed" : "booking_rescheduled_confirmed",
    });
  }

  return resolvedAppointment;
}
