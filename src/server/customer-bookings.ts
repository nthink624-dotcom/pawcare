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
import {
  buildBookingManageUrl,
  createBookingAccessToken,
  verifyBookingAccessToken,
} from "@/server/booking-access-token";
import { getMockStore, setMockStore } from "@/server/mock-store";
import { createAppointment } from "@/server/owner-mutations";
import { dispatchNotification } from "@/server/notification-dispatch";
import type { Appointment, Guardian, Pet } from "@/types/domain";

const customerBookingCreateSchema = z.object({
  shopId: z.string().min(1),
  guardianName: z.string().trim().min(1),
  phone: z.string().trim().min(10),
  petName: z.string().trim().min(1),
  breed: z.string().trim().optional().default(""),
  extraPets: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        breed: z.string().trim().optional().default(""),
      }),
    )
    .optional()
    .default([]),
  serviceId: z.string().min(1),
  customServiceName: z.string().trim().optional().default(""),
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
    guardianName: z.string().trim().min(1),
    petName: z.string().trim().min(1),
  }),
  z.object({
    action: z.literal("reschedule"),
    shopId: z.string().min(1),
    appointmentId: z.string().min(1),
    phone: z.string().trim().min(10),
    guardianName: z.string().trim().min(1),
    petName: z.string().trim().min(1),
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

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function matchName(a: string, b: string) {
  return normalizeName(a) === normalizeName(b);
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

function makePetBase(
  payload: z.infer<typeof customerBookingCreateSchema>,
  guardianId: string,
  petInput?: { name: string; breed?: string },
) {
  const petName = (petInput?.name ?? payload.petName).trim();
  const breed = (petInput?.breed ?? payload.breed).trim();

  return {
    id: randomUUID(),
    shop_id: payload.shopId,
    guardian_id: guardianId,
    name: petName,
    breed: breed || "미정",
    weight: null,
    age: null,
    notes: "",
    grooming_cycle_weeks: 4,
    avatar_seed: petName.slice(0, 1) || "M",
    created_at: nowIso(),
    updated_at: nowIso(),
  };
}

async function findOrCreateMockEntities(payload: z.infer<typeof customerBookingCreateSchema>) {
  const store = getMockStore();
  const scopedGuardians = store.guardians.filter((item) => item.shop_id === payload.shopId);
  const exactActiveGuardian = scopedGuardians.find(
    (item) => !item.deleted_at && matchPhone(item.phone, payload.phone) && matchName(item.name, payload.guardianName),
  );
  const exactDeletedGuardian = scopedGuardians.find(
    (item) => item.deleted_at && matchPhone(item.phone, payload.phone) && matchName(item.name, payload.guardianName),
  );
  const phoneOnlyActiveGuardian = scopedGuardians.find(
    (item) => !item.deleted_at && matchPhone(item.phone, payload.phone),
  );
  let guardian = exactActiveGuardian ?? exactDeletedGuardian ?? phoneOnlyActiveGuardian;

  if (!guardian) {
    guardian = {
      ...makeGuardianBase(payload),
      notification_settings: { enabled: true, revisit_enabled: true },
    } as Guardian;
    store.guardians = [...store.guardians, guardian];
  } else if (guardian.deleted_at) {
    guardian.deleted_at = null;
    guardian.deleted_restore_until = null;
    guardian.name = normalizeName(payload.guardianName);
    guardian.phone = normalizePhone(payload.phone);
    guardian.updated_at = nowIso();
  } else {
    guardian.phone = normalizePhone(payload.phone);
    guardian.updated_at = nowIso();
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

  const extraPets = payload.extraPets ?? [];
  for (const extraPet of extraPets) {
    const exists = store.pets.find(
      (item) =>
        item.shop_id === payload.shopId &&
        item.guardian_id === guardian.id &&
        item.name.trim() === extraPet.name.trim(),
    );

    if (!exists) {
      store.pets = [...store.pets, makePetBase(payload, guardian.id, extraPet) as Pet];
    }
  }

  setMockStore(store);
  return { guardianId: guardian.id, petId: pet.id };
}

async function findOrCreateSupabaseEntities(payload: z.infer<typeof customerBookingCreateSchema>) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase 연결을 확인할 수 없습니다.");

  const phone = normalizePhone(payload.phone);
  const guardianName = normalizeName(payload.guardianName);
  const guardianQuery = await supabase
    .from("guardians")
    .select("id,name,phone,deleted_at")
    .eq("shop_id", payload.shopId)
    .order("created_at");

  if (guardianQuery.error) throw new Error(guardianQuery.error.message);

  const guardians = guardianQuery.data ?? [];
  const exactActiveGuardian = guardians.find(
    (guardian) => !guardian.deleted_at && matchPhone(guardian.phone, phone) && matchName(guardian.name, guardianName),
  );
  const exactDeletedGuardian = guardians.find(
    (guardian) => guardian.deleted_at && matchPhone(guardian.phone, phone) && matchName(guardian.name, guardianName),
  );
  const phoneOnlyActiveGuardian = guardians.find(
    (guardian) => !guardian.deleted_at && matchPhone(guardian.phone, phone),
  );
  let guardianId = exactActiveGuardian?.id ?? exactDeletedGuardian?.id ?? phoneOnlyActiveGuardian?.id;

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
        notification_settings: { enabled: true, revisit_enabled: true },
        created_at: guardianBase.created_at,
        updated_at: guardianBase.updated_at,
      })
      .select("id")
      .single();

    if (insertGuardian.error) throw new Error(insertGuardian.error.message);
    guardianId = insertGuardian.data.id;
  } else if (exactDeletedGuardian) {
    const restoredGuardian = await supabase
      .from("guardians")
      .update({
        deleted_at: null,
        deleted_restore_until: null,
        name: guardianName,
        phone,
        updated_at: nowIso(),
      })
      .eq("id", exactDeletedGuardian.id)
      .select("id")
      .single();

    if (restoredGuardian.error) throw new Error(restoredGuardian.error.message);
    guardianId = restoredGuardian.data.id;
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

  for (const extraPet of payload.extraPets ?? []) {
    const extraPetName = extraPet.name.trim();
    if (!extraPetName) continue;

    const existingExtraPet = await supabase
      .from("pets")
      .select("id")
      .eq("shop_id", payload.shopId)
      .eq("guardian_id", guardianId)
      .eq("name", extraPetName)
      .limit(1)
      .maybeSingle();

    if (existingExtraPet.error) throw new Error(existingExtraPet.error.message);
    if (existingExtraPet.data?.id) continue;

    const petBase = makePetBase(payload, guardianId, extraPet);
    const insertExtraPet = await supabase
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
      });

    if (insertExtraPet.error) throw new Error(insertExtraPet.error.message);
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

  const fallbackServiceId = bootstrap.services[0]?.id;
  const usesCustomService = payload.serviceId === "__custom__";
  const resolvedServiceId = usesCustomService ? fallbackServiceId : payload.serviceId;

  if (!resolvedServiceId) {
    throw new Error("예약 가능한 서비스 정보를 찾을 수 없습니다.");
  }

  const customServiceMemo = usesCustomService && payload.customServiceName.trim() ? `기타 요청 서비스: ${payload.customServiceName.trim()}` : "";
  const mergedMemo = [customServiceMemo, payload.memo.trim()].filter(Boolean).join("\n");

  const appointment = await createAppointment({
    shopId: payload.shopId,
    guardianId: entityIds.guardianId,
    petId: entityIds.petId,
    serviceId: resolvedServiceId,
    customServiceName: usesCustomService ? payload.customServiceName.trim() : "",
    appointmentDate: payload.appointmentDate,
    appointmentTime: payload.appointmentTime,
    memo: mergedMemo,
    source: "customer",
  });

  const bookingAccessToken = createBookingAccessToken({
    shopId: payload.shopId,
    guardianId: entityIds.guardianId,
    petId: entityIds.petId,
  });

  return {
    appointment,
    bookingAccessToken,
    bookingManageUrl: buildBookingManageUrl(payload.shopId, bookingAccessToken),
  };
}

