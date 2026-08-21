import { randomUUID } from "node:crypto";

import { after } from "next/server";
import { z } from "zod";

import { computeAvailableSlots } from "@/lib/availability";
import { getAppointmentWriteErrorMessage } from "@/lib/appointment-write-errors";
import {
  applyConfiguredCustomerServiceOverrides,
  buildCustomerServiceSourceOptions,
} from "@/lib/customer-service-options";
import { findCustomerBreedPricingGroup } from "@/lib/customer-breed-pricing-group";
import { assertCustomerBookingDate } from "@/lib/customer-booking-window";
import { buildCustomerWeightHistory } from "@/lib/customer-weight-history";
import {
  addDate,
  currentDateInTimeZone,
  currentMinutesInTimeZone,
  formatClockTime,
  minutesFromTime,
  nowIso,
  phoneNormalize,
  timeFromMinutes,
} from "@/lib/utils";
import { hasSupabaseServerEnv } from "@/lib/server-env";
import { deliverCustomerBookingNotificationSafely } from "@/lib/customer-booking-notification";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getBootstrap } from "@/server/bootstrap";
import {
  quoteCustomerDiscount,
  type CustomerDiscountQuoteResponse,
} from "@/server/customer-discount-quote";
import {
  buildBookingManageUrl,
  createBookingAccessToken,
  verifyBookingAccessToken,
} from "@/server/booking-access-token";
import { getMockStore, setMockStore } from "@/server/mock-store";
import { createAppointment } from "@/server/owner-mutations";
import { dispatchNotification } from "@/server/notification-dispatch";
import type { Appointment, Guardian, Pet, Shop } from "@/types/domain";

const customerBookingCreateSchema = z.object({
  shopId: z.string().min(1),
  guardianName: z.string().trim().min(1),
  phone: z.string().trim().min(10),
  petName: z.string().trim().min(1),
  breed: z.string().trim().optional().default(""),
  weightKg: z.coerce.number().positive().max(200),
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
  customerServiceOptionId: z.string().trim().optional().default(""),
  staffId: z.string().nullable().optional(),
  customServiceName: z.string().trim().optional().default(""),
  appointmentDate: z.string().min(1),
  appointmentTime: z.string().min(1),
  memo: z.string().optional().default(""),
  expectedFinalAmount: z.coerce.number().int().min(0).optional(),
  rebookingAccessToken: z.string().trim().optional().default(""),
  rebookingPetId: z.string().trim().optional().default(""),
});

const customerBookingUpdateSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("cancel"),
    shopId: z.string().min(1),
    appointmentId: z.string().min(1),
    accessToken: z.string().trim().min(1),
  }),
  z.object({
    action: z.literal("reschedule"),
    shopId: z.string().min(1),
    appointmentId: z.string().min(1),
    accessToken: z.string().trim().min(1),
    serviceId: z.string().min(1),
    appointmentDate: z.string().min(1),
    appointmentTime: z.string().min(1),
    memo: z.string().optional().default(""),
  }),
  z.object({
    action: z.literal("update_memo"),
    shopId: z.string().min(1),
    appointmentId: z.string().min(1),
    accessToken: z.string().trim().min(1),
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
  if (appointment.status !== "confirmed") return false;

  const today = currentDateInTimeZone();
  if (appointment.appointment_date > today) return true;
  if (appointment.appointment_date < today) return false;

  return minutesFromTime(appointment.appointment_time) > currentMinutesInTimeZone();
}

function countsTowardVisitHistory(appointment: Appointment) {
  return appointment.status !== "cancelled" && appointment.status !== "rejected" && appointment.status !== "noshow";
}

function getGuardianPetsForProfile(bootstrap: Awaited<ReturnType<typeof getBootstrap>>, guardianId: string) {
  return bootstrap.pets
    .filter((pet) => pet.guardian_id === guardianId)
    .map(({ id, name, guardian_id, breed, weight }) => ({ id, name, guardian_id, breed, weight }));
}

function cancelWindowMinutes(value: NonNullable<Shop["reservation_policy_settings"]>["cancel_window"] | string | null | undefined) {
  switch (value) {
    case "none":
      return null;
    case "1h":
      return 60;
    case "6h":
      return 6 * 60;
    case "24h":
      return 24 * 60;
    case "2h":
    default:
      return 2 * 60;
  }
}

function assertCustomerCanChangeBooking(shop: Shop, appointment: Appointment) {
  const policy = shop.reservation_policy_settings;
  const windowMinutes = cancelWindowMinutes(policy?.cancel_window);

  if (policy?.customer_change_enabled === false || windowMinutes === null) {
    throw new Error("고객 직접 변경/취소가 허용되지 않는 예약입니다. 매장에 문의해 주세요.");
  }

  const appointmentStartsAt = new Date(appointment.start_at).getTime();
  const latestCustomerChangeAt = appointmentStartsAt - windowMinutes * 60 * 1000;

  if (Date.now() > latestCustomerChangeAt) {
    throw new Error("고객 직접 변경/취소 가능 시간이 지났습니다. 매장에 문의해 주세요.");
  }
}

function normalizePhone(value: string) {
  return phoneNormalize(value).slice(0, 11);
}

function matchPhone(a: string, b: string) {
  return normalizePhone(a) === normalizePhone(b);
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, "");
}

