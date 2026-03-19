import { randomUUID } from "crypto";

import { computeAvailableSlots, isShopClosedOnDate } from "@/lib/availability";
import { env, hasSupabaseEnv } from "@/lib/env";
import { buildDemoBootstrap } from "@/lib/mock-data";
import { normalizeCustomerPageSettings } from "@/lib/customer-page-settings";
import { normalizeBootstrapNotifications, normalizeGuardianNotificationSettings, normalizeShopNotificationSettings } from "@/lib/notification-settings";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { nowIso, phoneNormalize } from "@/lib/utils";
import { getMockStore, setMockStore } from "@/server/mock-store";
import { queueAutomaticRevisitNotifications, queueEventNotification } from "@/server/notification-center";
import {
  appointmentInputSchema,
  appointmentStatusSchema,
  guardianInputSchema,
  guardianNotificationSettingsSchema,
  customerPageSettingsSchema,
  landingFeedbackSchema,
  landingInterestSchema,
  petInputSchema,
  petUpdateSchema,
  recordInputSchema,
  serviceInputSchema,
  shopSettingsSchema,
} from "@/server/schemas";
import type {
  Appointment,
  BootstrapPayload,
  GroomingRecord,
  Guardian,
  LandingFeedback,
  LandingInterest,
  Pet,
  Service,
  Shop,
} from "@/types/domain";

async function loadSupabaseBootstrap(shopId: string): Promise<BootstrapPayload> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return buildDemoBootstrap();

  const [shopRes, guardiansRes, petsRes, servicesRes, appointmentsRes, recordsRes, notificationsRes, interestsRes, feedbackRes] = await Promise.all([
    supabase.from("shops").select("*").eq("id", shopId).single(),
    supabase.from("guardians").select("*").eq("shop_id", shopId).order("created_at"),
    supabase.from("pets").select("*").eq("shop_id", shopId).order("created_at"),
    supabase.from("services").select("*").eq("shop_id", shopId).order("created_at"),
    supabase.from("appointments").select("*").eq("shop_id", shopId).order("appointment_date").order("appointment_time"),
    supabase.from("grooming_records").select("*").eq("shop_id", shopId).order("groomed_at", { ascending: false }),
    supabase.from("notifications").select("*").eq("shop_id", shopId).order("created_at", { ascending: false }),
    supabase.from("landing_interests").select("*").order("created_at", { ascending: false }),
    supabase.from("landing_feedback").select("*").order("created_at", { ascending: false }),
  ]);

  if (shopRes.error || !shopRes.data) throw new Error(shopRes.error?.message || "매장 정보를 불러오지 못했습니다.");

  return normalizeBootstrapNotifications({
    mode: "supabase",
    shop: { ...(shopRes.data as Shop), notification_settings: normalizeShopNotificationSettings((shopRes.data as Shop).notification_settings), customer_page_settings: normalizeCustomerPageSettings((shopRes.data as Shop).customer_page_settings, (shopRes.data as Shop).name, (shopRes.data as Shop).description) },
    guardians: ((guardiansRes.data ?? []) as Guardian[]).map((guardian) => ({ ...guardian, notification_settings: normalizeGuardianNotificationSettings(guardian.notification_settings) })),
    pets: (petsRes.data ?? []) as Pet[],
    services: (servicesRes.data ?? []) as Service[],
    appointments: (appointmentsRes.data ?? []) as Appointment[],
    groomingRecords: (recordsRes.data ?? []) as GroomingRecord[],
    notifications: (notificationsRes.data ?? []) as BootstrapPayload["notifications"],
    landingInterests: (interestsRes.data ?? []) as LandingInterest[],
    landingFeedback: (feedbackRes.data ?? []) as LandingFeedback[],
  });
}

