export type StaffLaneAppointment = {
  id: string;
  staff_id?: string | null;
};

export function assignAppointmentsToStaffLanes<T extends StaffLaneAppointment>(
  laneIds: readonly string[],
  appointments: readonly T[],
) {
  const uniqueLaneIds = [...new Set(laneIds.filter((laneId) => laneId !== "all"))];
  const lanes = new Map(uniqueLaneIds.map((laneId) => [laneId, [] as T[]]));

  for (const appointment of appointments) {
    const laneId = appointment.staff_id === null ? "unassigned" : appointment.staff_id;
    if (typeof laneId !== "string" || !lanes.has(laneId)) continue;
    lanes.get(laneId)?.push(appointment);
  }

  return lanes;
}
