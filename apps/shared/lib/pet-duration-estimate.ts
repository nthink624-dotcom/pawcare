import { resolveDurationEstimate, summarizeDurationMinutes, type DurationEstimate } from "@petmanager/shared/lib/duration-statistics";

type Appointment = { id: string; shop_id: string; pet_id: string; service_id: string; status: string; actual_started_at?: string | null; actual_completed_at?: string | null };
type Record = { id: string; shop_id: string; appointment_id: string | null; pet_id: string; service_id: string; actual_duration_minutes?: number | null; pet_weight_snapshot?: number | null };

// Read-only projection; booked and measured durations remain unchanged.
export function estimatePetServiceDuration(context: {
  appointments: Appointment[]; groomingRecords: Record[];
  service: { id: string; shop_id: string; duration_minutes: number | null };
  pet?: { id: string; shop_id: string; weight?: number | null } | null;
}): DurationEstimate {
  const { service, pet } = context;
  const appointments = new Map(context.appointments.map(item => [item.id, item]));
  const counts = new Map<string, number>();
  for (const record of context.groomingRecords) {
    if (record.appointment_id) counts.set(record.appointment_id, (counts.get(record.appointment_id) ?? 0) + 1);
  }
  const records = context.groomingRecords.filter(record => {
    const appointment = record.appointment_id ? appointments.get(record.appointment_id) : undefined;
    if (!appointment || counts.get(appointment.id) !== 1 || appointment.status !== "completed") return false;
    if (record.shop_id !== service.shop_id || appointment.shop_id !== service.shop_id || record.service_id !== service.id || appointment.service_id !== service.id || record.pet_id !== appointment.pet_id) return false;
    if (!appointment.actual_started_at || !appointment.actual_completed_at) return false;
    const start = Date.parse(appointment.actual_started_at);
    const end = Date.parse(appointment.actual_completed_at);
    const minutes = Math.round((end - start) / 60_000);
    return Number.isFinite(minutes) && end > start && minutes > 0 && minutes <= 1440 && record.actual_duration_minutes === minutes;
  });
  const petStats = summarizeDurationMinutes(records.filter(record => pet?.shop_id === service.shop_id && record.pet_id === pet.id).map(record => record.actual_duration_minutes));
  if (petStats.sampleCount > 0) {
    return { source: "pet", minutes: Math.max(5, Math.ceil((petStats.medianMinutes ?? 0) / 5) * 5), stats: petStats };
  }
  const weight = pet?.weight;
  return resolveDurationEstimate({
    baselineMinutes: service.duration_minutes,
    serviceWeightStats: summarizeDurationMinutes(records.filter(record => typeof weight === "number" && weight > 0 && typeof record.pet_weight_snapshot === "number" && record.pet_weight_snapshot > 0 && Math.round(record.pet_weight_snapshot) === Math.round(weight)).map(record => record.actual_duration_minutes)),
    serviceStats: summarizeDurationMinutes(records.map(record => record.actual_duration_minutes)),
  });
}
