import { reservationChipSurfaces, type ReservationChipSurface } from "@petmanager/shared/lib/reservation-chip-colors";

export function getReservationChipTone(serviceId: string | undefined, serviceTones: Record<string, ReservationChipSurface>) {
  return {
    ...(serviceId && Object.hasOwn(serviceTones, serviceId) ? serviceTones[serviceId]! : reservationChipSurfaces.neutral),
    selectedBackground: "#526174",
  };
}