function ensureGuardianByPhone(store: BootstrapPayload, shopId: string, name: string, phone: string) {
  const normalized = phoneNormalize(phone);
  const existing = store.guardians.find((item) => phoneNormalize(item.phone) === normalized && item.shop_id === shopId);
  if (existing) return existing;
  const guardian: Guardian = {
    id: randomUUID(),
    shop_id: shopId,
    name,
    phone,
    memo: "",
    notification_settings: normalizeGuardianNotificationSettings(undefined),
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  store.guardians.push(guardian);
  return guardian;
}

function ensurePet(store: BootstrapPayload, shopId: string, guardianId: string, petName: string) {
  const existing = store.pets.find((item) => item.guardian_id === guardianId && item.name === petName && item.shop_id === shopId);
  if (existing) return existing;
  const pet: Pet = {
    id: randomUUID(),
    shop_id: shopId,
    guardian_id: guardianId,
    name: petName,
    breed: "미입력",
    weight: null,
    age: null,
    notes: "",
    birthday: null,
    grooming_cycle_weeks: 4,
    avatar_seed: "🐶",
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  store.pets.push(pet);
  return pet;
}

function getServiceName(store: BootstrapPayload, serviceId: string) {
  return store.services.find((item) => item.id === serviceId)?.name;
}

function getRejectReason(payload: { rejectionReasonTemplate?: string; rejectionReasonCustom?: string }) {
  if (payload.rejectionReasonTemplate === "기타 직접 입력") return payload.rejectionReasonCustom?.trim() || "기타 사유";
  return payload.rejectionReasonTemplate?.trim() || payload.rejectionReasonCustom?.trim() || null;
}

export async function getBootstrap(shopId = env.demoShopId) {
  if (!hasSupabaseEnv()) {
    const store = normalizeBootstrapNotifications(getMockStore());
    store.shop = { ...store.shop, customer_page_settings: normalizeCustomerPageSettings(store.shop.customer_page_settings, store.shop.name, store.shop.description) };
    await queueAutomaticRevisitNotifications(store);
    setMockStore(store);
    return store.shop.id === shopId ? store : { ...store, shop: { ...store.shop, id: shopId } };
  }
  return loadSupabaseBootstrap(shopId);
}

export async function createAppointment(input: unknown) {
  const payload = appointmentInputSchema.parse(input);
  const data = await getBootstrap(payload.shopId);
  const customServiceName = payload.customServiceName?.trim() || "";
  let service = customServiceName
    ? data.services.find((item) => item.shop_id === payload.shopId && item.name === customServiceName)
    : data.services.find((item) => item.id === payload.serviceId);

  if (!service && customServiceName) {
    service = {
      id: randomUUID(),
      shop_id: payload.shopId,
      name: customServiceName,
      price: 0,
      price_type: "fixed",
      duration_minutes: 60,
      is_active: true,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    if (!hasSupabaseEnv()) {
      const store = normalizeBootstrapNotifications(getMockStore());
    store.shop = { ...store.shop, customer_page_settings: normalizeCustomerPageSettings(store.shop.customer_page_settings, store.shop.name, store.shop.description) };
      store.services = [...store.services, service];
      setMockStore(store);
    } else {
      const supabase = getSupabaseAdmin();
      if (!supabase) throw new Error("Supabase ??? ????.");
      const { error } = await supabase.from("services").insert(service);
      if (error) throw new Error(error.message);
    }
  }

  if (!service) throw new Error("???? ?? ? ????.");

  const servicesForAvailability = data.services.some((item) => item.id === service.id) ? data.services : [...data.services, service];
  const availableSlots = computeAvailableSlots({
    date: payload.appointmentDate,
    serviceId: service.id,
    shop: data.shop,
    services: servicesForAvailability,
    appointments: data.appointments,
  });
  if (!availableSlots.includes(payload.appointmentTime)) throw new Error("??? ??? ??? ? ????.");

  const status = payload.source === "owner" ? "confirmed" : data.shop.approval_mode === "auto" ? "confirmed" : "pending";
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
    start_at: `${payload.appointmentDate}T${payload.appointmentTime}:00.000Z`,
    end_at: `${payload.appointmentDate}T${payload.appointmentTime}:00.000Z`,
    source: payload.source,
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  if (!hasSupabaseEnv()) {
    const store = normalizeBootstrapNotifications(getMockStore());
    store.shop = { ...store.shop, customer_page_settings: normalizeCustomerPageSettings(store.shop.customer_page_settings, store.shop.name, store.shop.description) };
    store.appointments = [...store.appointments, appointment];
    if (status === "confirmed") {
      await queueEventNotification({
        store,
        type: "booking_confirmed",
        appointment,
        guardian: store.guardians.find((item) => item.id === appointment.guardian_id),
        pet: store.pets.find((item) => item.id === appointment.pet_id),
        serviceName: getServiceName(store, appointment.service_id),
      });
    }
    setMockStore(store);
    return appointment;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase ??? ????.");
  const { error } = await supabase.from("appointments").insert(appointment);
  if (error) throw new Error(error.message);
  return appointment;
}
export async function updateAppointmentStatus(input: unknown) {
  const payload = appointmentStatusSchema.parse(input);
  const rejectionReason = payload.status === "rejected" ? getRejectReason(payload) : null;

  if (!hasSupabaseEnv()) {
    const store = normalizeBootstrapNotifications(getMockStore());
    store.shop = { ...store.shop, customer_page_settings: normalizeCustomerPageSettings(store.shop.customer_page_settings, store.shop.name, store.shop.description) };
    const appointment = store.appointments.find((item) => item.id === payload.appointmentId);
    if (!appointment) throw new Error("예약을 찾을 수 없습니다.");
    appointment.status = payload.status;
    appointment.rejection_reason = rejectionReason;
    appointment.updated_at = nowIso();
    const guardian = store.guardians.find((item) => item.id === appointment.guardian_id);
    const pet = store.pets.find((item) => item.id === appointment.pet_id);
    const serviceName = getServiceName(store, appointment.service_id);

    if (payload.status === "completed") {
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

    const eventType = payload.eventType
      ? payload.eventType
      : payload.status === "confirmed"
        ? "booking_confirmed"
        : payload.status === "rejected"
          ? "booking_rejected"
          : payload.status === "cancelled"
            ? "booking_cancelled"
            : payload.status === "almost_done"
              ? "grooming_almost_done"
              : payload.status === "completed"
                ? "grooming_completed"
                : null;

    if (eventType) {
      await queueEventNotification({
        store,
        type: eventType,
        appointment,
        guardian,
        pet,
        serviceName,
        rejectionReason,
        metadata: rejectionReason ? { rejectionReason } : undefined,
      });
    }

    setMockStore(store);
    return appointment;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase 연결이 없습니다.");
  const { data, error } = await supabase
    .from("appointments")
    .update({ status: payload.status, rejection_reason: rejectionReason, updated_at: nowIso() })
    .eq("id", payload.appointmentId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function createGuardian(input: unknown) {
  const payload = guardianInputSchema.parse(input);
  const guardian: Guardian = {
    id: randomUUID(),
    shop_id: payload.shopId,
    name: payload.name,
    phone: payload.phone,
    memo: payload.memo,
    notification_settings: normalizeGuardianNotificationSettings(undefined),
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  if (!hasSupabaseEnv()) {
    const store = normalizeBootstrapNotifications(getMockStore());
    store.shop = { ...store.shop, customer_page_settings: normalizeCustomerPageSettings(store.shop.customer_page_settings, store.shop.name, store.shop.description) };
    store.guardians = [...store.guardians, guardian];
    setMockStore(store);
    return guardian;
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase 연결이 없습니다.");
  const { error } = await supabase.from("guardians").insert(guardian);
  if (error) throw new Error(error.message);
  return guardian;
}

export async function updateGuardianNotificationSettings(input: unknown) {
  const payload = guardianNotificationSettingsSchema.parse(input);
  if (!hasSupabaseEnv()) {
    const store = normalizeBootstrapNotifications(getMockStore());
    store.shop = { ...store.shop, customer_page_settings: normalizeCustomerPageSettings(store.shop.customer_page_settings, store.shop.name, store.shop.description) };
    const guardian = store.guardians.find((item) => item.id === payload.guardianId);
    if (!guardian) throw new Error("고객을 찾을 수 없습니다.");
    guardian.notification_settings = { enabled: payload.enabled, revisit_enabled: payload.revisitEnabled };
    guardian.updated_at = nowIso();
    setMockStore(store);
    return guardian;
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase 연결이 없습니다.");
  const { data, error } = await supabase
    .from("guardians")
    .update({ notification_settings: { enabled: payload.enabled, revisit_enabled: payload.revisitEnabled }, updated_at: nowIso() })
    .eq("id", payload.guardianId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function createPet(input: unknown) {
  const payload = petInputSchema.parse(input);
  const pet: Pet = {
    id: randomUUID(),
    shop_id: payload.shopId,
    guardian_id: payload.guardianId,
    name: payload.name,
    breed: payload.breed,
    weight: payload.weight,
    age: payload.age,
    notes: payload.notes,
    birthday: payload.birthday ?? null,
    grooming_cycle_weeks: payload.groomingCycleWeeks,
    avatar_seed: "🐶",
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  if (!hasSupabaseEnv()) {
    const store = getMockStore();
    store.pets = [...store.pets, pet];
    setMockStore(store);
    return pet;
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase 연결이 없습니다.");
  const { error } = await supabase.from("pets").insert(pet);
  if (error) throw new Error(error.message);
  return pet;
}

export async function updatePet(input: unknown) {
  const payload = petUpdateSchema.parse(input);
  if (!hasSupabaseEnv()) {
    const store = getMockStore();
    const pet = store.pets.find((item) => item.id === payload.petId);
    if (!pet) throw new Error("???? ?? ? ????.");
    pet.name = payload.name;
    pet.breed = payload.breed;
    pet.birthday = payload.birthday ?? null;
    pet.updated_at = nowIso();
    setMockStore(store);
    return pet;
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase ??? ????.");
  const { data, error } = await supabase
    .from("pets")
    .update({ name: payload.name, breed: payload.breed, birthday: payload.birthday ?? null, updated_at: nowIso() })
    .eq("id", payload.petId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
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
  if (!hasSupabaseEnv()) {
    const store = getMockStore();
    const index = store.services.findIndex((item) => item.id === service.id);
    if (index >= 0) store.services[index] = { ...store.services[index], ...service, created_at: store.services[index].created_at };
    else store.services = [...store.services, service];
    setMockStore(store);
    return service;
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase 연결이 없습니다.");
  const { error } = await supabase.from("services").upsert(service);
  if (error) throw new Error(error.message);
  return service;
}

export async function updateRecord(input: unknown) {
  const payload = recordInputSchema.parse(input);
  if (!hasSupabaseEnv()) {
    const store = getMockStore();
    const target = store.groomingRecords.find((item) => item.id === payload.recordId);
    if (!target) throw new Error("미용 기록을 찾을 수 없습니다.");
    target.style_notes = payload.styleNotes;
    target.memo = payload.memo;
    target.price_paid = payload.pricePaid;
    target.service_id = payload.serviceId;
    target.updated_at = nowIso();
    setMockStore(store);
    return target;
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase 연결이 없습니다.");
  const { data, error } = await supabase
    .from("grooming_records")
    .update({ style_notes: payload.styleNotes, memo: payload.memo, price_paid: payload.pricePaid, service_id: payload.serviceId, updated_at: nowIso() })
    .eq("id", payload.recordId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
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
  if (!hasSupabaseEnv()) {
    const store = getMockStore();
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
    setMockStore(store);
    return store.shop;
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase 연결이 없습니다.");
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
  if (error) throw new Error(error.message);
  return data;
}

export async function updateCustomerPageSettings(input: unknown) {
  const payload = customerPageSettingsSchema.parse(input);
  const nextCustomerPageSettings = normalizeCustomerPageSettings(payload.customerPageSettings);

  if (!hasSupabaseEnv()) {
    const store = getMockStore();
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
  if (!supabase) throw new Error("Supabase 연결이 없습니다.");
  const { data, error } = await supabase
    .from("shops")
    .update({
      customer_page_settings: nextCustomerPageSettings,
      updated_at: nowIso(),
    })
    .eq("id", payload.shopId)
    .select("customer_page_settings")
    .single();
  if (error) throw new Error(error.message);
  return normalizeCustomerPageSettings(data?.customer_page_settings);
}
export async function submitLandingInterest(input: unknown) {
  const payload = landingInterestSchema.parse(input);
  const item: LandingInterest = {
    id: randomUUID(),
    shop_name: payload.shopName,
    owner_name: payload.ownerName,
    phone: payload.phone,
    needs: payload.needs,
    created_at: nowIso(),
  };
  if (!hasSupabaseEnv()) {
    const store = getMockStore();
    store.landingInterests = [item, ...store.landingInterests];
    setMockStore(store);
    return item;
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase 연결이 없습니다.");
  const { error } = await supabase.from("landing_interests").insert(item);
  if (error) throw new Error(error.message);
  return item;
}

export async function submitLandingFeedback(input: unknown) {
  const payload = landingFeedbackSchema.parse(input);
  const item: LandingFeedback = {
    id: randomUUID(),
    type: payload.type,
    text: payload.text,
    created_at: nowIso(),
  };
  if (!hasSupabaseEnv()) {
    const store = getMockStore();
    store.landingFeedback = [item, ...store.landingFeedback];
    setMockStore(store);
    return item;
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase 연결이 없습니다.");
  const { error } = await supabase.from("landing_feedback").insert(item);
  if (error) throw new Error(error.message);
  return item;
}

export async function createCustomerBookingLead(params: {
  shopId: string;
  guardianName: string;
  phone: string;
  petName: string;
  serviceId: string;
  appointmentDate: string;
  appointmentTime: string;
  memo: string;
}) {
  const store = hasSupabaseEnv() ? await getBootstrap(params.shopId) : normalizeBootstrapNotifications(getMockStore());
  const guardian = ensureGuardianByPhone(store, params.shopId, params.guardianName, params.phone);
  const pet = ensurePet(store, params.shopId, guardian.id, params.petName);
  if (!hasSupabaseEnv()) setMockStore(store);
  return createAppointment({
    shopId: params.shopId,
    guardianId: guardian.id,
    petId: pet.id,
    serviceId: params.serviceId,
    customServiceName: "",
    appointmentDate: params.appointmentDate,
    appointmentTime: params.appointmentTime,
    memo: params.memo,
    source: "customer",
  });
}




