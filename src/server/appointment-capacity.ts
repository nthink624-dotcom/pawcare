import type { SupabaseClient } from "@supabase/supabase-js";

import type { Appointment } from "@/types/domain";

type SupabaseRpcError = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

type SupabaseRpcClient = Pick<SupabaseClient, "rpc">;

function mapCapacityError(error: SupabaseRpcError) {
  const message = [error.message, error.details, error.hint].filter(Boolean).join(" ");

  if (message.includes("APPOINTMENT_SLOT_UNAVAILABLE")) {
    return new Error("선택한 시간에는 예약할 수 없습니다.");
  }

  if (message.includes("APPOINTMENT_NOT_FOUND")) {
    return new Error("예약 정보를 찾을 수 없습니다.");
  }

  if (message.includes("SHOP_NOT_FOUND")) {
    return new Error("매장 정보를 찾을 수 없습니다.");
  }

  if (error.code === "PGRST202" || message.toLowerCase().includes("could not find the function")) {
    return new Error("예약 동시성 보호 마이그레이션이 적용되지 않았습니다.");
  }

  return new Error(error.message || "예약 가능 시간을 확정하지 못했습니다.");
}

function appointmentRpcArgs(appointment: Appointment) {
  return {
    p_id: appointment.id,
    p_shop_id: appointment.shop_id,
    p_guardian_id: appointment.guardian_id,
    p_pet_id: appointment.pet_id,
    p_service_id: appointment.service_id,
    p_appointment_date: appointment.appointment_date,
    p_appointment_time: appointment.appointment_time,
    p_status: appointment.status,
    p_memo: appointment.memo,
    p_rejection_reason: appointment.rejection_reason,
    p_start_at: appointment.start_at,
    p_end_at: appointment.end_at,
    p_source: appointment.source,
    p_created_at: appointment.created_at,
    p_updated_at: appointment.updated_at,
  };
}

export async function createAppointmentWithCapacityLock(
  supabase: SupabaseRpcClient,
  appointment: Appointment,
): Promise<Appointment> {
  const { data, error } = (await supabase.rpc(
    "create_appointment_with_capacity_lock",
    appointmentRpcArgs(appointment),
  )) as { data: unknown; error: SupabaseRpcError | null };

  if (error) {
    throw mapCapacityError(error);
  }

  return data as Appointment;
}

export async function updateAppointmentWithCapacityLock(
  supabase: SupabaseRpcClient,
  appointmentId: string,
  values: Pick<
    Appointment,
    "service_id" | "appointment_date" | "appointment_time" | "memo" | "status" | "rejection_reason" | "start_at" | "end_at" | "updated_at"
  >,
): Promise<Appointment> {
  const { data, error } = (await supabase.rpc("update_appointment_with_capacity_lock", {
    p_appointment_id: appointmentId,
    p_service_id: values.service_id,
    p_appointment_date: values.appointment_date,
    p_appointment_time: values.appointment_time,
    p_memo: values.memo,
    p_status: values.status,
    p_rejection_reason: values.rejection_reason,
    p_start_at: values.start_at,
    p_end_at: values.end_at,
    p_updated_at: values.updated_at,
  })) as { data: unknown; error: SupabaseRpcError | null };

  if (error) {
    throw mapCapacityError(error);
  }

  return data as Appointment;
}
