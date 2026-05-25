import { randomUUID } from "node:crypto";

import { after } from "next/server";

import { computeAvailableSlots, isRegularClosedOnDate, isSlotAvailable } from "@/lib/availability";
import {
  concurrentCapacityForApprovalMode,
  defaultBookingAvailableEndTime,
  defaultBookingAvailableStartTime,
  normalizeBookingAvailableTime,
} from "@/lib/booking-slot-settings";
import { normalizeCustomerPageSettings } from "@/lib/customer-page-settings";
import {
  coerceEnabledShopNotificationSettings,
  defaultGuardianNotificationSettings,
  normalizeBootstrapNotifications,
  normalizeGuardianNotificationSettings,
} from "@/lib/notification-settings";
import { hasBlockedWindowOverlap, normalizeReservationPolicySettings } from "@/lib/reservation-policy-settings";
import { hasSupabaseServerEnv } from "@/lib/server-env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { addDate, minutesFromTime, nowIso, timeFromMinutes } from "@/lib/utils";
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
  petUpdateSchema,
  serviceInputSchema,
  shopSettingsSchema,
} from "@/server/schemas";
import type { Appointment, Guardian, Pet, Service, Shop } from "@/types/domain";

const weekdayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const scheduleActiveStatuses = ["confirmed", "in_progress", "almost_done"] as const;

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

  const available = isSlotAvailable({
    date: appointment.appointment_date,
    startMinute: minutesFromTime(appointment.appointment_time),
    durationMinutes: service.duration_minutes,
    approvalMode: shop.approval_mode,
    pendingHoldLimit: shop.reservation_policy_settings?.pending_hold_limit,
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
}) {
  const { appointment, shop, services, staffMembers, staffScheduleOverrides, appointments, date, appointmentTime, durationMinutes, staffId } = params;
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(year, (month ?? 1) - 1, day ?? 1).getDay();
  const hours = shop.business_hours[weekday];
  const startMinute = minutesFromTime(appointmentTime);
  const endMinute = startMinute + durationMinutes;

  if (isRegularClosedOnDate(shop, date) || shop.temporary_closed_dates.includes(date) || !hours?.enabled) {
    throw new Error("매장 휴무일에는 예약 시간을 조정할 수 없습니다.");
  }

  if (startMinute < minutesFromTime(hours.open) || endMinute > minutesFromTime(hours.close)) {
    throw new Error("예약 시간이 매장 운영시간을 벗어납니다.");
  }

  const bookingStart = minutesFromTime(
    normalizeBookingAvailableTime(shop.booking_available_start_time, defaultBookingAvailableStartTime),
  );
  const bookingEnd = minutesFromTime(
    normalizeBookingAvailableTime(shop.booking_available_end_time, defaultBookingAvailableEndTime),
  );
  if (startMinute < bookingStart || startMinute > bookingEnd) {
    throw new Error("예약 시간이 미용 예약 가능 시간을 벗어납니다.");
  }

  if (hasBlockedWindowOverlap(shop.reservation_policy_settings, startMinute, endMinute)) {
    throw new Error("예약 제외 시간에는 예약 시간을 조정할 수 없습니다.");
  }

  if (!staffId) return;

  ensureStaffAvailableForWindow({
    staffMembers,
    staffScheduleOverrides,
    staffId,
    date,
    appointmentTime,
    durationMinutes,
  });

  const hasConflict = appointments.some((item) => {
    if (item.id === appointment.id) return false;
    if (item.appointment_date !== date) return false;
    if (item.staff_id !== staffId) return false;
    if (["cancelled", "rejected", "noshow"].includes(item.status)) return false;

    const itemStart = minutesFromTime(item.appointment_time);
    const itemDuration = getAppointmentDurationMinutes(item, services);
    if (!itemDuration) return false;
    return itemStart < endMinute && startMinute < itemStart + itemDuration;
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
    throw error;
  }
}

function scheduleAppointmentNotificationWithLogs(params: Parameters<typeof dispatchAppointmentNotificationWithLogs>[0]) {
  const task = async () => {
    try {
      await dispatchAppointmentNotificationWithLogs(params);
    } catch {
      // dispatchAppointmentNotificationWithLogs already logs the detailed failure.
    }
  };

  try {
    after(task);
  } catch {
    void task();
  }
}

export async function updateShopSettings(input: unknown) {
  const payload = shopSettingsSchema.parse(input);
  const nextNotificationSettings = {
    enabled: payload.notificationSettings.enabled,
    revisit_enabled: payload.notificationSettings.revisitEnabled,
    booking_confirmed_enabled: payload.notificationSettings.bookingConfirmedEnabled,
    booking_rejected_enabled: payload.notificationSettings.bookingRejectedEnabled,
    booking_cancelled_enabled: payload.notificationSettings.bookingCancelledEnabled,
    booking_rescheduled_enabled: payload.notificationSettings.bookingRescheduledEnabled,
    appointment_reminder_10m_enabled: payload.notificationSettings.appointmentReminder10mEnabled,
    grooming_started_enabled: payload.notificationSettings.groomingStartedEnabled,
    grooming_almost_done_enabled: payload.notificationSettings.groomingAlmostDoneEnabled,
    grooming_completed_enabled: payload.notificationSettings.groomingCompletedEnabled,
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

    throw new Error(error.message);
  }
  return service;
}

export async function updateCustomerPageSettings(input: unknown) {
  const payload = customerPageSettingsSchema.parse(input);
  const nextCustomerPageSettings = normalizeCustomerPageSettings(payload.customerPageSettings);

  if (!hasSupabaseServerEnv()) {
    const store = getMutableStore();
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
  if (error) throw new Error(error.message);
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
      updated_at: nowIso(),
    })
    .eq("id", payload.petId);
  if (payload.shopId) updateQuery = updateQuery.eq("shop_id", payload.shopId);

  const { data, error } = await updateQuery.select("*").single();

  if (error) throw new Error(error.message);
  return data;
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

  if (!service) throw new Error("?쒕퉬???뺣낫瑜?李얠쓣 ???놁뒿?덈떎.");

  const availableSlots = computeAvailableSlots({
    date: payload.appointmentDate,
    serviceId: service.id,
    shop: data.shop,
    services: data.services,
    appointments: data.appointments,
    staffId: payload.staffId ?? null,
    staffMembers: data.staffMembers,
    staffScheduleOverrides: data.staffScheduleOverrides,
  });

  if (!availableSlots.includes(payload.appointmentTime)) {
    throw new Error("?좏깮???쒓컙?먮뒗 ?덉빟?????놁뒿?덈떎.");
  }

  ensureStaffAvailableForWindow({
    staffMembers: data.staffMembers,
    staffScheduleOverrides: data.staffScheduleOverrides,
    staffId: payload.staffId,
    date: payload.appointmentDate,
    appointmentTime: payload.appointmentTime,
    durationMinutes: service.duration_minutes,
  });

  const status = payload.source === "owner" ? "confirmed" : data.shop.approval_mode === "auto" ? "confirmed" : "pending";
  const appointmentWindow = buildAppointmentWindow(payload.appointmentDate, payload.appointmentTime, service.duration_minutes);
  const appointment: Appointment = {
    id: randomUUID(),
    shop_id: payload.shopId,
    guardian_id: payload.guardianId,
    pet_id: payload.petId,
    service_id: service.id,
    staff_id: payload.staffId ?? null,
    appointment_date: payload.appointmentDate,
    appointment_time: payload.appointmentTime,
    status,
    memo: payload.memo,
    rejection_reason: null,
    start_at: appointmentWindow.start_at,
    end_at: appointmentWindow.end_at,
    source: payload.source,
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  if (data.mode !== "supabase" || !hasSupabaseServerEnv()) {
    const store = getMutableStore();
    store.appointments = [...store.appointments, appointment];
    setMockStore(store);
    if (appointment.status === "confirmed") {
      scheduleAppointmentNotificationWithLogs({
        shopId: appointment.shop_id,
        appointment,
        type: "booking_confirmed",
      });
    }
    return appointment;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase ?ㅼ젙???뺤씤??二쇱꽭??");
  const { error } = await supabase.from("appointments").insert(appointment);
  if (error) {
    const missingRejectionReason = hasMissingColumnError(error, "rejection_reason");
    const missingStaffId = hasMissingColumnError(error, "staff_id");

    if (missingRejectionReason || missingStaffId) {
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

      const { error: fallbackError } = await supabase.from("appointments").insert(fallbackPayload);

      if (fallbackError) throw new Error(fallbackError.message);
      if (appointment.status === "confirmed") {
        scheduleAppointmentNotificationWithLogs({
          shopId: appointment.shop_id,
          appointment,
          type: "booking_confirmed",
        });
      }
      return appointment;
    }

    throw new Error(error.message);
  }
  if (appointment.status === "confirmed") {
    scheduleAppointmentNotificationWithLogs({
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
  const activatesSchedule = scheduleActiveStatuses.includes(payload.status as (typeof scheduleActiveStatuses)[number]);

  if ((payload.status === "in_progress" || payload.status === "almost_done") && statusMediaAssetIds.length === 0) {
    throw new Error("미용 시작과 픽업 준비는 사진을 먼저 첨부해 주세요.");
  }

  if (!hasSupabaseServerEnv()) {
    const store = getMutableStore();
    const appointment = store.appointments.find((item) => item.id === payload.appointmentId);
    if (!appointment) throw new Error("?덉빟??李얠쓣 ???놁뒿?덈떎.");

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
    appointment.updated_at = nowIso();

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
        groomed_at: toTimestampString(appointment.appointment_date, appointment.appointment_time),
        created_at: nowIso(),
        updated_at: nowIso(),
      },
        ...store.groomingRecords,
      ];
    }

    setMockStore(store);
    if (payload.status === "confirmed") {
      await dispatchAppointmentNotificationWithLogs({
        shopId: appointment.shop_id,
        appointment,
        type: payload.eventType === "booking_rescheduled_confirmed" ? "booking_rescheduled_confirmed" : "booking_confirmed",
      });
    }
    if (payload.status === "rejected") {
      await dispatchAppointmentNotificationWithLogs({
        shopId: appointment.shop_id,
        appointment,
        type: "booking_rejected",
      });
    }
    if (payload.status === "cancelled") {
      await dispatchAppointmentNotificationWithLogs({
        shopId: appointment.shop_id,
        appointment,
        type: "booking_cancelled",
      });
    }
    if (payload.status === "in_progress") {
      await dispatchAppointmentNotificationWithLogs({
        shopId: appointment.shop_id,
        appointment,
        type: "grooming_started",
        mediaAssetIds: statusMediaAssetIds,
      });
    }
    if (payload.status === "almost_done") {
      await dispatchAppointmentNotificationWithLogs({
        shopId: appointment.shop_id,
        appointment,
        type: "grooming_almost_done",
        skipIfExists: statusMediaAssetIds.length === 0,
        mediaAssetIds: statusMediaAssetIds,
      });
    }
    if (payload.status === "completed") {
      await dispatchAppointmentNotificationWithLogs({
        shopId: appointment.shop_id,
        appointment,
        type: "grooming_completed",
      });
    }
    return appointment;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase ?ㅼ젙???뺤씤??二쇱꽭??");

  if (activatesSchedule) {
    const { data: appointmentToConfirm, error: appointmentError } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", payload.appointmentId)
      .single();

    if (appointmentError) throw new Error(appointmentError.message);

    const bootstrap = await getBootstrap(appointmentToConfirm.shop_id);
    if (payload.status === "confirmed") {
      ensureAppointmentCanBeConfirmed({
        appointment: appointmentToConfirm,
        shop: bootstrap.shop,
        services: bootstrap.services,
        appointments: bootstrap.appointments,
      });
    }
    ensureAppointmentScheduleCanBeActivated({
      appointment: appointmentToConfirm,
      shop: bootstrap.shop,
      services: bootstrap.services,
      staffMembers: bootstrap.staffMembers,
      staffScheduleOverrides: bootstrap.staffScheduleOverrides,
      appointments: bootstrap.appointments,
    });
  }

  const { data: updatedAppointment, error } = await supabase
    .from("appointments")
    .update({ status: payload.status, rejection_reason: rejectionReason, updated_at: nowIso() })
    .eq("id", payload.appointmentId)
    .select("*")
    .single();

  let resolvedAppointment = updatedAppointment;

  if (error) {
    if (hasMissingColumnError(error, "rejection_reason")) {
      const fallback = await supabase
        .from("appointments")
        .update({ status: payload.status, updated_at: nowIso() })
        .eq("id", payload.appointmentId)
        .select("*")
        .single();

      if (fallback.error) throw new Error(fallback.error.message);
      resolvedAppointment = {
        ...fallback.data,
        rejection_reason: rejectionReason,
      };
    } else {
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
        groomed_at: toTimestampString(resolvedAppointment.appointment_date, resolvedAppointment.appointment_time),
        created_at: nowIso(),
        updated_at: nowIso(),
      });

      if (recordError) throw new Error(recordError.message);
    }

    if (groomingRecordId) {
      const mediaLinkResult = await supabase
        .from("media_assets")
        .update({ grooming_record_id: groomingRecordId, updated_at: nowIso() })
        .eq("shop_id", resolvedAppointment.shop_id)
        .eq("appointment_id", resolvedAppointment.id)
        .is("grooming_record_id", null);

      if (mediaLinkResult.error) {
        console.warn("[owner-mutations] media record link failed", mediaLinkResult.error.message);
      }
    }
  }

  if (payload.status === "confirmed") {
    await dispatchAppointmentNotificationWithLogs({
      shopId: resolvedAppointment.shop_id,
      appointment: resolvedAppointment,
      type: payload.eventType === "booking_rescheduled_confirmed" ? "booking_rescheduled_confirmed" : "booking_confirmed",
    });
  }
  if (payload.status === "rejected") {
    await dispatchAppointmentNotificationWithLogs({
      shopId: resolvedAppointment.shop_id,
      appointment: resolvedAppointment,
      type: "booking_rejected",
    });
  }
  if (payload.status === "cancelled") {
    await dispatchAppointmentNotificationWithLogs({
      shopId: resolvedAppointment.shop_id,
      appointment: resolvedAppointment,
      type: "booking_cancelled",
    });
  }
  if (payload.status === "in_progress") {
    await dispatchAppointmentNotificationWithLogs({
      shopId: resolvedAppointment.shop_id,
      appointment: resolvedAppointment,
      type: "grooming_started",
      mediaAssetIds: statusMediaAssetIds,
    });
  }
  if (payload.status === "almost_done") {
    await dispatchAppointmentNotificationWithLogs({
      shopId: resolvedAppointment.shop_id,
      appointment: resolvedAppointment,
      type: "grooming_almost_done",
      skipIfExists: statusMediaAssetIds.length === 0,
      mediaAssetIds: statusMediaAssetIds,
    });
  }
  if (payload.status === "completed") {
    await dispatchAppointmentNotificationWithLogs({
      shopId: resolvedAppointment.shop_id,
      appointment: resolvedAppointment,
      type: "grooming_completed",
    });
  }

  return resolvedAppointment;
}

export async function updateAppointmentDetails(input: unknown) {
  const payload = appointmentEditSchema.parse(input);
  const data = await getBootstrap(payload.shopId);
  const appointment = data.appointments.find((item) => item.id === payload.appointmentId);

  if (!appointment) throw new Error("?덉빟 ?뺣낫瑜?李얠쓣 ???놁뒿?덈떎.");
  const scheduleBoardAdjustment = payload.preserveStatus || !payload.notifyCustomer || payload.enforceShopCapacity === false;
  const editableStatuses = scheduleBoardAdjustment
    ? ["pending", "confirmed", "in_progress", "almost_done"]
    : ["pending", "confirmed", "cancelled"];
  if (!editableStatuses.includes(appointment.status)) {
    throw new Error("???덉빟 ?곹깭?먯꽌???쇱젙 ?섏젙???대졄?듬땲??");
  }

  const service = data.services.find((item) => item.id === payload.serviceId);
  if (!service) throw new Error("?쒕퉬???뺣낫瑜?李얠쓣 ???놁뒿?덈떎.");
  const durationMinutes = payload.durationMinutes ?? service.duration_minutes;

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
      throw new Error("?좏깮???쒓컙?먮뒗 ?덉빟?????놁뒿?덈떎.");
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
    });
  }

  ensureStaffAvailableForWindow({
    staffMembers: data.staffMembers,
    staffScheduleOverrides: data.staffScheduleOverrides,
    staffId: payload.staffId ?? appointment.staff_id ?? null,
    date: payload.appointmentDate,
    appointmentTime: payload.appointmentTime,
    durationMinutes,
  });

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
    updated_at: nowIso(),
  };

  if (data.mode !== "supabase" || !hasSupabaseServerEnv()) {
    const store = getMutableStore();
    const target = store.appointments.find((item) => item.id === payload.appointmentId);
    if (!target) throw new Error("?덉빟 ?뺣낫瑜?李얠쓣 ???놁뒿?덈떎.");

    Object.assign(target, nextValues);
    setMockStore(store);

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
  if (!supabase) throw new Error("Supabase ?곌껐???뺤씤?????놁뒿?덈떎.");

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

    if (missingRejectionReason || missingStaffId) {
      const { rejection_reason: _ignored, staff_id: _ignoredStaffId, ...fallbackValues } = nextValues;
      const nextFallbackValues = missingStaffId ? fallbackValues : { ...fallbackValues, staff_id: nextValues.staff_id };
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
      };
    } else {
      throw new Error(error.message);
    }
  }

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

