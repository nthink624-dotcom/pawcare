import { reservationChipSurfaces, type ReservationChipSurface } from "@petmanager/shared/lib/reservation-chip-colors";

export type AppointmentIdentityTone = ReservationChipSurface;

export function getAppointmentIdentityTone(serviceId: string, serviceTones: Record<string, AppointmentIdentityTone>) {
  return Object.hasOwn(serviceTones, serviceId) ? serviceTones[serviceId]! : reservationChipSurfaces.neutral;
}