export async function lookupCustomerBookings(shopId: string, phone: string, guardianName: string, petName: string) {
  const normalizedPhone = normalizePhone(phone);
  const normalizedGuardianName = normalizeName(guardianName);
  const normalizedPetName = normalizeName(petName);
  const bootstrap = await getBootstrap(shopId);
  const scopedGuardians = bootstrap.guardians.filter(
    (guardian) => matchPhone(guardian.phone, normalizedPhone) && matchName(guardian.name, normalizedGuardianName),
  );

  if (scopedGuardians.length === 0) {
    throw new Error("연락처와 보호자 이름이 일치하는 예약을 찾지 못했어요.");
  }

  const scopedGuardianIds = new Set(scopedGuardians.map((guardian) => guardian.id));
  const scopedPets = bootstrap.pets.filter(
    (pet) => scopedGuardianIds.has(pet.guardian_id) && matchName(pet.name, normalizedPetName),
  );

  if (scopedPets.length === 0) {
    throw new Error("연락처, 보호자 이름, 반려동물 이름이 일치하는 예약을 찾지 못했어요.");
  }

  const scopedPetIds = new Set(scopedPets.map((pet) => pet.id));
  const scopedAppointments = bootstrap.appointments.filter((appointment) => scopedPetIds.has(appointment.pet_id));
  const groomingRecords = bootstrap.groomingRecords.filter((record) => scopedPetIds.has(record.pet_id));

  return {
    guardians: scopedGuardians.map(({ id, name, phone: guardianPhone }) => ({ id, name, phone: guardianPhone })),
    pets: scopedPets.map(({ id, name, guardian_id }) => ({ id, name, guardian_id })),
    appointments: scopedAppointments,
    groomingRecords,
  };
}

