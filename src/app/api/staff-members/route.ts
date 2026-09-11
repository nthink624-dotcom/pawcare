import { NextRequest } from "next/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getStaffProfileMessage } from "@/lib/staff-display";
import { staffChipColorIndexMax } from "@/lib/staff-chip-colors";
import { isStaffProfileFallbackKey } from "@/lib/staff-profile-fallback";
import { currentDateInTimeZone, nowIso } from "@/lib/utils";
import { assertOwnerOrManager, OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";
import {
  buildCompatibleStaffProfileSelect,
  getNextStaffProfileOptionalColumn,
  isMissingRequiredStaffPreferenceColumn,
  omitStaffProfileColumns,
  staffProfileOptionalColumns,
} from "@/server/staff-profile-column-compat";
import type { BootstrapStaffMember } from "@/types/domain";

const weekdaySchema = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);

const staffMemberSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  displayName: z.string().trim().default(""),
  profileImageUrl: z.string().trim().default(""),
  profileImageUrls: z.array(z.string().trim()).max(3).default([]),
  profileImageAssetIds: z.array(z.string().trim()).max(3).default([]),
  profileImageFallbackKey: z.string().trim().nullable().optional().default(null),
  profileMessage: z.string().trim().max(160).default(""),
  chipColorIndex: z.number().int().min(0).max(staffChipColorIndexMax).nullable().optional().default(null),
  phone: z.string().trim().default(""),
  role: z.string().trim().optional().transform((value) => value || "직원"),
  titlePrefix: z.string().trim().default(""),
  position: z.string().trim().optional().transform((value) => value || "직원"),
  defaultDays: z.array(weekdaySchema).default(["mon", "tue", "wed", "thu", "fri", "sat"]),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  regularOff: z.string().trim().default("일"),
  annualRemain: z.coerce.number().int().min(0).default(0),
  todayBookings: z.coerce.number().int().min(0).default(0),
  weekBookings: z.coerce.number().int().min(0).default(0),
});

const payloadSchema = z.object({
  shopId: z.string().min(1),
  staffMembers: z.array(staffMemberSchema).min(1),
});

const deletePayloadSchema = z.object({
  shopId: z.string().min(1),
  staffId: z.string().min(1),
});

const blockingAppointmentStatuses = ["confirmed", "in_progress", "almost_done"] as const;
const weekdayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

type StaffMemberDbRow = {
  id: string;
  name: string;
  display_name?: string | null;
  profile_image_url?: string | null;
  profile_image_urls?: unknown;
  profile_image_asset_ids?: unknown;
  profile_image_fallback_key?: string | null;
  profile_message?: string | null;
  chip_color_index?: number | null;
  phone: string | null;
  role: string;
  title_prefix?: string | null;
  position?: string | null;
  default_days: string[] | null;
  start_time: string;
  end_time: string;
  regular_off: string | null;
  annual_remain: number | null;
};

const staffMembersProfileSelectFields = [
  "id", "name", "display_name", "profile_image_url", "profile_image_urls", "profile_image_asset_ids", "profile_image_fallback_key",
  "profile_message", "chip_color_index", "phone", "role", "title_prefix",
  "position", "default_days", "start_time", "end_time", "regular_off", "annual_remain",
] as const;

const staffProfileCompatibilityError = "직원 프로필 멘트 또는 개인 칩 색을 저장할 수 없습니다. 매장 데이터 업데이트를 확인한 뒤 다시 시도해 주세요.";
const staffChipColorSaveError = "선택한 개인 칩 색을 저장하지 못했습니다. 다시 선택해 저장해 주세요.";

function isStaffChipColorIndexConstraintError(error: { code?: string | null; message?: string | null } | null | undefined) {
  return error?.code === "23514" && (error.message ?? "").includes("staff_members_chip_color_index_check");
}

function normalizeProfileImageUrls(value: unknown, fallback = "") {
  const urls = Array.isArray(value) ? value : [];
  const normalized = urls
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);
  const fallbackUrl = fallback.trim();
  return normalized.length > 0 ? normalized : fallbackUrl ? [fallbackUrl] : [];
}

