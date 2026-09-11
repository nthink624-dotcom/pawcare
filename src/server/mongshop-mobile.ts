import "server-only";

import type { AppointmentStatus } from "@/types/domain";
import { getBootstrap } from "@/server/bootstrap";
import { serverEnv } from "@/lib/server-env";

export const MONGSHOP_DEVELOPMENT_SHOP_ID = "shop-950db4fa";

export type MongshopMobileBooking = {
  id: string;
  appointmentDate: string;
  appointmentTime: string;
  status: AppointmentStatus;
  guardianName: string;
  petName: string;
  serviceName: string;
  staffName: string | null;
  memo: string | null;
};

export type MongshopMobileBookingsPayload = {
  shop: {
    id: string;
    name: string;
    address: string | null;
  };
  generatedAt: string;
  bookings: MongshopMobileBooking[];
};

export class MongshopMobileEmbedError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "MongshopMobileEmbedError";
  }
}

export async function getMongshopMobileBookings(): Promise<MongshopMobileBookingsPayload> {
  // 이 경로는 개발 Supabase의 몽샵멍샵 확인용이다. 운영 데이터로 바뀌면 노출하지 않는다.
  if (serverEnv.supabaseEnvName !== "development") {
    throw new MongshopMobileEmbedError("개발 데이터 화면은 개발 환경에서만 열 수 있습니다.", 404);
  }

  const bootstrap = await getBootstrap(MONGSHOP_DEVELOPMENT_SHOP_ID);

  if (bootstrap.mode !== "supabase") {
    throw new MongshopMobileEmbedError("개발 Supabase 데이터를 불러오지 못했습니다.", 503);
  }

  const guardianNames = new Map(bootstrap.guardians.map((guardian) => [guardian.id, guardian.name]));
  const petNames = new Map(bootstrap.pets.map((pet) => [pet.id, pet.name]));
  const serviceNames = new Map(bootstrap.services.map((service) => [service.id, service.name]));
  const staffNames = new Map(
    bootstrap.staffMembers.map((staffMember) => [
      staffMember.id,
      staffMember.displayName || staffMember.name,
    ]),
  );

  return {
    shop: {
      id: bootstrap.shop.id,
      name: bootstrap.shop.name,
      address: bootstrap.shop.address,
    },
    generatedAt: new Date().toISOString(),
    bookings: bootstrap.appointments.map((appointment) => ({
      id: appointment.id,
      appointmentDate: appointment.appointment_date,
      appointmentTime: appointment.appointment_time,
      status: appointment.status,
      guardianName: guardianNames.get(appointment.guardian_id) ?? "예약자 정보 없음",
      petName: petNames.get(appointment.pet_id) ?? "반려견 정보 없음",
      serviceName: serviceNames.get(appointment.service_id) ?? "서비스 정보 없음",
      staffName: appointment.staff_id ? (staffNames.get(appointment.staff_id) ?? null) : null,
      memo: appointment.memo,
    })),
  };
}
