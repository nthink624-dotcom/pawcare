export type OwnerBookingRequestedPushPayload = {
  kind: "owner_booking_requested";
  notificationId: string | null;
  shopId: string;
  appointmentId: string;
  guardianId: string | null;
  petId: string | null;
  serviceId: string | null;
  staffId: string | null;
  title: string;
  body: string;
  route: {
    tab: "Reservations";
    screen: "ReservationDetail";
    params: {
      reservationId: string;
    };
  };
};

export type BuildOwnerBookingRequestedPushPayloadInput = {
  notificationId?: string | null;
  shopId: string;
  appointmentId: string;
  guardianId?: string | null;
  petId?: string | null;
  serviceId?: string | null;
  staffId?: string | null;
  petName: string;
  guardianName: string;
  appointmentDateLabel: string;
  appointmentTime: string;
  serviceName: string;
};

export function buildOwnerBookingRequestedPushPayload(
  input: BuildOwnerBookingRequestedPushPayloadInput,
): OwnerBookingRequestedPushPayload {
  return {
    kind: "owner_booking_requested",
    notificationId: input.notificationId ?? null,
    shopId: input.shopId,
    appointmentId: input.appointmentId,
    guardianId: input.guardianId ?? null,
    petId: input.petId ?? null,
    serviceId: input.serviceId ?? null,
    staffId: input.staffId ?? null,
    title: "새 예약이 접수되었습니다.",
    body: `${input.petName} · ${input.guardianName} 보호자 / ${input.appointmentDateLabel} ${input.appointmentTime} · ${input.serviceName}`,
    route: {
      tab: "Reservations",
      screen: "ReservationDetail",
      params: {
        reservationId: input.appointmentId,
      },
    },
  };
}