function normalizeProfileImageAssetIds(value: unknown) {
  return (Array.isArray(value) ? value : [])
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function hasUploadedProfilePhoto(staffMember: z.infer<typeof staffMemberSchema>) {
  return normalizeProfileImageUrls(staffMember.profileImageUrls, staffMember.profileImageUrl).length > 0
    || normalizeProfileImageAssetIds(staffMember.profileImageAssetIds).length > 0;
}

const staffProfileImageChoiceRequiredError = "프로필 사진을 올리거나 기본 프로필 이미지를 선택해 주세요.";

function toBootstrapStaffMember(row: z.infer<typeof staffMemberSchema>): BootstrapStaffMember {
  return {
    ...(() => {
      const profileImageUrls = normalizeProfileImageUrls(row.profileImageUrls, row.profileImageUrl);
      return {
        profileImageUrl: profileImageUrls[0] ?? "",
        profileImageUrls,
        profileImageAssetIds: normalizeProfileImageAssetIds(row.profileImageAssetIds),
        profileImageFallbackKey: isStaffProfileFallbackKey(row.profileImageFallbackKey) ? row.profileImageFallbackKey : null,
      };
    })(),
    id: row.id,
    name: row.name,
    displayName: row.displayName,
    profileMessage: getStaffProfileMessage(row),
    chipColorIndex: row.chipColorIndex,
    phone: row.phone,
    role: row.role,
    titlePrefix: row.titlePrefix,
    position: row.position,
    defaultDays: row.defaultDays,
    startTime: row.startTime,
    endTime: row.endTime,
    regularOff: row.regularOff,
    annualRemain: row.annualRemain,
    todayBookings: row.todayBookings,
    weekBookings: row.weekBookings,
  };
}

function toBootstrapStaffMemberFromDb(row: StaffMemberDbRow): BootstrapStaffMember {
  const profileImageUrls = normalizeProfileImageUrls(row.profile_image_urls, row.profile_image_url ?? "");
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name?.trim() || row.name,
    profileImageUrl: profileImageUrls[0] ?? "",
    profileImageUrls,
    profileImageAssetIds: normalizeProfileImageAssetIds(row.profile_image_asset_ids),
    profileImageFallbackKey: isStaffProfileFallbackKey(row.profile_image_fallback_key) ? row.profile_image_fallback_key : null,
    profileMessage: getStaffProfileMessage(row),
    chipColorIndex: row.chip_color_index ?? null,
    phone: row.phone ?? "",
    role: row.role,
    titlePrefix: row.title_prefix?.trim() || "",
    position: row.position?.trim() || row.role.split(/[/.|]/)[0]?.trim() || "직원",
    defaultDays: (row.default_days ?? ["mon", "tue", "wed", "thu", "fri", "sat"]) as BootstrapStaffMember["defaultDays"],
    startTime: row.start_time.slice(0, 5),
    endTime: row.end_time.slice(0, 5),
    regularOff: row.regular_off ?? "일",
    annualRemain: row.annual_remain ?? 0,
    todayBookings: 0,
    weekBookings: 0,
  };
}

async function loadActiveStaffMembers(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  shopId: string,
) {
  const omittedColumns = new Set<string>();
  for (let attempt = 0; attempt <= staffProfileOptionalColumns.length; attempt += 1) {
    const result = await supabase
      .from("staff_members")
      .select(buildCompatibleStaffProfileSelect(staffMembersProfileSelectFields, omittedColumns))
      .eq("shop_id", shopId)
      .eq("is_active", true)
      .order("sort_order")
      .order("created_at");

    if (!result.error) {
      return ((result.data ?? []) as unknown as StaffMemberDbRow[]).map(toBootstrapStaffMemberFromDb);
    }

    if (isMissingRequiredStaffPreferenceColumn(result.error)) {
      throw new OwnerApiError(staffProfileCompatibilityError, 409);
    }
    const missingOptionalColumn = getNextStaffProfileOptionalColumn(result.error, omittedColumns);
    if (!missingOptionalColumn) {
      throw new OwnerApiError(result.error.message, 500);
    }
    omittedColumns.add(missingOptionalColumn);
  }
  throw new OwnerApiError(staffProfileCompatibilityError, 409);
}

function hasDuplicateStaffIds(staffMembers: Array<z.infer<typeof staffMemberSchema>>) {
  return new Set(staffMembers.map((staffMember) => staffMember.id)).size !== staffMembers.length;
}

const staffChipColorConflictError = "이미 다른 직원이 사용 중인 개인 칩 색입니다. 다른 색을 선택해 저장해 주세요.";

type ActiveStaffChipColorRow = {
  id: string;
  chip_color_index: number | null;
};

