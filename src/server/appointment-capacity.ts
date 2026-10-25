import type { SupabaseClient } from "@supabase/supabase-js";

import type { Appointment } from "@/types/domain";

type SupabaseWriteError = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

type SupabaseAppointmentClient = Pick<SupabaseClient, "from">;

type AppointmentScheduleWrite = Pick<
  Appointment,
  | "service_id"
  | "appointment_date"
  | "appointment_time"
  | "memo"
  | "status"
  | "rejection_reason"
  | "start_at"
  | "end_at"
  | "updated_at"
> &
  Partial<
    Pick<
      Appointment,
      | "staff_id"
      | "staff_memo"
      | "visit_reminder_offset_minutes"
      | "pickup_ready_eta_minutes"
    >
  >;

const STAFF_OVERLAP_ERROR = "appointment overlaps another active appointment for the same staff member";

export function mapAppointmentWriteError(error: SupabaseWriteError) {
  const detail = [error.message, error.details, error.hint].filter(Boolean).join(" ").toLowerCase();

  if (error.code === "23P01" || detail.includes(STAFF_OVERLAP_ERROR)) {
    return new Error("선택한 담당자에게 같은 시간 예약이 있습니다.");
  }

  if (error.code === "22007" || detail.includes("appointment time window is invalid")) {
    return new Error("예약 시간 정보를 확인해 주세요.");
  }

  return new Error(error.message?.trim() || "예약을 저장하지 못했습니다.");
}

export async function createAppointmentWithDatabaseGuard(
  supabase: SupabaseAppointmentClient,
  appointment: Appointment,
): Promise<Appointment> {
  const { data, error } = (await supabase
    .from("appointments")
    .insert(appointment)
    .select("*")
    .single()) as { data: unknown; error: SupabaseWriteError | null };

  if (error) {
    throw mapAppointmentWriteError(error);
  }

  return data as Appointment;
}

export async function updateAppointmentWithDatabaseGuard(
  supabase: SupabaseAppointmentClient,
  appointmentId: string,
  values: AppointmentScheduleWrite,
): Promise<Appointment> {
  const { data, error } = (await supabase
    .from("appointments")
    .update(values)
    .eq("id", appointmentId)
    .select("*")
    .single()) as { data: unknown; error: SupabaseWriteError | null };

  if (error) {
    throw mapAppointmentWriteError(error);
  }

  return data as Appointment;
}