export async function lookupCustomerBookingsByToken(shopId: string, token: string) {
  const payload = verifyBookingAccessToken(token);
  if (payload.shopId !== shopId) {
    throw new Error("유효하지 않은 예약 확인 링크입니다.");
  }

  const bootstrap = await getBootstrap(shopId);
  const guardian = bootstrap.guardians.find((item) => item.id === payload.guardianId);
  const pet = bootstrap.pets.find((item) => item.id === payload.petId);

  if (!guardian || !pet) {
    throw new Error("예약 정보를 찾지 못했어요.");
  }

  const scopedAppointments = bootstrap.appointments.filter((appointment) => appointment.pet_id === pet.id);
  const groomingRecords = bootstrap.groomingRecords.filter((record) => record.pet_id === pet.id);

  return {
    guardians: [{ id: guardian.id, name: guardian.name, phone: guardian.phone }],
    pets: [{ id: pet.id, name: pet.name, guardian_id: pet.guardian_id }],
    appointments: scopedAppointments,
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
  const pet = bootstrap.pets.find((item) => item.id === appointment.pet_id);
  if (
    !guardian ||
    !pet ||
    !matchPhone(guardian.phone, payload.phone) ||
    !matchName(guardian.name, payload.guardianName) ||
    !matchName(pet.name, payload.petName)
  ) {
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
      const updated = await updateMockAppointment(payload.appointmentId, (current) => ({ ...current, ...nextValues }));
      await dispatchNotification({
        shopId: updated.shop_id,
        appointmentId: updated.id,
        guardianId: updated.guardian_id,
        petId: updated.pet_id,
        type: "booking_cancelled",
      });
      return updated;
    }

    const updated = await updateSupabaseAppointment(payload.appointmentId, nextValues);
    await dispatchNotification({
      shopId: updated.shop_id,
      appointmentId: updated.id,
      guardianId: updated.guardian_id,
      petId: updated.pet_id,
      type: "booking_cancelled",
    });
    return updated;
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
    const updated = await updateMockAppointment(payload.appointmentId, (current) => ({ ...current, ...nextValues }));
    if (updated.status === "confirmed") {
      await dispatchNotification({
        shopId: updated.shop_id,
        appointmentId: updated.id,
        guardianId: updated.guardian_id,
        petId: updated.pet_id,
        type: "booking_rescheduled_confirmed",
      });
    }
    return updated;
  }

  const updated = await updateSupabaseAppointment(payload.appointmentId, nextValues);
  if (updated.status === "confirmed") {
    await dispatchNotification({
      shopId: updated.shop_id,
      appointmentId: updated.id,
      guardianId: updated.guardian_id,
      petId: updated.pet_id,
      type: "booking_rescheduled_confirmed",
    });
  }
  return updated;
}
