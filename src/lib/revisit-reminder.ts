import type { AppointmentStatus } from "@/types/domain";

export const REBOOKING_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "confirmed",
  "in_progress",
  "almost_done",
  "completed",
];

type RebookingCandidate = {
  pet_id: string;
  start_at: string;
  status: AppointmentStatus;
};

export function hasLaterRebooking(
  groomingRecord: { pet_id: string; groomed_at: string },
  appointments: RebookingCandidate[],
) {
  const groomedAt = new Date(groomingRecord.groomed_at).getTime();
  if (!Number.isFinite(groomedAt)) return false;

  return appointments.some((appointment) => (
    appointment.pet_id === groomingRecord.pet_id &&
    REBOOKING_APPOINTMENT_STATUSES.includes(appointment.status) &&
    new Date(appointment.start_at).getTime() > groomedAt
  ));
}
