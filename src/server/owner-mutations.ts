import { randomUUID } from "node:crypto";

import { computeAvailableSlots } from "@/lib/availability";
import { coerceEnabledShopNotificationSettings, defaultGuardianNotificationSettings, normalizeBootstrapNotifications } from "@/lib/notification-settings";
import { hasSupabaseServerEnv } from "@/lib/server-env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { addDate, minutesFromTime, nowIso, timeFromMinutes } from "@/lib/utils";
import { createAppointmentWithCapacityLock, updateAppointmentWithCapacityLock } from "@/server/appointment-capacity";
import { getBootstrap } from "@/server/bootstrap";
import { getMockStore, setMockStore } from "@/server/mock-store";
import { dispatchNotification } from "@/server/notification-dispatch";
import {
  appointmentInputSchema,
  appointmentEditSchema,
  appointmentStatusSchema,
  guardianDeleteSchema,
  guardianInputSchema,
  guardianRestoreSchema,
  guardianUpdateSchema,
  petInputSchema,
  petUpdateSchema,
  serviceInputSchema,
  shopSettingsSchema,
  staffMemberProfileSchema,
} from "@/server/schemas";
import type { Appointment, AppointmentChangeEvent, AppointmentStatus, Guardian, Pet, Service, StaffMember } from "@/types/domain";

function buildAppointmentWindow(date: string, time: string, durationMinutes: number) {
  const endMinute = minutesFromTime(time) + durationMinutes;

  return {
    start_at: `${date}T${time}:00+09:00`,
    end_at: `${addDate(date, Math.floor(endMinute / (24 * 60)))}T${timeFromMinutes(endMinute % (24 * 60))}:00+09:00`,
  };
}

function toTimestampString(date: string, time: string) {
  const normalizedTime = /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : time;
  return `${date}T${normalizedTime}.000Z`;
}

function getRejectionReason(payload: {
  rejectionReasonTemplate?: string;
  rejectionReasonCustom?: string;
}) {
  if (payload.rejectionReasonTemplate === "疫꿸퀬? 筌욊낯????낆젾") {
    return payload.rejectionReasonCustom?.trim() || "疫꿸퀬? ???";
  }

  return payload.rejectionReasonTemplate?.trim() || payload.rejectionReasonCustom?.trim() || null;
}

