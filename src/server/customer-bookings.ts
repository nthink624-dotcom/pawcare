import { randomUUID } from "node:crypto";

import { z } from "zod";

import { computeAvailableSlots } from "@/lib/availability";
import {
  addDate,
  currentDateInTimeZone,
  currentMinutesInTimeZone,
  minutesFromTime,
  nowIso,
  phoneNormalize,
  timeFromMinutes,
} from "@/lib/utils";
import { hasSupabaseServerEnv } from "@/lib/server-env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getBootstrap } from "@/server/bootstrap";
import { getMockStore, setMockStore } from "@/server/mock-store";
import { createAppointment } from "@/server/owner-mutations";
import type { Appointment, Guardian, Pet } from "@/types/domain";

const customerBookingCreateSchema = z.object({
  shopId: z.string().min(1),
  guardianName: z.string().trim().min(1),
  phone: z.string().trim().min(10),
  petName: z.string().trim().min(1),
  breed: z.string().trim().optional().default(""),
  serviceId: z.string().min(1),
  appointmentDate: z.string().min(1),
  appointmentTime: z.string().min(1),
  memo: z.string().optional().default(""),
});

const customerBookingUpdateSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("cancel"),
    shopId: z.string().min(1),
    appointmentId: z.string().min(1),
    phone: z.string().trim().min(10),
  }),
  z.object({
    action: z.literal("reschedule"),
    shopId: z.string().min(1),
    appointmentId: z.string().min(1),
    phone: z.string().trim().min(10),
    serviceId: z.string().min(1),
    appointmentDate: z.string().min(1),
    appointmentTime: z.string().min(1),
    memo: z.string().optional().default(""),
  }),
]);

function buildAppointmentWindow(date: string, time: string, durationMinutes: number) {
  const endMinute = minutesFromTime(time) + durationMinutes;

  return {
    start_at: `${date}T${time}:00+09:00`,
    end_at: `${addDate(date, Math.floor(endMinute / (24 * 60)))}T${timeFromMinutes(endMinute % (24 * 60))}:00+09:00`,
  };
}

function canManageAppointment(appointment: Appointment) {
  if (!["pending", "confirmed"].includes(appointment.status)) return false;

  const today = currentDateInTimeZone();
  if (appointment.appointment_date > today) return true;
  if (appointment.appointment_date < today) return false;

  return minutesFromTime(appointment.appointment_time) > currentMinutesInTimeZone();
}

function normalizePhone(value: string) {
  return phoneNormalize(value).slice(0, 11);
}

function matchPhone(a: string, b: string) {
  return normalizePhone(a) === normalizePhone(b);
}

function makeGuardianBase(payload: z.infer<typeof customerBookingCreateSchema>) {
  return {
    id: randomUUID(),
    shop_id: payload.shopId,
    name: payload.guardianName.trim(),
    phone: normalizePhone(payload.phone),
    memo: "",
    created_at: nowIso(),
    updated_at: nowIso(),
  };
}

function makePetBase(payload: z.infer<typeof customerBookingCreateSchema>, guardianId: string) {
  return {
    id: randomUUID(),
    shop_id: payload.shopId,
    guardian_id: guardianId,
    name: payload.petName.trim(),
    breed: payload.breed.trim() || "견종 미입력",
    weight: null,
    age: null,
    notes: "",
    grooming_cycle_weeks: 4,
    avatar_seed: payload.petName.trim().slice(0, 1) || "M",
    created_at: nowIso(),
    updated_at: nowIso(),
  };
}

async function findOrCreateMockEntities(payload: z.infer<typeof customerBookingCreateSchema>) {
  const store = getMockStore();
  let guardian = store.guardians.find((item) => item.shop_id === payload.shopId && matchPhone(item.phone, payload.phone));

  if (!guardian) {
    guardian = {
      ...makeGuardianBase(payload),
      notification_settings: { enabled: false, revisit_enabled: false },
    } as Guardian;
    store.guardians = [...store.guardians, guardian];
  }

  let pet = store.pets.find(
    (item) =>
      item.shop_id === payload.shopId &&
      item.guardian_id === guardian.id &&
      item.name.trim() === payload.petName.trim(),
  );

  if (!pet) {
    pet = makePetBase(payload, guardian.id) as Pet;
    store.pets = [...store.pets, pet];
  }

  setMockStore(store);
  return { guardianId: guardian.id, petId: pet.id };
}

