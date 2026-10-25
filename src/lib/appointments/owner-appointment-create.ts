import type { Appointment } from "@/types/domain";

type GateResult<T> =
  | { accepted: true; value: T }
  | { accepted: false; value?: never };

export function createOwnerAppointmentCreateGate() {
  let inFlight = false;

  return {
    async run<T>(task: () => Promise<T>): Promise<GateResult<T>> {
      if (inFlight) return { accepted: false };
      inFlight = true;
      try {
        return { accepted: true, value: await task() };
      } finally {
        inFlight = false;
      }
    },
  };
}

export function assertOwnerAppointmentCreateReadback(value: unknown, shopId: string): Appointment {
  if (!value || typeof value !== "object") {
    throw new Error("예약 등록 결과를 확인하지 못했습니다. 다시 불러와 확인해 주세요.");
  }

  const appointment = value as Partial<Appointment>;
  if (
    typeof appointment.id !== "string" ||
    !appointment.id ||
    appointment.shop_id !== shopId ||
    appointment.status !== "confirmed" ||
    appointment.source !== "owner" ||
    typeof appointment.appointment_date !== "string" ||
    !appointment.appointment_date ||
    typeof appointment.appointment_time !== "string" ||
    !appointment.appointment_time
  ) {
    throw new Error("예약 등록 결과를 확인하지 못했습니다. 다시 불러와 확인해 주세요.");
  }

  return appointment as Appointment;
}

export function mergeOwnerAppointmentCreateReadback(
  appointments: Appointment[],
  createdAppointment: Appointment,
) {
  const next = new Map(appointments.map((appointment) => [appointment.id, appointment]));
  next.set(createdAppointment.id, createdAppointment);
  return Array.from(next.values());
}