function matchName(a: string, b: string) {
  return normalizeName(a) === normalizeName(b);
}

function resolveRebookingAccess(payload: z.infer<typeof customerBookingCreateSchema>) {
  if (!payload.rebookingAccessToken) return null;

  const access = verifyBookingAccessToken(payload.rebookingAccessToken);
  if (access.shopId !== payload.shopId || access.action !== "rebook") {
    throw new Error("유효하지 않거나 만료된 재예약 링크입니다.");
  }
  return access;
}

function parsePetProfile(value: string) {
  const raw = value.trim();
  const weightMatch = raw.match(/(\d+(?:[.,]\d+)?)\s*(?:kg|키로|킬로)/i);
  const weight = weightMatch ? Number(weightMatch[1].replace(",", ".")) : null;
  const breed = raw
    .replace(/(\d+(?:[.,]\d+)?)\s*(?:kg|키로|킬로)/gi, "")
    .replace(/[·,/|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    breed: breed || "미정",
    weight: Number.isFinite(weight) ? weight : null,
    raw,
  };
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
  const profile = parsePetProfile(petInput?.breed ?? payload.breed);

  return {
    id: randomUUID(),
    shop_id: payload.shopId,
    guardian_id: guardianId,
    name: petName,
    breed: profile.breed,
    weight: petInput ? profile.weight : payload.weightKg,
    age: null,
    notes: profile.raw ? `고객 입력: ${profile.raw}` : "",
    grooming_cycle_weeks: 4,
    avatar_seed: petName.slice(0, 1) || "M",
    created_at: nowIso(),
    updated_at: nowIso(),
  };
}

function scheduleCustomerBookingNotification(input: Parameters<typeof dispatchNotification>[0]) {
  const task = () => deliverCustomerBookingNotificationSafely(input, dispatchNotification);

  try {
    after(task);
  } catch {
    void task();
  }
}

async function findOrCreateMockEntities(payload: z.infer<typeof customerBookingCreateSchema>) {
  const store = getMockStore();
  const rebookingAccess = resolveRebookingAccess(payload);
  const scopedGuardians = store.guardians.filter((item) => item.shop_id === payload.shopId);
  const exactActiveGuardian = scopedGuardians.find(
    (item) => !item.deleted_at && matchPhone(item.phone, payload.phone) && matchName(item.name, payload.guardianName),
  );
  const exactDeletedGuardian = scopedGuardians.find(
    (item) => item.deleted_at && matchPhone(item.phone, payload.phone) && matchName(item.name, payload.guardianName),
  );
  let guardian = rebookingAccess
    ? scopedGuardians.find((item) => item.id === rebookingAccess.guardianId && !item.deleted_at)
    : exactActiveGuardian ?? exactDeletedGuardian;

  if (rebookingAccess && !guardian) {
    throw new Error("재예약할 고객 정보를 찾지 못했습니다. 매장에 문의해 주세요.");
  }

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

  let pet = payload.rebookingPetId
    ? store.pets.find(
        (item) =>
          item.id === payload.rebookingPetId &&
          item.shop_id === payload.shopId &&
          item.guardian_id === guardian.id,
      )
    : store.pets.find(
        (item) =>
          item.shop_id === payload.shopId &&
          item.guardian_id === guardian.id &&
          matchName(item.name, payload.petName),
      );

  if (payload.rebookingPetId && !pet) {
    throw new Error("재예약할 반려동물 정보를 찾지 못했습니다. 다시 링크를 열어 주세요.");
  }

  if (!pet) {
    pet = makePetBase(payload, guardian.id) as Pet;
    store.pets = [...store.pets, pet];
  } else if (payload.breed.trim()) {
    const petBase = makePetBase(payload, guardian.id);
    pet.breed = petBase.breed;
    pet.weight = petBase.weight;
    pet.notes = petBase.notes || pet.notes;
    pet.updated_at = nowIso();
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
    } else if (extraPet.breed?.trim()) {
      const petBase = makePetBase(payload, guardian.id, extraPet);
      exists.breed = petBase.breed;
      exists.weight = petBase.weight;
      exists.notes = petBase.notes || exists.notes;
      exists.updated_at = nowIso();
    }
  }

  setMockStore(store);
  return { guardianId: guardian.id, petId: pet.id };
}