async function findOrCreateSupabaseEntities(payload: z.infer<typeof customerBookingCreateSchema>) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase 연결을 확인할 수 없습니다.");

  const phone = normalizePhone(payload.phone);
  const guardianQuery = await supabase
    .from("guardians")
    .select("id,name,phone")
    .eq("shop_id", payload.shopId)
    .order("created_at");

  if (guardianQuery.error) throw new Error(guardianQuery.error.message);

  const existingGuardian = (guardianQuery.data ?? []).find((guardian) => matchPhone(guardian.phone, phone));
  let guardianId = existingGuardian?.id;

  if (!guardianId) {
    const guardianBase = makeGuardianBase(payload);
    const insertGuardian = await supabase
      .from("guardians")
      .insert({
        id: guardianBase.id,
        shop_id: guardianBase.shop_id,
        name: guardianBase.name,
        phone: guardianBase.phone,
        memo: guardianBase.memo,
        created_at: guardianBase.created_at,
        updated_at: guardianBase.updated_at,
      })
      .select("id")
      .single();

    if (insertGuardian.error) throw new Error(insertGuardian.error.message);
    guardianId = insertGuardian.data.id;
  }

  const petQuery = await supabase
    .from("pets")
    .select("id,name")
    .eq("shop_id", payload.shopId)
    .eq("guardian_id", guardianId)
    .eq("name", payload.petName.trim())
    .limit(1)
    .maybeSingle();

  if (petQuery.error) throw new Error(petQuery.error.message);

  let petId = petQuery.data?.id;

  if (!petId) {
    const petBase = makePetBase(payload, guardianId);
    const insertPet = await supabase
      .from("pets")
      .insert({
        id: petBase.id,
        shop_id: petBase.shop_id,
        guardian_id: petBase.guardian_id,
        name: petBase.name,
        breed: petBase.breed,
        weight: petBase.weight,
        age: petBase.age,
        notes: petBase.notes,
        grooming_cycle_weeks: petBase.grooming_cycle_weeks,
        avatar_seed: petBase.avatar_seed,
        created_at: petBase.created_at,
        updated_at: petBase.updated_at,
      })
      .select("id")
      .single();

    if (insertPet.error) throw new Error(insertPet.error.message);
    petId = insertPet.data.id;
  }

  return { guardianId, petId };
}

export async function createCustomerBooking(input: unknown) {
  const payload = customerBookingCreateSchema.parse(input);
  const bootstrap = await getBootstrap(payload.shopId);
  const entityIds =
    bootstrap.mode === "supabase" && hasSupabaseServerEnv()
      ? await findOrCreateSupabaseEntities(payload)
      : await findOrCreateMockEntities(payload);

  return createAppointment({
    shopId: payload.shopId,
    guardianId: entityIds.guardianId,
    petId: entityIds.petId,
    serviceId: payload.serviceId,
    appointmentDate: payload.appointmentDate,
    appointmentTime: payload.appointmentTime,
    memo: payload.memo.trim(),
    source: "customer",
  });
}

export async function lookupCustomerBookings(shopId: string, phone: string) {
  const normalizedPhone = normalizePhone(phone);
  const bootstrap = await getBootstrap(shopId);
  const guardians = bootstrap.guardians.filter((guardian) => matchPhone(guardian.phone, normalizedPhone));
  const guardianIds = new Set(guardians.map((guardian) => guardian.id));
  const pets = bootstrap.pets.filter((pet) => guardianIds.has(pet.guardian_id));
  const petIds = new Set(pets.map((pet) => pet.id));
  const appointments = bootstrap.appointments.filter((appointment) => guardianIds.has(appointment.guardian_id) || petIds.has(appointment.pet_id));
  const groomingRecords = bootstrap.groomingRecords.filter((record) => guardianIds.has(record.guardian_id) || petIds.has(record.pet_id));

  return {
    guardians: guardians.map(({ id, name, phone: guardianPhone }) => ({ id, name, phone: guardianPhone })),
    pets: pets.map(({ id, name, guardian_id }) => ({ id, name, guardian_id })),
    appointments,
    groomingRecords,
  };
}

