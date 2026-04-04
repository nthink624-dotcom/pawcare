import { randomUUID } from "node:crypto";

import { computeAvailableSlots } from "@/lib/availability";
import { normalizeCustomerPageSettings } from "@/lib/customer-page-settings";
import { normalizeBootstrapNotifications } from "@/lib/notification-settings";
import { hasSupabaseServerEnv } from "@/lib/server-env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { addDate, minutesFromTime, nowIso, timeFromMinutes } from "@/lib/utils";
import { getBootstrap } from "@/server/bootstrap";
import { getMockStore, setMockStore } from "@/server/mock-store";
import {
  appointmentInputSchema,
  appointmentStatusSchema,
  customerPageSettingsSchema,
  serviceInputSchema,
  shopSettingsSchema,
} from "@/server/schemas";
import type { Appointment, Service } from "@/types/domain";

function buildAppointmentWindow(date: string, time: string, durationMinutes: number) {
  const endMinute = minutesFromTime(time) + durationMinutes;

  return {
    start_at: `${date}T${time}:00+09:00`,
    end_at: `${addDate(date, Math.floor(endMinute / (24 * 60)))}T${timeFromMinutes(endMinute % (24 * 60))}:00+09:00`,
  };
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
      approval_mode: payload.approvalMode,
      regular_closed_days: payload.regularClosedDays,
      temporary_closed_dates: payload.temporaryClosedDates,
      business_hours: Object.fromEntries(Object.entries(payload.businessHours).map(([key, value]) => [Number(key), value])),
      notification_settings: nextNotificationSettings,
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
      approval_mode: payload.approvalMode,
      regular_closed_days: payload.regularClosedDays,
      temporary_closed_dates: payload.temporaryClosedDates,
      business_hours: payload.businessHours,
      notification_settings: nextNotificationSettings,
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

  if (!hasSupabaseServerEnv()) {
    const store = getMutableStore();
    store.appointments = [...store.appointments, appointment];
    setMockStore(store);
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
      return appointment;
    }

    throw new Error(error.message);
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
          groomed_at: `${appointment.appointment_date}T${appointment.appointment_time}:00.000Z`,
          created_at: nowIso(),
          updated_at: nowIso(),
        },
        ...store.groomingRecords,
      ];
    }

    setMockStore(store);
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
        groomed_at: `${resolvedAppointment.appointment_date}T${resolvedAppointment.appointment_time}:00.000Z`,
        created_at: nowIso(),
        updated_at: nowIso(),
      });

      if (recordError) throw new Error(recordError.message);
    }
  }

  return resolvedAppointment;
}
