import { NextRequest } from "next/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { currentDateInTimeZone, nowIso } from "@/lib/utils";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";
import type { BootstrapStaffMember } from "@/types/domain";

const weekdaySchema = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);

const staffMemberSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  displayName: z.string().trim().default(""),
  profileImageUrl: z.string().trim().default(""),
  chipColorIndex: z.number().int().min(0).max(7).nullable().optional().default(null),
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

const blockingAppointmentStatuses = ["pending", "confirmed", "in_progress", "almost_done"] as const;
const weekdayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

type StaffMemberDbRow = {
  id: string;
  name: string;
  display_name?: string | null;
  profile_image_url?: string | null;
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

const staffMembersProfileSelect =
  "id,name,display_name,profile_image_url,chip_color_index,phone,role,title_prefix,position,default_days,start_time,end_time,regular_off,annual_remain";
const staffMembersLegacySelect = "id,name,phone,role,default_days,start_time,end_time,regular_off,annual_remain";

function isMissingStaffProfileColumnsError(error: { code?: string | null; message?: string | null } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    (error?.code === "PGRST204" || error?.code === "42703") &&
    message.includes("staff_members") &&
    (message.includes("display_name") ||
      message.includes("profile_image_url") ||
      message.includes("chip_color_index") ||
      message.includes("title_prefix") ||
      message.includes("position") ||
      message.includes("schema cache"))
  );
}

function toBootstrapStaffMember(row: z.infer<typeof staffMemberSchema>): BootstrapStaffMember {
  return {
    id: row.id,
    name: row.name,
    displayName: row.displayName,
    profileImageUrl: row.profileImageUrl,
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
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name?.trim() || row.name,
    profileImageUrl: row.profile_image_url?.trim() || "",
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
  const result = await supabase
    .from("staff_members")
    .select(staffMembersProfileSelect)
    .eq("shop_id", shopId)
    .eq("is_active", true)
    .order("sort_order")
    .order("created_at");

  if (result.error) {
    if (!isMissingStaffProfileColumnsError(result.error)) {
      throw new OwnerApiError(result.error.message, 500);
    }

    const legacyResult = await supabase
      .from("staff_members")
      .select(staffMembersLegacySelect)
      .eq("shop_id", shopId)
      .eq("is_active", true)
      .order("sort_order")
      .order("created_at");

    if (legacyResult.error) {
      throw new OwnerApiError(legacyResult.error.message, 500);
    }

    return ((legacyResult.data ?? []) as StaffMemberDbRow[]).map(toBootstrapStaffMemberFromDb);
  }

  return ((result.data ?? []) as StaffMemberDbRow[]).map(toBootstrapStaffMemberFromDb);
}

function hasDuplicateStaffIds(staffMembers: Array<z.infer<typeof staffMemberSchema>>) {
  return new Set(staffMembers.map((staffMember) => staffMember.id)).size !== staffMembers.length;
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

    if (body.staffMembers.some((staffMember) => !isEarlierTime(staffMember.startTime, staffMember.endTime))) {
      throw new OwnerApiError("직원 근무 시작 시간은 종료 시간보다 빨라야 합니다.", 400);
    }

    const owner = await requireOwnerShop(request, body.shopId);
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

    await assertFutureAppointmentsFitSchedules(supabase, owner.shopId, body.staffMembers);

    const rows = body.staffMembers.map((staffMember, index) => ({
      id: staffMember.id,
      shop_id: owner.shopId,
      name: staffMember.name,
      display_name: staffMember.displayName,
      profile_image_url: staffMember.profileImageUrl,
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
      const upsertResult = await supabase.from("staff_members").upsert(rows, { onConflict: "id" });
      if (upsertResult.error) {
        if (!isMissingStaffProfileColumnsError(upsertResult.error)) {
          throw new OwnerApiError(upsertResult.error.message, 500);
        }

        const legacyRows = rows.map(({ display_name: _displayName, profile_image_url: _profileImageUrl, chip_color_index: _chipColorIndex, title_prefix: _titlePrefix, position: _position, ...row }) => row);
        const legacyUpsertResult = await supabase.from("staff_members").upsert(legacyRows, { onConflict: "id" });
        if (legacyUpsertResult.error) {
          throw new OwnerApiError(legacyUpsertResult.error.message, 500);
        }
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