function getAppointmentStatusLabel(status: AppointmentStatus) {
  const labels: Record<AppointmentStatus, string> = {
    pending: "승인 대기",
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

function assertAppointmentStatusTransitionAllowed(previousStatus: AppointmentStatus, nextStatus: AppointmentStatus) {
  if (previousStatus === nextStatus) {
    throw new Error(`이미 '${getAppointmentStatusLabel(nextStatus)}' 상태입니다.`);
  }

  if (["completed", "cancelled", "rejected", "noshow"].includes(previousStatus)) {
    throw new Error("이미 종료된 예약은 다시 상태를 변경할 수 없습니다.");
  }

  if (nextStatus === "in_progress" && previousStatus !== "confirmed") {
    throw new Error("미용 시작은 예약 확정 상태에서만 처리할 수 있습니다.");
  }
  if (nextStatus === "almost_done" && previousStatus !== "in_progress") {
    throw new Error("픽업 준비는 미용 시작 후에만 처리할 수 있습니다.");
  }
  if (nextStatus === "completed" && !["in_progress", "almost_done"].includes(previousStatus)) {
    throw new Error("미용 완료는 미용 시작 또는 픽업 준비 상태에서만 처리할 수 있습니다.");
  }
}

function buildAppointmentHistorySnapshot(appointment: Appointment) {
  return {
    status: appointment.status,
    service_id: appointment.service_id,
    staff_id: appointment.staff_id ?? null,
    appointment_date: appointment.appointment_date,
    appointment_time: appointment.appointment_time,
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

async function persistAppointmentChangeEvent(params: {
  before: Appointment;
  after: Appointment;
  eventType: AppointmentChangeEvent["event_type"];
  note?: string | null;
}) {
  const event: AppointmentChangeEvent = {
    id: randomUUID(),
    shop_id: params.after.shop_id,
    appointment_id: params.after.id,
    event_type: params.eventType,
    previous_values: buildAppointmentHistorySnapshot(params.before),
    next_values: buildAppointmentHistorySnapshot(params.after),
    note: params.note ?? null,
    created_at: nowIso(),
  };

  if (!hasSupabaseServerEnv()) {
    const store = getMutableStore();
    store.appointmentChangeEvents = [event, ...(store.appointmentChangeEvents ?? [])];
    setMockStore(store);
    return;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  const result = await supabase.from("appointment_change_events").insert(event);
  if (result.error) {
    console.warn("[owner-mutations] appointment change event skipped", result.error.message);
  }
}

function hasMissingColumnError(
  error: {
    message?: string | null;
    details?: string | null;
    hint?: string | null;
  } | null | undefined,
  column: string,
) {
  const haystack = [error?.message, error?.details, error?.hint].filter(Boolean).join(" ").toLowerCase();
  const needle = column.toLowerCase();
  return haystack.includes(needle) && (haystack.includes("column") || haystack.includes("schema cache"));
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
    throw error;
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
  const fullUpdatePayload = {
    name: payload.name,
    phone: payload.phone,
    address: payload.address,
    description: payload.description,
    concurrent_capacity: payload.concurrentCapacity,
    booking_slot_interval_minutes: payload.bookingSlotIntervalMinutes,
    booking_slot_offset_minutes: payload.bookingSlotOffsetMinutes,
    booking_available_start_time: payload.bookingAvailableStartTime,
    booking_available_end_time: payload.bookingAvailableEndTime,
    approval_mode: "auto" as const,
    regular_closed_days: payload.regularClosedDays,
    temporary_closed_dates: payload.temporaryClosedDates,
    business_hours: payload.businessHours,
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
      concurrent_capacity: payload.concurrentCapacity,
      booking_slot_interval_minutes: payload.bookingSlotIntervalMinutes,
      booking_slot_offset_minutes: payload.bookingSlotOffsetMinutes,
      booking_available_start_time: payload.bookingAvailableStartTime,
      booking_available_end_time: payload.bookingAvailableEndTime,
      approval_mode: "auto" as const,
      regular_closed_days: payload.regularClosedDays,
      temporary_closed_dates: payload.temporaryClosedDates,
      business_hours: Object.fromEntries(Object.entries(payload.businessHours).map(([key, value]) => [Number(key), value])),
      notification_settings: normalizedNotificationSettings,
      updated_at: nowIso(),
    };

    if (payload.approvalMode === "auto" || payload.approvalMode === "manual") {
      store.appointments = store.appointments.map((appointment) =>
        appointment.shop_id === payload.shopId && appointment.status === "pending"
          ? { ...appointment, status: "confirmed", updated_at: nowIso() }
          : appointment,
      );
    }

    setMockStore(store);
    return store.shop;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase 설정을 확인해 주세요.");

  const runShopUpdate = async ({
    includeBookingSlotSettings,
    includeNotificationSettings,
  }: {
    includeBookingSlotSettings: boolean;
    includeNotificationSettings: boolean;
  }) => {
    const nextPayload: Record<string, unknown> = {
      ...fullUpdatePayload,
    };

    if (!includeBookingSlotSettings) {
      delete nextPayload.booking_slot_interval_minutes;
      delete nextPayload.booking_slot_offset_minutes;
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

  const { data, error } = await runShopUpdate({
    includeBookingSlotSettings: true,
    includeNotificationSettings: true,
  });

  if (error) {
    const missingBookingSlotSettings =
      hasMissingColumnError(error, "booking_slot_interval_minutes") ||
      hasMissingColumnError(error, "booking_slot_offset_minutes");
    const missingNotificationSettings = hasMissingColumnError(error, "notification_settings");

    if (missingBookingSlotSettings || missingNotificationSettings) {
      let fallback = await runShopUpdate({
        includeBookingSlotSettings: !missingBookingSlotSettings,
        includeNotificationSettings: !missingNotificationSettings,
      });

      if (
        fallback.error &&
        !missingNotificationSettings &&
        hasMissingColumnError(fallback.error, "notification_settings")
      ) {
        fallback = await runShopUpdate({
          includeBookingSlotSettings: !missingBookingSlotSettings,
          includeNotificationSettings: false,
        });
      }

      if (fallback.error) {
        throw new Error(fallback.error.message);
      }

      if (payload.approvalMode === "auto" || payload.approvalMode === "manual") {
        const pendingPromotion = await supabase
          .from("appointments")
          .update({ status: "confirmed", updated_at: nowIso() })
          .eq("shop_id", payload.shopId)
          .eq("status", "pending");

        if (pendingPromotion.error && !hasMissingColumnError(pendingPromotion.error, "rejection_reason")) {
          throw new Error(pendingPromotion.error.message);
        }
      }

      return fallback.data;
    }

    throw new Error(error.message);
  }

  if (payload.approvalMode === "auto" || payload.approvalMode === "manual") {
    const pendingPromotion = await supabase
      .from("appointments")
      .update({ status: "confirmed", updated_at: nowIso() })
      .eq("shop_id", payload.shopId)
      .eq("status", "pending");

    if (pendingPromotion.error && !hasMissingColumnError(pendingPromotion.error, "rejection_reason")) {
      throw new Error(pendingPromotion.error.message);
    }
  }

  return data;
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
  if (!supabase) throw new Error("Supabase 설정을 확인해 주세요.");

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

export async function upsertStaffMemberProfile(input: unknown) {
  const payload = staffMemberProfileSchema.parse(input);
  const now = nowIso();
  const staffMember: StaffMember = {
    id: payload.staffMemberId ?? randomUUID(),
    shopId: payload.shopId,
    name: payload.name,
    displayName: payload.displayName || null,
    profileImageUrl: payload.profileImageUrls[0] || payload.profileImageUrl || null,
    profileImageUrls: payload.profileImageUrls.length ? payload.profileImageUrls : payload.profileImageUrl ? [payload.profileImageUrl] : [],
    profileImageAssetIds: payload.profileImageAssetIds,
    titlePrefix: payload.titlePrefix || null,
    position: payload.position || null,
    chipColorIndex: payload.chipColorIndex ?? null,
    profileMessage: payload.profileMessage || null,
    created_at: now,
    updated_at: now,
  };

  if (!hasSupabaseServerEnv()) {
    const store = getMutableStore();
    const index = store.staffMembers.findIndex((item) => item.id === staffMember.id);
    if (index >= 0) {
      store.staffMembers[index] = {
        ...store.staffMembers[index],
        ...staffMember,
        created_at: store.staffMembers[index].created_at,
      };
    } else {
      store.staffMembers = [...store.staffMembers, staffMember];
    }
    setMockStore(store);
    return staffMember;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase 설정을 확인해 주세요.");

  const dbPayload = {
    shop_id: staffMember.shopId,
    name: staffMember.name,
    display_name: staffMember.displayName,
    profile_image_url: staffMember.profileImageUrl,
    profile_image_urls: staffMember.profileImageUrls ?? [],
    profile_image_asset_ids: staffMember.profileImageAssetIds ?? [],
    title_prefix: staffMember.titlePrefix,
    position: staffMember.position,
    chip_color_index: staffMember.chipColorIndex,
    profile_message: staffMember.profileMessage,
    updated_at: staffMember.updated_at,
  };

  if (payload.staffMemberId) {
    const { error } = await supabase
      .from("staff_members")
      .update(dbPayload)
      .eq("id", staffMember.id)
      .eq("shop_id", staffMember.shopId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("staff_members").insert({
      id: staffMember.id,
      ...dbPayload,
      created_at: staffMember.created_at,
    });
    if (error) throw new Error(error.message);
  }

  return staffMember;
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
  if (!supabase) throw new Error("Supabase 설정을 확인해 주세요.");

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

  if (!hasSupabaseServerEnv()) {
    const store = getMutableStore();
    const guardian = store.guardians.find((item) => item.id === payload.guardianId);
    if (!guardian) throw new Error("고객 정보를 찾을 수 없습니다.");

    if (typeof payload.name === "string") guardian.name = payload.name;
    if (typeof payload.phone === "string") guardian.phone = payload.phone;
    if (typeof payload.memo === "string") guardian.memo = payload.memo;
    if (typeof payload.enabled === "boolean" || typeof payload.revisitEnabled === "boolean" || payload.notificationSettings) {
      guardian.notification_settings = {
        ...guardian.notification_settings,
        ...(payload.notificationSettings ?? {}),
        ...(typeof payload.enabled === "boolean" ? { enabled: payload.enabled } : {}),
        ...(typeof payload.revisitEnabled === "boolean" ? { revisit_enabled: payload.revisitEnabled } : {}),
      };
    }
    guardian.updated_at = nowIso();
    setMockStore(store);
    return guardian;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase 설정을 확인해 주세요.");

  const currentGuardian = await supabase.from("guardians").select("*").eq("id", payload.guardianId).single();
  if (currentGuardian.error) throw new Error(currentGuardian.error.message);

  const nextNotificationSettings = {
    ...((currentGuardian.data?.notification_settings as Record<string, boolean> | null) ?? {}),
    ...(payload.notificationSettings ?? {}),
    ...(typeof payload.enabled === "boolean" ? { enabled: payload.enabled } : {}),
    ...(typeof payload.revisitEnabled === "boolean" ? { revisit_enabled: payload.revisitEnabled } : {}),
  };

  const nextValues = {
    ...(typeof payload.name === "string" ? { name: payload.name } : {}),
    ...(typeof payload.phone === "string" ? { phone: payload.phone } : {}),
    ...(typeof payload.memo === "string" ? { memo: payload.memo } : {}),
    ...((typeof payload.enabled === "boolean" || typeof payload.revisitEnabled === "boolean" || payload.notificationSettings)
      ? { notification_settings: nextNotificationSettings }
      : {}),
    updated_at: nowIso(),
  };

  const { data, error } = await supabase
    .from("guardians")
    .update(nextValues)
    .eq("id", payload.guardianId)
    .select("*")
    .single();

  if (error) {
    if (hasMissingColumnError(error, "notification_settings")) {
      const { notification_settings: _ignored, ...fallbackValues } = nextValues as typeof nextValues & {
        notification_settings?: unknown;
      };

      const fallback = await supabase
        .from("guardians")
        .update(fallbackValues)
        .eq("id", payload.guardianId)
        .select("*")
        .single();

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
    if (!guardian) throw new Error("고객 정보를 찾을 수 없습니다.");

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
  if (!supabase) throw new Error("Supabase 설정을 확인해 주세요.");

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
    throw new Error("삭제할 고객을 선택해 주세요.");
  }

  const deletedAt = nowIso();
  const restoreUntil = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

  if (!hasSupabaseServerEnv()) {
    const store = getMutableStore();
    const existingIds = new Set(store.guardians.map((guardian) => guardian.id));
    const missingId = guardianIds.find((guardianId) => !existingIds.has(guardianId));
    if (missingId) throw new Error("삭제할 고객 정보를 찾을 수 없습니다.");

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
  if (!supabase) throw new Error("Supabase 설정을 확인해 주세요.");

  const { error } = await supabase
    .from("guardians")
    .update({
      deleted_at: deletedAt,
      deleted_restore_until: restoreUntil,
      updated_at: deletedAt,
    })
    .in("id", guardianIds);

  if (error) throw new Error(error.message);

  return { success: true, guardianIds, restoreUntil };
}

export async function restoreGuardians(input: unknown) {
  const payload = guardianRestoreSchema.parse(input);
  const guardianIds = resolveGuardianIds(payload);

  if (guardianIds.length === 0) {
    throw new Error("복구할 고객을 선택해 주세요.");
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
  if (!supabase) throw new Error("Supabase 설정을 확인해 주세요.");

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
    throw new Error("복구 가능한 고객이 없습니다.");
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
    store.pets = [...store.pets, pet];
    setMockStore(store);
    return pet;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase 설정을 확인해 주세요.");

  const { data, error } = await supabase.from("pets").insert(pet).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updatePet(input: unknown) {
  const payload = petUpdateSchema.parse(input);

  if (!hasSupabaseServerEnv()) {
    const store = getMutableStore();
    const pet = store.pets.find((item) => item.id === payload.petId);
    if (!pet) throw new Error("반려동물 정보를 찾을 수 없습니다.");

    pet.name = payload.name;
    pet.breed = payload.breed;
    pet.birthday = payload.birthday ?? null;
    pet.updated_at = nowIso();
    setMockStore(store);
    return pet;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase 설정을 확인해 주세요.");

  const { data, error } = await supabase
    .from("pets")
    .update({
      name: payload.name,
      breed: payload.breed,
      birthday: payload.birthday ?? null,
      updated_at: nowIso(),
    })
    .eq("id", payload.petId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function createAppointment(input: unknown) {
  const payload = appointmentInputSchema.parse(input);
  const data = await getBootstrap(payload.shopId);
  const service = data.services.find((item) => item.id === payload.serviceId);
  const staffId = payload.staffId?.trim() || null;

  if (!service) throw new Error("서비스 정보를 찾을 수 없습니다.");
  if (staffId && !data.staffMembers.some((staffMember) => staffMember.id === staffId)) {
    throw new Error("담당자 정보를 찾을 수 없습니다.");
  }

  const availableSlots = computeAvailableSlots({
    date: payload.appointmentDate,
    serviceId: service.id,
    shop: data.shop,
    services: data.services,
    appointments: data.appointments,
  });

  if (!availableSlots.includes(payload.appointmentTime)) {
    throw new Error("선택한 시간에는 예약할 수 없습니다.");
  }

  const status = "confirmed";
  const appointmentWindow = buildAppointmentWindow(payload.appointmentDate, payload.appointmentTime, service.duration_minutes);
  const appointment: Appointment = {
    id: randomUUID(),
    shop_id: payload.shopId,
    guardian_id: payload.guardianId,
    pet_id: payload.petId,
    service_id: service.id,
    staff_id: staffId,
    appointment_date: payload.appointmentDate,
    appointment_time: payload.appointmentTime,
    status,
    memo: payload.memo,
    rejection_reason: null,
    start_at: appointmentWindow.start_at,
    end_at: appointmentWindow.end_at,
    visit_reminder_offset_minutes: payload.visitReminderOffsetMinutes ?? data.shop.notification_settings.visit_reminder_offset_minutes ?? 10,
    pickup_ready_eta_minutes: payload.pickupReadyEtaMinutes ?? data.shop.notification_settings.pickup_ready_eta_minutes ?? 5,
    source: payload.source,
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  if (data.mode !== "supabase" || !hasSupabaseServerEnv()) {
    const store = getMutableStore();
    store.appointments = [...store.appointments, appointment];
    setMockStore(store);
    if (appointment.status === "confirmed") {
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
  let createdAppointment = await createAppointmentWithCapacityLock(supabase, appointment);

  if (staffId && createdAppointment.staff_id !== staffId) {
    const staffUpdate = await supabase
      .from("appointments")
      .update({ staff_id: staffId, updated_at: createdAppointment.updated_at })
      .eq("id", createdAppointment.id)
      .select("*")
      .single();

    if (staffUpdate.error) {
      throw new Error(staffUpdate.error.message);
    }

    createdAppointment = staffUpdate.data as Appointment;
  }

  if (createdAppointment.status === "confirmed") {
    await dispatchAppointmentNotificationWithLogs({
      shopId: createdAppointment.shop_id,
      appointment: createdAppointment,
      type: "booking_confirmed",
    });
  }

  return createdAppointment;
}

export async function updateAppointmentStatus(input: unknown) {
  const payload = appointmentStatusSchema.parse(input);
  const rejectionReason = payload.status === "rejected" ? getRejectionReason(payload) : null;

  if (!hasSupabaseServerEnv()) {
    const store = getMutableStore();
    const appointment = store.appointments.find((item) => item.id === payload.appointmentId);
    if (!appointment) throw new Error("예약을 찾을 수 없습니다.");
    const previousAppointment = { ...appointment };
    assertAppointmentStatusTransitionAllowed(appointment.status, payload.status);

    appointment.status = payload.status;
    appointment.rejection_reason = rejectionReason;
    appointment.updated_at = nowIso();
    if (payload.status === "in_progress") appointment.actual_started_at = appointment.updated_at;
    if (payload.status === "completed") appointment.actual_completed_at = appointment.updated_at;

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
    await persistAppointmentChangeEvent({ before: previousAppointment, after: appointment, eventType: "status", note: payload.eventType ?? null });
    if (!payload.notifyCustomer) return appointment;
    if (payload.status === "confirmed" && payload.eventType === "booking_rescheduled_confirmed") {
      await dispatchAppointmentNotificationWithLogs({
        shopId: appointment.shop_id,
        appointment,
        type: "booking_rescheduled_confirmed",
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
        mediaAssetIds: payload.mediaAssetIds ?? [],
        force: true,
      });
    }
    if (payload.status === "almost_done") {
      await dispatchAppointmentNotificationWithLogs({
        shopId: appointment.shop_id,
        appointment,
        type: "grooming_almost_done",
        mediaAssetIds: payload.mediaAssetIds ?? [],
        force: true,
      });
    }
    if (payload.status === "completed") {
      await dispatchAppointmentNotificationWithLogs({
        shopId: appointment.shop_id,
        appointment,
        type: "grooming_completed",
        mediaAssetIds: payload.mediaAssetIds ?? [],
        force: true,
      });
    }
    return appointment;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase 설정을 확인해 주세요.");

  const current = await supabase.from("appointments").select("*").eq("id", payload.appointmentId).single();
  if (current.error) throw new Error(current.error.message);
  const previousAppointment = current.data as Appointment;
  assertAppointmentStatusTransitionAllowed(previousAppointment.status, payload.status);
  const statusChangedAt = nowIso();
  const statusUpdate: Record<string, unknown> = {
    status: payload.status,
    rejection_reason: rejectionReason,
    updated_at: statusChangedAt,
  };
  if (payload.status === "in_progress") statusUpdate.actual_started_at = statusChangedAt;
  if (payload.status === "completed") statusUpdate.actual_completed_at = statusChangedAt;

  const { data: updatedAppointment, error } = await supabase
    .from("appointments")
    .update(statusUpdate)
    .eq("id", payload.appointmentId)
    .neq("status", payload.status)
    .select("*")
    .single();

  let resolvedAppointment = updatedAppointment;

  if (error) {
    if (hasMissingColumnError(error, "rejection_reason")) {
      const fallback = await supabase
        .from("appointments")
        .update({ status: payload.status, updated_at: statusChangedAt })
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
      throw new Error(error.message);
    }
  }

  if (payload.status === "completed") {
    const existingRecord = await supabase.from("grooming_records").select("id").eq("appointment_id", payload.appointmentId).maybeSingle();
    if (existingRecord.error) throw new Error(existingRecord.error.message);

    if (!existingRecord.data?.id) {
      const bootstrap = await getBootstrap(resolvedAppointment.shop_id);
      const service = bootstrap.services.find((item) => item.id === resolvedAppointment.service_id);

      const { error: recordError } = await supabase.from("grooming_records").insert({
        id: randomUUID(),
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
  }

  await persistAppointmentChangeEvent({
    before: previousAppointment,
    after: resolvedAppointment as Appointment,
    eventType: "status",
    note: payload.eventType ?? null,
  });

  if (!payload.notifyCustomer) return resolvedAppointment;
  if (payload.status === "confirmed" && payload.eventType === "booking_rescheduled_confirmed") {
    await dispatchAppointmentNotificationWithLogs({
      shopId: resolvedAppointment.shop_id,
      appointment: resolvedAppointment,
      type: "booking_rescheduled_confirmed",
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
      mediaAssetIds: payload.mediaAssetIds ?? [],
      force: true,
    });
  }
  if (payload.status === "almost_done") {
    await dispatchAppointmentNotificationWithLogs({
      shopId: resolvedAppointment.shop_id,
      appointment: resolvedAppointment,
      type: "grooming_almost_done",
      mediaAssetIds: payload.mediaAssetIds ?? [],
      force: true,
    });
  }
  if (payload.status === "completed") {
    await dispatchAppointmentNotificationWithLogs({
      shopId: resolvedAppointment.shop_id,
      appointment: resolvedAppointment,
      type: "grooming_completed",
      mediaAssetIds: payload.mediaAssetIds ?? [],
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
  const editableStatuses = payload.preserveStatus ? ["confirmed", "in_progress", "almost_done"] : ["pending", "confirmed", "cancelled"];
  if (!editableStatuses.includes(appointment.status)) {
    throw new Error("현재 예약 상태에서는 일정 수정이 어렵습니다.");
  }

  const service = data.services.find((item) => item.id === payload.serviceId);
  if (!service) throw new Error("서비스 정보를 찾을 수 없습니다.");

  const durationMinutes = payload.durationMinutes ?? service.duration_minutes;
  const availableSlots = payload.enforceShopCapacity
    ? computeAvailableSlots({
        date: payload.appointmentDate,
        serviceId: payload.serviceId,
        durationMinutesOverride: durationMinutes,
        shop: data.shop,
        services: data.services,
        appointments: data.appointments,
        excludeAppointmentId: payload.appointmentId,
      })
    : [payload.appointmentTime];

  if (!availableSlots.includes(payload.appointmentTime)) {
    throw new Error("선택한 시간에는 예약할 수 없습니다.");
  }

  const appointmentWindow = buildAppointmentWindow(payload.appointmentDate, payload.appointmentTime, durationMinutes);
  const nextValues = {
    service_id: payload.serviceId,
    staff_id: payload.staffId ?? appointment.staff_id ?? null,
    appointment_date: payload.appointmentDate,
    appointment_time: payload.appointmentTime,
    memo: payload.memo.trim(),
    status: payload.preserveStatus ? appointment.status : ("confirmed" as const),
    rejection_reason: payload.preserveStatus ? appointment.rejection_reason : null,
    start_at: appointmentWindow.start_at,
    end_at: appointmentWindow.end_at,
    visit_reminder_offset_minutes: payload.visitReminderOffsetMinutes ?? appointment.visit_reminder_offset_minutes ?? 10,
    pickup_ready_eta_minutes: payload.pickupReadyEtaMinutes ?? appointment.pickup_ready_eta_minutes ?? 5,
    updated_at: nowIso(),
  };

  if (data.mode !== "supabase" || !hasSupabaseServerEnv()) {
    const store = getMutableStore();
    const target = store.appointments.find((item) => item.id === payload.appointmentId);
    if (!target) throw new Error("예약 정보를 찾을 수 없습니다.");
    const previousAppointment = { ...target };

    Object.assign(target, nextValues);
    setMockStore(store);

    await persistAppointmentChangeEvent({ before: previousAppointment, after: target, eventType: "details", note: payload.eventType ?? null });
    if (payload.notifyCustomer) {
      await dispatchNotification({
        shopId: target.shop_id,
        appointmentId: target.id,
        guardianId: target.guardian_id,
        petId: target.pet_id,
        type: "booking_rescheduled_confirmed",
      });
    }

    return target;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase 연결을 확인할 수 없습니다.");

  const resolvedAppointment = await updateAppointmentWithCapacityLock(supabase, payload.appointmentId, nextValues);

  await persistAppointmentChangeEvent({
    before: appointment,
    after: resolvedAppointment as Appointment,
    eventType: "details",
    note: payload.eventType ?? null,
  });
  if (payload.notifyCustomer) {
    await dispatchNotification({
      shopId: resolvedAppointment.shop_id,
      appointmentId: resolvedAppointment.id,
      guardianId: resolvedAppointment.guardian_id,
      petId: resolvedAppointment.pet_id,
      type: "booking_rescheduled_confirmed",
    });
  }

  return resolvedAppointment;
}