function introducesDuplicateStaffChipColor(
  staffMembers: Array<z.infer<typeof staffMemberSchema>>,
  activeStaffMembers: ActiveStaffChipColorRow[],
) {
  const currentChipColorByStaffId = new Map(activeStaffMembers.map((staffMember) => [staffMember.id, staffMember.chip_color_index]));
  const desiredChipColorByStaffId = new Map(currentChipColorByStaffId);
  for (const staffMember of staffMembers) desiredChipColorByStaffId.set(staffMember.id, staffMember.chipColorIndex);

  const staffIdsByChipColor = new Map<number, string[]>();
  for (const [staffId, chipColorIndex] of desiredChipColorByStaffId) {
    if (chipColorIndex === null) continue;
    const staffIds = staffIdsByChipColor.get(chipColorIndex) ?? [];
    staffIds.push(staffId);
    staffIdsByChipColor.set(chipColorIndex, staffIds);
  }

  for (const [chipColorIndex, staffIds] of staffIdsByChipColor) {
    if (staffIds.length < 2) continue;
    const preservesLegacyCollision = staffIds.every((staffId) => currentChipColorByStaffId.get(staffId) === chipColorIndex);
    if (!preservesLegacyCollision) return true;
  }
  return false;
}

function isEarlierTime(startTime: string, endTime: string) {
  return startTime < endTime;
}

function timeToMinutes(value: string) {
  const [hour = "0", minute = "0"] = value.slice(0, 5).split(":");
  return Number(hour) * 60 + Number(minute);
}

