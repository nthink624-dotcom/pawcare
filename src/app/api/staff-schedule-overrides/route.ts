import { NextRequest } from "next/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { currentDateInTimeZone, nowIso } from "@/lib/utils";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";
import type { StaffScheduleOverride } from "@/types/domain";

const overrideStatusSchema = z.enum(["work", "off", "annual", "half"]);
const periodSchema = z.enum(["오전", "오후"]);

const upsertSchema = z.object({
  shopId: z.string().min(1).optional(),
  staffId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: overrideStatusSchema,
  startTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  period: periodSchema.nullable().optional(),
  reason: z.string().trim().optional().default(""),
});

const deleteSchema = z.object({
  shopId: z.string().min(1).optional(),
  staffId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const blockingAppointmentStatuses = ["pending", "confirmed", "in_progress", "almost_done"] as const;
const weekdayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

type StaffMemberRow = {
  id: string;
  default_days: string[] | null;
  start_time: string;
  end_time: string;
};

type ScheduleCandidate = {
  status: z.infer<typeof overrideStatusSchema>;
  start_time: string | null;
  end_time: string | null;
  period: z.infer<typeof periodSchema> | null;
} | null;

function normalizeOverride(row: StaffScheduleOverride): StaffScheduleOverride {
  return {
    ...row,
    start_time: row.start_time?.slice(0, 5) ?? null,
    end_time: row.end_time?.slice(0, 5) ?? null,
  };
}

function isEarlierTime(startTime: string | null | undefined, endTime: string | null | undefined) {
  return Boolean(startTime && endTime && startTime < endTime);
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

function appointmentFitsSchedule(params: {
  staffMember: StaffMemberRow;
  date: string;
  appointmentTime: string;
  appointmentEndAt: string;
  schedule: ScheduleCandidate;
}) {
  const appointmentStart = timeToMinutes(params.appointmentTime);
  const appointmentEnd = timeToMinutes(formatSeoulTime(params.appointmentEndAt));
  const staffStart = params.staffMember.start_time.slice(0, 5);
  const staffEnd = params.staffMember.end_time.slice(0, 5);

  if (params.schedule) {
    if (params.schedule.status === "off" || params.schedule.status === "annual") return false;
    if (params.schedule.status === "half") {
      const split = timeToMinutes("13:00");
      const availableStart = params.schedule.period === "오전" ? split : timeToMinutes(staffStart);
      const availableEnd = params.schedule.period === "오후" ? split : timeToMinutes(staffEnd);
      return appointmentStart >= availableStart && appointmentEnd <= availableEnd;
    }

    return appointmentStart >= timeToMinutes(params.schedule.start_time ?? staffStart) && appointmentEnd <= timeToMinutes(params.schedule.end_time ?? staffEnd);
  }

  if (!(params.staffMember.default_days ?? []).includes(getWeekdayKey(params.date))) {
    return false;
  }

  return appointmentStart >= timeToMinutes(staffStart) && appointmentEnd <= timeToMinutes(staffEnd);
}

async function getActiveStaffForShop(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  staffId: string,
  shopId: string,
) {
  const staffResult = await supabase
    .from("staff_members")
    .select("id,default_days,start_time,end_time")
    .eq("id", staffId)
    .eq("shop_id", shopId)
    .eq("is_active", true)
    .maybeSingle();

  if (staffResult.error) {
    throw new OwnerApiError(staffResult.error.message, 500);
  }

  if (!staffResult.data?.id) {
    throw new OwnerApiError("해당 매장의 활성 직원를 찾을 수 없습니다.", 404);
  }

  return staffResult.data as StaffMemberRow;
}

async function assertDateAppointmentsFitSchedule(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  params: {
    shopId: string;
    staffMember: StaffMemberRow;
    date: string;
    schedule: ScheduleCandidate;
  },
) {
  if (params.date < currentDateInTimeZone()) return;

  const appointmentResult = await supabase
    .from("appointments")
    .select("id, appointment_time, end_at")
    .eq("shop_id", params.shopId)
    .eq("staff_id", params.staffMember.id)
    .eq("appointment_date", params.date)
    .in("status", blockingAppointmentStatuses);

  if (appointmentResult.error) {
    throw new OwnerApiError(appointmentResult.error.message, 500);
  }

  const invalidAppointment = ((appointmentResult.data ?? []) as Array<{
    id: string;
    appointment_time: string;
    end_at: string;
  }>).find(
    (appointment) =>
      !appointmentFitsSchedule({
        staffMember: params.staffMember,
        date: params.date,
        appointmentTime: appointment.appointment_time,
        appointmentEndAt: appointment.end_at,
        schedule: params.schedule,
      }),
  );

  if (invalidAppointment) {
    throw new OwnerApiError("해당 날짜에 예정된 예약이 있어 이 근무 일정으로 변경할 수 없습니다.", 409);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = upsertSchema.parse(await request.json());
    const owner = await requireOwnerShop(request, body.shopId);
    const supabase = getSupabaseAdmin();
    if (!supabase) throw new OwnerApiError("Supabase 설정을 확인해 주세요.", 503);
    const staffMember = await getActiveStaffForShop(supabase, body.staffId, owner.shopId);

    if (body.status === "work" && !isEarlierTime(body.startTime, body.endTime)) {
      throw new OwnerApiError("근무 시작 시간은 종료 시간보다 빨라야 합니다.", 400);
    }

    const now = nowIso();
    const row = {
      id: `${owner.shopId}-${body.staffId}-${body.date}`,
      shop_id: owner.shopId,
      staff_id: body.staffId,
      work_date: body.date,
      status: body.status,
      start_time: body.status === "work" ? body.startTime ?? null : null,
      end_time: body.status === "work" ? body.endTime ?? null : null,
      period: body.status === "half" ? body.period ?? "오전" : null,
      reason: body.reason || null,
      created_at: now,
      updated_at: now,
    };

    await assertDateAppointmentsFitSchedule(supabase, {
      shopId: owner.shopId,
      staffMember,
      date: body.date,
      schedule: row,
    });

    const result = await supabase
      .from("staff_schedule_overrides")
      .upsert(row, { onConflict: "shop_id,staff_id,work_date" })
      .select("*")
      .single();

    if (result.error) throw new OwnerApiError(result.error.message, 500);

    return ownerMobileCorsJson(request, { override: normalizeOverride(result.data as StaffScheduleOverride) });
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return ownerMobileCorsJson(request, { message: error.message }, { status: error.status });
    }

    if (error instanceof z.ZodError) {
      return ownerMobileCorsJson(request, { message: "직원 일정 정보를 다시 확인해 주세요." }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "직원 일정을 저장하지 못했습니다.";
    return ownerMobileCorsJson(request, { message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = deleteSchema.parse(await request.json());
    const owner = await requireOwnerShop(request, body.shopId);
    const supabase = getSupabaseAdmin();
    if (!supabase) throw new OwnerApiError("Supabase 설정을 확인해 주세요.", 503);
    const staffMember = await getActiveStaffForShop(supabase, body.staffId, owner.shopId);

    await assertDateAppointmentsFitSchedule(supabase, {
      shopId: owner.shopId,
      staffMember,
      date: body.date,
      schedule: null,
    });

    const result = await supabase
      .from("staff_schedule_overrides")
      .delete()
      .eq("shop_id", owner.shopId)
      .eq("staff_id", body.staffId)
      .eq("work_date", body.date);

    if (result.error) throw new OwnerApiError(result.error.message, 500);

    return ownerMobileCorsJson(request, { ok: true });
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return ownerMobileCorsJson(request, { message: error.message }, { status: error.status });
    }

    if (error instanceof z.ZodError) {
      return ownerMobileCorsJson(request, { message: "직원 일정 정보를 다시 확인해 주세요." }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "직원 일정을 초기화하지 못했습니다.";
    return ownerMobileCorsJson(request, { message }, { status: 500 });
  }
}

export async function OPTIONS(request: NextRequest) {
  return ownerMobileCorsPreflight(request);
}