async function updateMockAppointment(appointmentId: string, updater: (appointment: Appointment) => Appointment) {
  const store = getMockStore();
  const appointment = store.appointments.find((item) => item.id === appointmentId);
  if (!appointment) throw new Error("예약 정보를 찾을 수 없습니다.");

  const next = updater(appointment);
  store.appointments = store.appointments.map((item) => (item.id === appointmentId ? next : item));
  setMockStore(store);
  return next;
}

async function updateSupabaseAppointment(appointmentId: string, values: Partial<Appointment>) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase 연결을 확인할 수 없습니다.");

  const { data, error } = await supabase
    .from("appointments")
    .update(values)
    .eq("id", appointmentId)
    .select("*")
    .single();

  if (error) {
    const hasRejectionReason = Object.prototype.hasOwnProperty.call(values, "rejection_reason");
    if (hasRejectionReason && /rejection_reason/i.test(`${error.message} ${error.details ?? ""} ${error.hint ?? ""}`)) {
      const { rejection_reason, ...fallbackValues } = values;
      const fallback = await supabase
        .from("appointments")
        .update(fallbackValues)
        .eq("id", appointmentId)
        .select("*")
        .single();

      if (fallback.error) throw new Error(fallback.error.message);
      return { ...fallback.data, rejection_reason: rejection_reason ?? null } as Appointment;
    }

    throw new Error(error.message);
  }

  return data as Appointment;
}

export async function updateCustomerBooking(input: unknown) {
  const payload = customerBookingUpdateSchema.parse(input);
  const bootstrap = await getBootstrap(payload.shopId);
  const appointment = bootstrap.appointments.find((item) => item.id === payload.appointmentId);

  if (!appointment) {
    throw new Error("예약 정보를 찾을 수 없습니다.");
  }

  const guardian = bootstrap.guardians.find((item) => item.id === appointment.guardian_id);
  if (!guardian || !matchPhone(guardian.phone, payload.phone)) {
    throw new Error("예약자 정보를 확인할 수 없습니다.");
  }

  if (!canManageAppointment(appointment)) {
    throw new Error("이미 지난 예약은 변경하거나 취소할 수 없습니다.");
  }

  if (payload.action === "cancel") {
    const nextValues = {
      status: "cancelled" as const,
      updated_at: nowIso(),
      rejection_reason: null,
    };

    if (bootstrap.mode !== "supabase" || !hasSupabaseServerEnv()) {
      return updateMockAppointment(payload.appointmentId, (current) => ({ ...current, ...nextValues }));
    }

    return updateSupabaseAppointment(payload.appointmentId, nextValues);
  }

  const service = bootstrap.services.find((item) => item.id === payload.serviceId);
  if (!service) {
    throw new Error("서비스 정보를 찾을 수 없습니다.");
  }

  const availableSlots = computeAvailableSlots({
    date: payload.appointmentDate,
    serviceId: payload.serviceId,
    shop: bootstrap.shop,
    services: bootstrap.services,
    appointments: bootstrap.appointments,
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
    status: (bootstrap.shop.approval_mode === "auto" ? "confirmed" : "pending") as Appointment["status"],
    rejection_reason: null,
    start_at: appointmentWindow.start_at,
    end_at: appointmentWindow.end_at,
    updated_at: nowIso(),
  };

  if (bootstrap.mode !== "supabase" || !hasSupabaseServerEnv()) {
    return updateMockAppointment(payload.appointmentId, (current) => ({ ...current, ...nextValues }));
  }

  return updateSupabaseAppointment(payload.appointmentId, nextValues);
}