function getWeekdayKey(date: string) {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  return weekdayKeys[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

function formatSeoulTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function appointmentFitsStaffSchedule(params: {
  staffMember: z.infer<typeof staffMemberSchema>;
  appointmentDate: string;
  appointmentTime: string;
  appointmentEndAt: string;
  override?: {
    status: "work" | "off" | "annual" | "half";
    start_time: string | null;
    end_time: string | null;
    period: "오전" | "오후" | null;
  };
}) {
  const appointmentStart = timeToMinutes(params.appointmentTime);
  const appointmentEnd = timeToMinutes(formatSeoulTime(params.appointmentEndAt));
  const override = params.override;

  if (override) {
    if (override.status === "off" || override.status === "annual") return false;
    if (override.status === "half") {
      const split = timeToMinutes("13:00");
      const availableStart = override.period === "오전" ? split : timeToMinutes(params.staffMember.startTime);
      const availableEnd = override.period === "오후" ? split : timeToMinutes(params.staffMember.endTime);
      return appointmentStart >= availableStart && appointmentEnd <= availableEnd;
    }
    if (override.status === "work") {
      return (
        appointmentStart >= timeToMinutes(override.start_time ?? params.staffMember.startTime) &&
        appointmentEnd <= timeToMinutes(override.end_time ?? params.staffMember.endTime)
      );
    }
  }

  if (!params.staffMember.defaultDays.includes(getWeekdayKey(params.appointmentDate))) {
    return false;
  }

  return appointmentStart >= timeToMinutes(params.staffMember.startTime) && appointmentEnd <= timeToMinutes(params.staffMember.endTime);
}

async function assertFutureAppointmentsFitSchedules(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  shopId: string,
  staffMembers: Array<z.infer<typeof staffMemberSchema>>,
) {
  const staffIds = staffMembers.map((staffMember) => staffMember.id);
  if (staffIds.length === 0) return;

  const appointmentResult = await supabase
    .from("appointments")
    .select("id, staff_id, appointment_date, appointment_time, end_at")
    .eq("shop_id", shopId)
    .in("staff_id", staffIds)
    .gte("appointment_date", currentDateInTimeZone())
    .in("status", blockingAppointmentStatuses);

  if (appointmentResult.error) {
    throw new OwnerApiError(appointmentResult.error.message, 500);
  }

  const appointments = (appointmentResult.data ?? []) as Array<{
    id: string;
    staff_id: string | null;
    appointment_date: string;
    appointment_time: string;
    end_at: string;
  }>;
  if (appointments.length === 0) return;

  const dates = Array.from(new Set(appointments.map((appointment) => appointment.appointment_date)));
  const overrideResult = await supabase
    .from("staff_schedule_overrides")
    .select("staff_id, work_date, status, start_time, end_time, period")
    .eq("shop_id", shopId)
    .in("staff_id", staffIds)
    .in("work_date", dates);

  if (overrideResult.error) {
    throw new OwnerApiError(overrideResult.error.message, 500);
  }

  const staffById = new Map(staffMembers.map((staffMember) => [staffMember.id, staffMember]));
  const overrideByStaffDate = new Map(
    ((overrideResult.data ?? []) as Array<{
      staff_id: string;
      work_date: string;
      status: "work" | "off" | "annual" | "half";
      start_time: string | null;
      end_time: string | null;
      period: "오전" | "오후" | null;
    }>).map((override) => [`${override.staff_id}:${override.work_date}`, override]),
  );

  const invalidAppointment = appointments.find((appointment) => {
    if (!appointment.staff_id) return false;
    const staffMember = staffById.get(appointment.staff_id);
    if (!staffMember) return false;
    return !appointmentFitsStaffSchedule({
      staffMember,
      appointmentDate: appointment.appointment_date,
      appointmentTime: appointment.appointment_time,
      appointmentEndAt: appointment.end_at,
      override: overrideByStaffDate.get(`${appointment.staff_id}:${appointment.appointment_date}`),
    });
  });

  if (invalidAppointment) {
    throw new OwnerApiError("예정된 예약이 새 근무시간 밖으로 벗어납니다. 예약을 먼저 옮겨 주세요.", 409);
  }
}

async function assertStaffCanBeDeactivated(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  shopId: string,
  staffId: string,
) {
  const staffResult = await supabase
    .from("staff_members")
    .select("id, is_active")
    .eq("shop_id", shopId)
    .eq("id", staffId)
    .maybeSingle();

  if (staffResult.error) {
    throw new OwnerApiError(staffResult.error.message, 500);
  }

  if (!staffResult.data?.id) {
    throw new OwnerApiError("해당 매장의 직원를 찾을 수 없습니다.", 404);
  }

  const activeStaffResult = await supabase
    .from("staff_members")
    .select("id")
    .eq("shop_id", shopId)
    .eq("is_active", true);

  if (activeStaffResult.error) {
    throw new OwnerApiError(activeStaffResult.error.message, 500);
  }

  if (staffResult.data.is_active && (activeStaffResult.data ?? []).length <= 1) {
    throw new OwnerApiError("최소 1명의 활성 직원는 남아 있어야 합니다.", 400);
  }

  const appointmentResult = await supabase
    .from("appointments")
    .select("id")
    .eq("shop_id", shopId)
    .eq("staff_id", staffId)
    .gte("appointment_date", currentDateInTimeZone())
    .in("status", blockingAppointmentStatuses)
    .limit(1);

  if (appointmentResult.error) {
    throw new OwnerApiError(appointmentResult.error.message, 500);
  }

  if ((appointmentResult.data ?? []).length > 0) {
    throw new OwnerApiError("예정된 활성 예약이 있는 직원는 비활성화할 수 없습니다.", 409);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = payloadSchema.parse(await request.json());
    if (hasDuplicateStaffIds(body.staffMembers)) {
      throw new OwnerApiError("중복된 직원 정보가 있습니다.", 400);
    }

    if (body.staffMembers.some((staffMember) => !hasUploadedProfilePhoto(staffMember) && !isStaffProfileFallbackKey(staffMember.profileImageFallbackKey))) {
      throw new OwnerApiError(staffProfileImageChoiceRequiredError, 400);
    }

    if (body.staffMembers.some((staffMember) => !isEarlierTime(staffMember.startTime, staffMember.endTime))) {
      throw new OwnerApiError("직원 근무 시작 시간은 종료 시간보다 빨라야 합니다.", 400);
    }

    const owner = await requireOwnerShop(request, body.shopId);
    assertOwnerOrManager(owner);
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      throw new OwnerApiError("Supabase 설정을 확인해 주세요.", 503);
    }

    const now = nowIso();
    const staffIds = body.staffMembers.map((staffMember) => staffMember.id);
    if (staffIds.length > 0) {
      const existingResult = await supabase.from("staff_members").select("id, shop_id, is_active").in("id", staffIds);
      if (existingResult.error) {
        throw new OwnerApiError(existingResult.error.message, 500);
      }

      const foreignStaff = (existingResult.data ?? []).find((staffMember) => staffMember.shop_id !== owner.shopId);
      if (foreignStaff) {
        throw new OwnerApiError("다른 매장의 직원 정보는 수정할 수 없습니다.", 403);
      }

      const inactiveStaff = (existingResult.data ?? []).find((staffMember) => !staffMember.is_active);
      if (inactiveStaff) {
        throw new OwnerApiError("비활성화된 직원는 목록 저장으로 다시 활성화할 수 없습니다.", 409);
      }
    }

    const activeStaffChipColorResult = await supabase
      .from("staff_members")
      .select("id, chip_color_index")
      .eq("shop_id", owner.shopId)
      .eq("is_active", true);
    if (activeStaffChipColorResult.error) {
      throw new OwnerApiError(activeStaffChipColorResult.error.message, 500);
    }
    if (introducesDuplicateStaffChipColor(
      body.staffMembers,
      (activeStaffChipColorResult.data ?? []) as ActiveStaffChipColorRow[],
    )) {
      throw new OwnerApiError(staffChipColorConflictError, 409);
    }

    await assertFutureAppointmentsFitSchedules(supabase, owner.shopId, body.staffMembers);

    const rows = body.staffMembers.map((staffMember, index) => ({
      id: staffMember.id,
      shop_id: owner.shopId,
      name: staffMember.name,
      display_name: staffMember.displayName,
      profile_image_url: normalizeProfileImageUrls(staffMember.profileImageUrls, staffMember.profileImageUrl)[0] ?? "",
      profile_image_urls: normalizeProfileImageUrls(staffMember.profileImageUrls, staffMember.profileImageUrl),
      profile_image_asset_ids: normalizeProfileImageAssetIds(staffMember.profileImageAssetIds),
      profile_image_fallback_key: staffMember.profileImageFallbackKey,
      profile_message: staffMember.profileMessage,
      chip_color_index: staffMember.chipColorIndex,
      phone: staffMember.phone,
      role: staffMember.role,
      title_prefix: staffMember.titlePrefix,
      position: staffMember.position,
      default_days: staffMember.defaultDays,
      start_time: staffMember.startTime,
      end_time: staffMember.endTime,
      regular_off: staffMember.regularOff,
      annual_remain: staffMember.annualRemain,
      is_active: true,
      sort_order: index + 1,
      updated_at: now,
    }));

    if (rows.length > 0) {
      const omittedColumns = new Set<string>();
      let saved = false;
      for (let attempt = 0; attempt <= staffProfileOptionalColumns.length; attempt += 1) {
        const compatibleRows = rows.map((row) => omitStaffProfileColumns(row, omittedColumns));
        const upsertResult = await supabase.from("staff_members").upsert(compatibleRows, { onConflict: "id" });
        if (!upsertResult.error) {
          saved = true;
          break;
        }
        if (isMissingRequiredStaffPreferenceColumn(upsertResult.error)) {
          throw new OwnerApiError(staffProfileCompatibilityError, 409);
        }
        if (isStaffChipColorIndexConstraintError(upsertResult.error)) {
          throw new OwnerApiError(staffChipColorSaveError, 409);
        }
        const missingOptionalColumn = getNextStaffProfileOptionalColumn(upsertResult.error, omittedColumns);
        if (!missingOptionalColumn) {
          throw new OwnerApiError(upsertResult.error.message, 500);
        }
        omittedColumns.add(missingOptionalColumn);
      }
      if (!saved) {
        throw new OwnerApiError(staffProfileCompatibilityError, 409);
      }
    }

    const staffMembers = await loadActiveStaffMembers(supabase, owner.shopId);

    return ownerMobileCorsJson(request, {
      staffMembers: staffMembers.length > 0 ? staffMembers : body.staffMembers.map(toBootstrapStaffMember),
    });
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return ownerMobileCorsJson(request, { message: error.message }, { status: error.status });
    }

    if (error instanceof z.ZodError) {
      return ownerMobileCorsJson(request, { message: "직원 정보를 다시 확인해 주세요." }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "직원 정보를 저장하지 못했습니다.";
    return ownerMobileCorsJson(request, { message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = deletePayloadSchema.parse(await request.json());
    const owner = await requireOwnerShop(request, body.shopId);
    assertOwnerOrManager(owner);
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      throw new OwnerApiError("Supabase 설정을 확인해 주세요.", 503);
    }

    await assertStaffCanBeDeactivated(supabase, owner.shopId, body.staffId);

    const updateResult = await supabase
      .from("staff_members")
      .update({ is_active: false, updated_at: nowIso() })
      .eq("shop_id", owner.shopId)
      .eq("id", body.staffId);

    if (updateResult.error) {
      throw new OwnerApiError(updateResult.error.message, 500);
    }

    return ownerMobileCorsJson(request, { ok: true });
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return ownerMobileCorsJson(request, { message: error.message }, { status: error.status });
    }

    if (error instanceof z.ZodError) {
      return ownerMobileCorsJson(request, { message: "직원 삭제 요청을 다시 확인해 주세요." }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "직원를 삭제하지 못했습니다.";
    return ownerMobileCorsJson(request, { message }, { status: 500 });
  }
}

export async function OPTIONS(request: NextRequest) {
  return ownerMobileCorsPreflight(request);
}
