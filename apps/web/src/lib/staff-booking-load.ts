import { getAppointmentEffectiveWindow } from "@/lib/appointment-time";
import type { Appointment, BootstrapStaffMember, Service } from "@/types/domain";

export type StaffBookingLoad = {
  staffId: string;
  bookingCount: number;
  bookedMinutes: number;
};

const excludedStatuses = new Set<Appointment["status"]>(["cancelled", "rejected", "noshow"]);

export function getStaffBookingLoads(params: {
  date: string;
  staffMembers: BootstrapStaffMember[];
  appointments: Appointment[];
  services: Service[];
}) {
  const loads = new Map<string, StaffBookingLoad>(
    params.staffMembers.map((staffMember) => [
      staffMember.id,
      { staffId: staffMember.id, bookingCount: 0, bookedMinutes: 0 },
    ]),
  );

  for (const appointment of params.appointments) {
    if (!appointment.staff_id || appointment.appointment_date !== params.date || excludedStatuses.has(appointment.status)) continue;
    const load = loads.get(appointment.staff_id);
    if (!load) continue;

    const window = getAppointmentEffectiveWindow(appointment, params.services);
    if (!window || window.date !== params.date) continue;
    load.bookingCount += 1;
    load.bookedMinutes += Math.max(0, window.endMinute - window.startMinute);
  }

  return Array.from(loads.values());
}