async function findOrCreateSupabaseEntities(payload: z.infer<typeof customerBookingCreateSchema>) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase 연결을 확인할 수 없습니다.");

  const rebookingAccess = resolveRebookingAccess(payload);
  const phone = normalizePhone(payload.phone);
  const guardianName = normalizeName(payload.guardianName);
  const guardianNotificationSettingsProbe = await supabase
    .from("guardians")
    .select("id,notification_settings")
    .eq("shop_id", payload.shopId)
    .limit(1);

  const supportsGuardianNotificationSettings = !(
    guardianNotificationSettingsProbe.error &&
    hasMissingColumnError(guardianNotificationSettingsProbe.error, "notification_settings")
  );

  if (guardianNotificationSettingsProbe.error && supportsGuardianNotificationSettings) {
    throw new Error(guardianNotificationSettingsProbe.error.message);
  }

  const guardianQueryWithDeletedAt = await supabase
    .from("guardians")
    .select("id,name,phone,deleted_at")
    .eq("shop_id", payload.shopId)
    .order("created_at");

  const guardianQuery = guardianQueryWithDeletedAt.error && hasMissingColumnError(guardianQueryWithDeletedAt.error, "deleted_at")
    ? await supabase.from("guardians").select("id,name,phone").eq("shop_id", payload.shopId).order("created_at")
    : guardianQueryWithDeletedAt;

  if (guardianQuery.error) throw new Error(guardianQuery.error.message);

  const supportsGuardianSoftDelete = !(guardianQueryWithDeletedAt.error && hasMissingColumnError(guardianQueryWithDeletedAt.error, "deleted_at"));
  const guardians = (guardianQuery.data ?? []).map((guardian) => ({
    ...guardian,
    deleted_at: supportsGuardianSoftDelete ? (guardian as { deleted_at?: string | null }).deleted_at ?? null : null,
  }));
  const exactActiveGuardian = guardians.find(
    (guardian) => !guardian.deleted_at && matchPhone(guardian.phone, phone) && matchName(guardian.name, guardianName),
  );
  const exactDeletedGuardian = guardians.find(
    (guardian) => guardian.deleted_at && matchPhone(guardian.phone, phone) && matchName(guardian.name, guardianName),
  );
  const rebookingGuardian = rebookingAccess
    ? guardians.find((guardian) => guardian.id === rebookingAccess.guardianId && !guardian.deleted_at)
    : null;
  let guardianId = rebookingAccess
    ? rebookingGuardian?.id
    : exactActiveGuardian?.id ?? exactDeletedGuardian?.id;

  if (rebookingAccess && !guardianId) {
    throw new Error("재예약할 고객 정보를 찾지 못했습니다. 매장에 문의해 주세요.");
  }

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
        ...(supportsGuardianNotificationSettings
          ? { notification_settings: { enabled: true, revisit_enabled: true } }
          : {}),
        created_at: guardianBase.created_at,
        updated_at: guardianBase.updated_at,
      })
      .select("id")
      .single();

    if (insertGuardian.error) {
      if (hasMissingColumnError(insertGuardian.error, "notification_settings")) {
        const fallbackGuardian = await supabase
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

        if (fallbackGuardian.error) throw new Error(fallbackGuardian.error.message);
        guardianId = fallbackGuardian.data.id;
      } else {
        throw new Error(insertGuardian.error.message);
      }
    } else {
      guardianId = insertGuardian.data.id;
    }
  } else if (exactDeletedGuardian) {
    const restoredGuardian = supportsGuardianSoftDelete
      ? await supabase
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
          .single()
      : await supabase
          .from("guardians")
          .update({
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

  const petQueryBuilder = supabase
    .from("pets")
    .select("id,name")
    .eq("shop_id", payload.shopId)
    .eq("guardian_id", guardianId);
  const petQuery = await (payload.rebookingPetId
    ? petQueryBuilder.eq("id", payload.rebookingPetId)
    : petQueryBuilder.eq("name", payload.petName.trim()))
    .limit(1)
    .maybeSingle();

  if (petQuery.error) throw new Error(petQuery.error.message);

  let petId = petQuery.data?.id;

  if (payload.rebookingPetId && !petId) {
    throw new Error("재예약할 반려동물 정보를 찾지 못했습니다. 다시 링크를 열어 주세요.");
  }

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
  } else if (payload.breed.trim()) {
    const petBase = makePetBase(payload, guardianId);
    const updatePet = await supabase
      .from("pets")
      .update({
        breed: petBase.breed,
        weight: petBase.weight,
        notes: petBase.notes,
        updated_at: nowIso(),
      })
      .eq("id", petId);

    if (updatePet.error) throw new Error(updatePet.error.message);
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
    if (existingExtraPet.data?.id) {
      if (extraPet.breed.trim()) {
        const petBase = makePetBase(payload, guardianId, extraPet);
        const updateExtraPet = await supabase
          .from("pets")
          .update({
            breed: petBase.breed,
            weight: petBase.weight,
            notes: petBase.notes,
            updated_at: nowIso(),
          })
          .eq("id", existingExtraPet.data.id);

        if (updateExtraPet.error) throw new Error(updateExtraPet.error.message);
      }
      continue;
    }

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

export async function createCustomerBooking(
  input: unknown,
  options: { trustedDiscountQuote?: CustomerDiscountQuoteResponse } = {},
) {
  const payload = customerBookingCreateSchema.parse(input);
  assertCustomerBookingDate(payload.appointmentDate);
  const bootstrap = await getBootstrap(payload.shopId);
  const discountQuote =
    options.trustedDiscountQuote ??
    (await quoteCustomerDiscount({
      shopId: payload.shopId,
      guardianName: payload.guardianName,
      phone: payload.phone,
      serviceId: payload.serviceId,
      customerServiceOptionId: payload.customerServiceOptionId,
      breed: payload.breed,
      weightKg: payload.weightKg,
      appointmentDate: payload.appointmentDate,
    }));

  if (
    payload.expectedFinalAmount !== undefined &&
    payload.expectedFinalAmount !== discountQuote.finalAmount
  ) {
    throw new Error("혜택 또는 서비스 금액이 변경되었습니다. 최종 금액을 다시 확인해 주세요.");
  }
  const entityIds =
    bootstrap.mode === "supabase" && hasSupabaseServerEnv()
      ? await findOrCreateSupabaseEntities(payload)
      : await findOrCreateMockEntities(payload);

  const fallbackServiceId = bootstrap.services[0]?.id;
  const usesCustomService = payload.serviceId === "__custom__";
  const pricingGroup = findCustomerBreedPricingGroup(bootstrap.services, payload.breed);
  const customerServiceOptions = applyConfiguredCustomerServiceOverrides(
    buildCustomerServiceSourceOptions(bootstrap.services, {
      priceGuideGroupKey: pricingGroup?.key,
      weightKg: payload.weightKg,
    }),
    bootstrap.shop.customer_page_settings.customer_service_overrides,
  );
  const selectedCustomerServiceOption = payload.customerServiceOptionId
    ? customerServiceOptions.find((option) => option.id === payload.customerServiceOptionId && option.serviceId === payload.serviceId)
    : null;

  if (payload.customerServiceOptionId && !selectedCustomerServiceOption) {
    throw new Error("선택한 서비스가 현재 예약 페이지에 노출되어 있지 않습니다.");
  }

  const resolvedServiceId = usesCustomService
    ? fallbackServiceId
    : selectedCustomerServiceOption?.serviceId ?? payload.serviceId;

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
    durationMinutes: selectedCustomerServiceOption?.durationMinutes,
    staffId: payload.staffId ?? null,
    customServiceName: usesCustomService ? payload.customServiceName.trim() : "",
    appointmentDate: payload.appointmentDate,
    appointmentTime: payload.appointmentTime,
    memo: mergedMemo,
    source: "customer",
    customerVisitType: discountQuote.visitType,
    discountCouponIds: discountQuote.appliedCoupons.map((coupon) => coupon.id),
    discountCouponNames: discountQuote.appliedCoupons.map((coupon) => coupon.name),
    originalServicePrice: discountQuote.originalAmount,
    discountAmount: discountQuote.discountAmount,
    finalServicePrice: discountQuote.finalAmount,
    discountSnapshot: {
      ...discountQuote,
      customerServiceOptionId:
        selectedCustomerServiceOption?.id ?? discountQuote.customerServiceOptionId,
      customerServiceOptionName: selectedCustomerServiceOption?.name ?? null,
      customerServiceOptionDurationMinutes:
        selectedCustomerServiceOption?.durationMinutes ?? null,
    },
  });

  scheduleCustomerBookingNotification({
    shopId: appointment.shop_id,
    appointmentId: appointment.id,
    guardianId: appointment.guardian_id,
    petId: appointment.pet_id,
    type: "owner_booking_requested",
    channel: "in_app",
    force: true,
    skipIfExists: true,
    message: [
      "새 예약이 확정되었어요.",
      `${payload.guardianName.trim()} / ${payload.petName.trim()}`,
      `${payload.appointmentDate} ${formatClockTime(payload.appointmentTime)}`,
    ].join("\n"),
    metadata: {
      source: "customer_booking",
      guardianName: payload.guardianName.trim(),
      petName: payload.petName.trim(),
      appointmentDate: payload.appointmentDate,
      appointmentTime: payload.appointmentTime,
    },
  });

  const bookingAccessToken = createBookingAccessToken({
    shopId: payload.shopId,
    guardianId: entityIds.guardianId,
    petId: entityIds.petId,
    appointmentId: appointment.id,
    action: "manage",
  });
  const updatedBootstrap = await getBootstrap(payload.shopId, {
    includeNotifications: false,
    includeGroomingRecords: false,
    includeLanding: false,
  });

  return {
    appointment,
    bookingAccessToken,
    bookingManageUrl: buildBookingManageUrl(payload.shopId, bookingAccessToken),
    profilePets: getGuardianPetsForProfile(updatedBootstrap, entityIds.guardianId),
    discountQuote,
  };
}

export async function lookupCustomerBookingsByToken(shopId: string, token: string) {
  const payload = verifyBookingAccessToken(token);
  if (payload.shopId !== shopId) {
    throw new Error("유효하지 않은 예약 확인 링크입니다.");
  }

  if (payload.action !== "manage" && payload.action !== "reschedule" && payload.action !== "result") {
    throw new Error("예약 관리에 사용할 수 없는 링크입니다.");
  }

  const bootstrap = await getBootstrap(shopId);
  const guardian = bootstrap.guardians.find((item) => item.id === payload.guardianId);
  const pet = bootstrap.pets.find((item) => item.id === payload.petId);

  if (!guardian || !pet) {
    throw new Error("예약 정보를 찾지 못했어요.");
  }

  const scopedPets = bootstrap.pets.filter((item) => item.id === payload.petId && item.guardian_id === guardian.id);
  const scopedPetIds = new Set(scopedPets.map((item) => item.id));
  const scopedAppointments = bootstrap.appointments.filter(
    (appointment) =>
      appointment.id === payload.appointmentId &&
      appointment.guardian_id === payload.guardianId &&
      appointment.pet_id === payload.petId,
  );
  if (scopedAppointments.length === 0) {
    throw new Error("예약 정보를 찾지 못했어요.");
  }
  const scopedGroomingRecords = bootstrap.groomingRecords.filter((record) => scopedPetIds.has(record.pet_id));
  const currentResultRecord = scopedGroomingRecords.find((record) => record.appointment_id === payload.appointmentId);
  const weightHistory = payload.action === "result"
    ? buildCustomerWeightHistory(
        scopedGroomingRecords,
        payload.petId,
        12,
        typeof pet.weight === "number" && pet.weight > 0
          ? {
              measuredAt: currentResultRecord?.groomed_at ?? scopedAppointments[0].start_at,
              weightKg: pet.weight,
            }
          : null,
      )
    : [];
  const groomingRecords = (payload.action === "result"
    ? scopedGroomingRecords.filter((record) => record.appointment_id === payload.appointmentId)
    : []
  ).map((record) => ({
    id: record.id,
    shop_id: record.shop_id,
    guardian_id: record.guardian_id,
    pet_id: record.pet_id,
    service_id: record.service_id,
    appointment_id: record.appointment_id,
    before_media_asset_id: record.before_media_asset_id ?? null,
    after_media_asset_id: record.after_media_asset_id ?? null,
    style_notes: record.style_notes,
    memo: record.memo,
    price_paid: record.price_paid,
    actual_duration_minutes: record.actual_duration_minutes ?? null,
    service_name_snapshot: record.service_name_snapshot ?? null,
    next_recommended_visit_date: record.next_recommended_visit_date ?? null,
    care_report_data: record.care_report_owner_confirmed_at ? record.care_report_data ?? null : null,
    care_report_owner_confirmed_at: record.care_report_owner_confirmed_at ?? null,
    care_report_photo_consent: record.care_report_photo_consent ?? false,
    groomed_at: record.groomed_at,
    created_at: record.created_at,
    updated_at: record.updated_at,
  }));
  let resultMediaAssets: Array<{
    id: string;
    appointmentId: string;
    groomingRecordId: string | null;
    mediaKind: "grooming_before" | "grooming_after";
  }> = [];

  if (payload.action === "result") {
    const resultAppointment = scopedAppointments.find(
      (appointment) =>
        appointment.id === payload.appointmentId &&
        appointment.guardian_id === payload.guardianId &&
        appointment.pet_id === payload.petId &&
        appointment.status === "completed",
    );
    if (!resultAppointment) {
      throw new Error("완료된 미용 결과를 찾지 못했어요.");
    }

    const resultRecord = scopedGroomingRecords.find((record) => record.appointment_id === resultAppointment.id);
    const mayShareCareReportPhotos = !(
      resultRecord?.care_report_owner_confirmed_at &&
      resultRecord.care_report_data &&
      resultRecord.care_report_photo_consent === false
    );

    if (mayShareCareReportPhotos && bootstrap.mode === "supabase" && hasSupabaseServerEnv()) {
      const admin = getSupabaseAdmin();
      if (!admin) throw new Error("미용 결과 사진을 확인할 수 없습니다.");
      const mediaResult = await admin
        .from("media_assets")
        .select("id, appointment_id, grooming_record_id, media_kind")
        .eq("shop_id", shopId)
        .eq("appointment_id", resultAppointment.id)
        .eq("pet_id", payload.petId)
        .eq("status", "ready")
        .is("deleted_at", null)
        .in("visibility", ["customer_shared", "public"])
        .in("media_kind", ["grooming_before", "grooming_after"])
        .order("created_at", { ascending: true });
      if (mediaResult.error) throw new Error(mediaResult.error.message);
      resultMediaAssets = (mediaResult.data ?? []).map((item) => ({
        id: item.id,
        appointmentId: item.appointment_id,
        groomingRecordId: item.grooming_record_id,
        mediaKind: item.media_kind as "grooming_before" | "grooming_after",
      }));
    }
  }

  return {
    guardians: [{ id: guardian.id, name: guardian.name, phone: guardian.phone }],
    pets: scopedPets,
    appointments: scopedAppointments,
    groomingRecords,
    weightHistory,
    resultMediaAssets,
    visitType: scopedAppointments.some(countsTowardVisitHistory) ? "revisit" : "first_visit",
    access: {
      appointmentId: payload.appointmentId ?? null,
      action: payload.action ?? null,
    },
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

      if (fallback.error) throw new Error(getAppointmentWriteErrorMessage(fallback.error));
      return { ...fallback.data, rejection_reason: rejection_reason ?? null } as Appointment;
    }

    throw new Error(getAppointmentWriteErrorMessage(error));
  }

  return data as Appointment;
}

