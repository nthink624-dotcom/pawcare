import { randomUUID } from "node:crypto";

import { computeAvailableSlots } from "@/lib/availability";
import { normalizeCustomerPageSettings } from "@/lib/customer-page-settings";
import { coerceEnabledShopNotificationSettings, normalizeBootstrapNotifications } from "@/lib/notification-settings";
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
  petInputSchema,
  petUpdateSchema,
  serviceInputSchema,
  shopSettingsSchema,
} from "@/server/schemas";
import type { Appointment, Guardian, Pet, Service } from "@/types/domain";

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
  if (payload.rejectionReasonTemplate === "기타 직접 입력") {
    return payload.rejectionReasonCustom?.trim() || "기타 사유";
  }

  return payload.rejectionReasonTemplate?.trim() || payload.rejectionReasonCustom?.trim() || null;
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
    grooming_almost_done_enabled: payload.notificationSettings.groomingAlmostDoneEnabled,
    grooming_completed_enabled: payload.notificationSettings.groomingCompletedEnabled,
  };
  const normalizedNotificationSettings = coerceEnabledShopNotificationSettings(nextNotificationSettings);

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
      approval_mode: payload.approvalMode,
      regular_closed_days: payload.regularClosedDays,
      temporary_closed_dates: payload.temporaryClosedDates,
      business_hours: Object.fromEntries(Object.entries(payload.businessHours).map(([key, value]) => [Number(key), value])),
      notification_settings: normalizedNotificationSettings,
      updated_at: nowIso(),
    };

    if (payload.approvalMode === "auto") {
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

  const { data, error } = await supabase
    .from("shops")
    .update({
      name: payload.name,
      phone: payload.phone,
      address: payload.address,
      description: payload.description,
      concurrent_capacity: payload.concurrentCapacity,
      booking_slot_interval_minutes: payload.bookingSlotIntervalMinutes,
      booking_slot_offset_minutes: payload.bookingSlotOffsetMinutes,
      approval_mode: payload.approvalMode,
      regular_closed_days: payload.regularClosedDays,
      temporary_closed_dates: payload.temporaryClosedDates,
      business_hours: payload.businessHours,
      notification_settings: normalizedNotificationSettings,
      updated_at: nowIso(),
    })
    .eq("id", payload.shopId)
    .select("*")
    .single();

  if (error) {
    if (hasMissingColumnError(error, "notification_settings")) {
      const fallback = await supabase
        .from("shops")
        .update({
          name: payload.name,
          phone: payload.phone,
          address: payload.address,
          description: payload.description,
          concurrent_capacity: payload.concurrentCapacity,
          booking_slot_interval_minutes: payload.bookingSlotIntervalMinutes,
          booking_slot_offset_minutes: payload.bookingSlotOffsetMinutes,
          approval_mode: payload.approvalMode,
          regular_closed_days: payload.regularClosedDays,
          temporary_closed_dates: payload.temporaryClosedDates,
          business_hours: payload.businessHours,
          updated_at: nowIso(),
        })
        .eq("id", payload.shopId)
        .select("*")
        .single();

      if (fallback.error) {
        throw new Error(fallback.error.message);
      }

      if (payload.approvalMode === "auto") {
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

  if (payload.approvalMode === "auto") {
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
  if (!supabase) throw new Error("Supabase 설정을 확인해 주세요.");

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
      throw new Error("고객 노출 정보 컬럼이 아직 없습니다. 안내드린 SQL을 한 번만 실행해 주세요.");
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
    notification_settings: {
      enabled: true,
      revisit_enabled: true,
    },
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
    if (!guardian) throw new Error("고객 정보를 찾을 수 없어요.");

    if (typeof payload.name === "string") guardian.name = payload.name;
    if (typeof payload.phone === "string") guardian.phone = payload.phone;
    if (typeof payload.memo === "string") guardian.memo = payload.memo;
    if (typeof payload.enabled === "boolean" || typeof payload.revisitEnabled === "boolean") {
      guardian.notification_settings = {
        ...guardian.notification_settings,
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
    ...((currentGuardian.data?.notification_settings as { enabled?: boolean; revisit_enabled?: boolean } | null) ?? {}),
    ...(typeof payload.enabled === "boolean" ? { enabled: payload.enabled } : {}),
    ...(typeof payload.revisitEnabled === "boolean" ? { revisit_enabled: payload.revisitEnabled } : {}),
  };

  const nextValues = {
    ...(typeof payload.name === "string" ? { name: payload.name } : {}),
    ...(typeof payload.phone === "string" ? { phone: payload.phone } : {}),
    ...(typeof payload.memo === "string" ? { memo: payload.memo } : {}),
    ...((typeof payload.enabled === "boolean" || typeof payload.revisitEnabled === "boolean")
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
    if (!guardian) throw new Error("고객 정보를 찾을 수 없어요.");

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
    if (!pet) throw new Error("반려동물 정보를 찾을 수 없어요.");

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

  if (!service) throw new Error("서비스 정보를 찾을 수 없습니다.");

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

  const status = payload.source === "owner" ? "confirmed" : data.shop.approval_mode === "auto" ? "confirmed" : "pending";
  const appointmentWindow = buildAppointmentWindow(payload.appointmentDate, payload.appointmentTime, service.duration_minutes);
  const appointment: Appointment = {
    id: randomUUID(),
    shop_id: payload.shopId,
    guardian_id: payload.guardianId,
    pet_id: payload.petId,
    service_id: service.id,
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
      await dispatchNotification({
        shopId: appointment.shop_id,
        appointmentId: appointment.id,
        guardianId: appointment.guardian_id,
        petId: appointment.pet_id,
        type: "booking_confirmed",
      });
    }
    return appointment;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase 설정을 확인해 주세요.");
  const { error } = await supabase.from("appointments").insert(appointment);
  if (error) {
    if (hasMissingColumnError(error, "rejection_reason")) {
      const { error: fallbackError } = await supabase.from("appointments").insert({
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
      });

      if (fallbackError) throw new Error(fallbackError.message);
      if (appointment.status === "confirmed") {
        await dispatchNotification({
          shopId: appointment.shop_id,
          appointmentId: appointment.id,
          guardianId: appointment.guardian_id,
          petId: appointment.pet_id,
          type: "booking_confirmed",
        });
      }
      return appointment;
    }

    throw new Error(error.message);
  }
  if (appointment.status === "confirmed") {
    await dispatchNotification({
      shopId: appointment.shop_id,
      appointmentId: appointment.id,
      guardianId: appointment.guardian_id,
      petId: appointment.pet_id,
      type: "booking_confirmed",
    });
  }

  return appointment;
}

export async function updateAppointmentStatus(input: unknown) {
  const payload = appointmentStatusSchema.parse(input);
  const rejectionReason = payload.status === "rejected" ? getRejectionReason(payload) : null;

  if (!hasSupabaseServerEnv()) {
    const store = getMutableStore();
    const appointment = store.appointments.find((item) => item.id === payload.appointmentId);
    if (!appointment) throw new Error("예약을 찾을 수 없습니다.");

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
      });
    }
    if (payload.status === "almost_done") {
      await dispatchAppointmentNotificationWithLogs({
        shopId: appointment.shop_id,
        appointment,
        type: "grooming_almost_done",
        skipIfExists: true,
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
  if (!supabase) throw new Error("Supabase 설정을 확인해 주세요.");

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
        groomed_at: toTimestampString(resolvedAppointment.appointment_date, resolvedAppointment.appointment_time),
        created_at: nowIso(),
        updated_at: nowIso(),
      });

      if (recordError) throw new Error(recordError.message);
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
    });
  }
  if (payload.status === "almost_done") {
    await dispatchAppointmentNotificationWithLogs({
      shopId: resolvedAppointment.shop_id,
      appointment: resolvedAppointment,
      type: "grooming_almost_done",
      skipIfExists: true,
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

  if (!appointment) throw new Error("예약 정보를 찾을 수 없습니다.");
  if (!["pending", "confirmed", "cancelled"].includes(appointment.status)) {
    throw new Error("이 예약 상태에서는 일정 수정이 어렵습니다.");
  }

  const service = data.services.find((item) => item.id === payload.serviceId);
  if (!service) throw new Error("서비스 정보를 찾을 수 없습니다.");

  const availableSlots = computeAvailableSlots({
    date: payload.appointmentDate,
    serviceId: payload.serviceId,
    shop: data.shop,
    services: data.services,
    appointments: data.appointments,
    excludeAppointmentId: payload.appointmentId,
  });

  if (!availableSlots.includes(payload.appointmentTime)) {
    throw new Error("선택한 시간에는 예약할 수 없습니다.");
  }

  const appointmentWindow = buildAppointmentWindow(payload.appointmentDate, payload.appointmentTime, service.duration_minutes);
  const nextValues = {
    service_id: payload.serviceId,
    appointment_date: payload.appointmentDate,
    appointment_time: payload.appointmentTime,
    memo: payload.memo.trim(),
    status: "confirmed" as const,
    rejection_reason: null,
    start_at: appointmentWindow.start_at,
    end_at: appointmentWindow.end_at,
    updated_at: nowIso(),
  };

  if (data.mode !== "supabase" || !hasSupabaseServerEnv()) {
    const store = getMutableStore();
    const target = store.appointments.find((item) => item.id === payload.appointmentId);
    if (!target) throw new Error("예약 정보를 찾을 수 없습니다.");

    Object.assign(target, nextValues);
    setMockStore(store);

    await dispatchNotification({
      shopId: target.shop_id,
      appointmentId: target.id,
      guardianId: target.guardian_id,
      petId: target.pet_id,
      type: "booking_rescheduled_confirmed",
    });

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
    if (hasMissingColumnError(error, "rejection_reason")) {
      const { rejection_reason: _ignored, ...fallbackValues } = nextValues;
      const fallback = await supabase
        .from("appointments")
        .update(fallbackValues)
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

  await dispatchNotification({
    shopId: resolvedAppointment.shop_id,
    appointmentId: resolvedAppointment.id,
    guardianId: resolvedAppointment.guardian_id,
    petId: resolvedAppointment.pet_id,
    type: "booking_rescheduled_confirmed",
  });

  return resolvedAppointment;
}
