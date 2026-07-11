import type { OwnerShopContext } from "@/server/owner-api-auth";
import type {
  Appointment,
  BootstrapPayload,
  GroomingRecord,
  Guardian,
  Notification,
  PetStaffNote,
} from "@/types/domain";

function isStaffContext(owner: Pick<OwnerShopContext, "role" | "staffId">) {
  return owner.role === "staff" && Boolean(owner.staffId);
}

export function maskGuardianPhone(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return `****-${digits.slice(-4)}`;
}

export function sanitizeGuardianForStaff(guardian: Guardian): Guardian {
  return {
    ...guardian,
    phone: maskGuardianPhone(guardian.phone),
  };
}

function sanitizeNotificationForStaff(notification: Notification): Notification {
  return {
    ...notification,
    recipient_phone: null,
  };
}

function recordBelongsToStaffAppointment(
  record: GroomingRecord,
  staffId: string,
  assignedAppointmentIds: Set<string>,
) {
  const recordStaffId = (record as GroomingRecord & { staff_id?: string | null }).staff_id ?? null;
  return recordStaffId === staffId || Boolean(record.appointment_id && assignedAppointmentIds.has(record.appointment_id));
}

function noteBelongsToAssignedCustomer(note: PetStaffNote, assignedGuardianIds: Set<string>, assignedPetIds: Set<string>) {
  return (
    note.note_scope === "staff_shared" &&
    assignedGuardianIds.has(note.guardian_id) &&
    (!note.pet_id || assignedPetIds.has(note.pet_id))
  );
}

export function scopeBootstrapForStaff(data: BootstrapPayload, owner: Pick<OwnerShopContext, "role" | "staffId">) {
  if (!isStaffContext(owner)) {
    return data;
  }

  const staffId = owner.staffId!;
  const appointments = data.appointments.filter((appointment) => appointment.staff_id === staffId);
  const assignedAppointmentIds = new Set(appointments.map((appointment) => appointment.id));
  const assignedGuardianIds = new Set(appointments.map((appointment) => appointment.guardian_id));
  const assignedPetIds = new Set(appointments.map((appointment) => appointment.pet_id));
  const staffMembers = data.staffMembers
    .filter((staffMember) => staffMember.id === staffId)
    .map((staffMember) => ({
      ...staffMember,
      phone: "",
    }));

  return {
    ...data,
    ownerProfile: null,
    guardians: data.guardians
      .filter((guardian) => assignedGuardianIds.has(guardian.id))
      .map(sanitizeGuardianForStaff),
    deletedGuardians: [],
    pets: data.pets.filter((pet) => assignedPetIds.has(pet.id) && assignedGuardianIds.has(pet.guardian_id)),
    staffMembers,
    staffScheduleOverrides: (data.staffScheduleOverrides ?? []).filter((override) => override.staff_id === staffId),
    appointments,
    appointmentChangeEvents: (data.appointmentChangeEvents ?? []).filter((event) =>
      assignedAppointmentIds.has(event.appointment_id),
    ),
    groomingRecords: data.groomingRecords.filter((record) =>
      recordBelongsToStaffAppointment(record, staffId, assignedAppointmentIds),
    ),
    petStaffNotes: (data.petStaffNotes ?? []).filter((note) =>
      noteBelongsToAssignedCustomer(note, assignedGuardianIds, assignedPetIds),
    ),
    notifications: data.notifications
      .filter((notification) => Boolean(notification.appointment_id && assignedAppointmentIds.has(notification.appointment_id)))
      .map(sanitizeNotificationForStaff),
  } satisfies BootstrapPayload;
}

export function appointmentBelongsToStaff(appointment: Pick<Appointment, "staff_id">, owner: Pick<OwnerShopContext, "role" | "staffId">) {
  return !isStaffContext(owner) || appointment.staff_id === owner.staffId;
}