export async function updateCustomerBooking(input: unknown) {
  const payload = customerBookingUpdateSchema.parse(input);
  if (payload.action === "reschedule") {
    assertCustomerBookingDate(payload.appointmentDate);
  }
  const access = verifyBookingAccessToken(payload.accessToken);
  if (
    access.shopId !== payload.shopId ||
    access.appointmentId !== payload.appointmentId ||
    (access.action !== "manage" && access.action !== "reschedule")
  ) {
    throw new Error("유효하지 않거나 만료된 예약 관리 링크입니다.");
  }
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
    guardian.id !== access.guardianId ||
    pet.id !== access.petId
  ) {
    throw new Error("예약자 정보를 확인할 수 없습니다.");
  }

  if (!canManageAppointment(appointment)) {
    throw new Error("이미 지난 예약은 변경하거나 취소할 수 없습니다.");
  }
  assertCustomerCanChangeBooking(bootstrap.shop, appointment);

  if (payload.action === "cancel") {
    const nextValues = {
      status: "cancelled" as const,
      updated_at: nowIso(),
      rejection_reason: null,
    };

    if (bootstrap.mode !== "supabase" || !hasSupabaseServerEnv()) {
      const updated = await updateMockAppointment(payload.appointmentId, (current) => ({ ...current, ...nextValues }));
      await deliverCustomerBookingNotificationSafely({
        shopId: updated.shop_id,
        appointmentId: updated.id,
        guardianId: updated.guardian_id,
        petId: updated.pet_id,
        type: "booking_cancelled",
      }, dispatchNotification);
      return updated;
    }

    const updated = await updateSupabaseAppointment(payload.appointmentId, nextValues);
    await deliverCustomerBookingNotificationSafely({
      shopId: updated.shop_id,
      appointmentId: updated.id,
      guardianId: updated.guardian_id,
      petId: updated.pet_id,
      type: "booking_cancelled",
    }, dispatchNotification);
    return updated;
  }

  if (payload.action === "update_memo") {
    const nextValues = {
      memo: payload.memo.trim(),
      updated_at: nowIso(),
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
    staffId: appointment.staff_id ?? null,
    staffMembers: bootstrap.staffMembers,
    staffScheduleOverrides: bootstrap.staffScheduleOverrides,
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

  if (bootstrap.mode !== "supabase" || !hasSupabaseServerEnv()) {
    const updated = await updateMockAppointment(payload.appointmentId, (current) => ({ ...current, ...nextValues }));
    if (updated.status === "confirmed") {
      await deliverCustomerBookingNotificationSafely({
        shopId: updated.shop_id,
        appointmentId: updated.id,
        guardianId: updated.guardian_id,
        petId: updated.pet_id,
        type: "booking_rescheduled_confirmed",
      }, dispatchNotification);
    }
    return updated;
  }

  const updated = await updateSupabaseAppointment(payload.appointmentId, nextValues);
  await deliverCustomerBookingNotificationSafely({
    shopId: updated.shop_id,
    appointmentId: updated.id,
    guardianId: updated.guardian_id,
    petId: updated.pet_id,
    type: "booking_rescheduled_confirmed",
  }, dispatchNotification);
  return updated;
}
