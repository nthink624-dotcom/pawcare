import type { NextRequest } from "next/server";

import { ALIMTALK_NOTIFICATION_REGISTRY } from "@/lib/notification-registry";
import { getApprovedSsodaaNotificationTemplates } from "@/server/alimtalk-approved-template";
import { buildBookingEntryUrl, buildBookingManageUrl } from "@/server/booking-access-token";
import { getBootstrap } from "@/server/bootstrap";
import { buildNotificationTemplateValues } from "@/server/notification-dispatch";
import { assertOwnerOrManager, OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import type { Appointment } from "@/types/domain";

function selectRepresentativeAppointment(appointments: Appointment[]) {
  const usable = appointments.filter(
    (appointment) => appointment.status !== "cancelled" && appointment.status !== "rejected",
  );
  const now = Date.now();
  const upcoming = usable
    .filter((appointment) => new Date(appointment.start_at).getTime() >= now)
    .sort(
      (first, second) =>
        new Date(first.start_at).getTime() - new Date(second.start_at).getTime(),
    );
  if (upcoming[0]) return upcoming[0];

  return usable
    .slice()
    .sort(
      (first, second) =>
        new Date(second.start_at).getTime() - new Date(first.start_at).getTime(),
    )[0] ?? null;
}

function buildDirectionsUrl(shopName: string, shopAddress: string | null | undefined) {
  const query = [shopName, shopAddress?.trim()].filter(Boolean).join(" ");
  return query
    ? `https://map.kakao.com/link/search/${encodeURIComponent(query)}`
    : null;
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const owner = await requireOwnerShop(
      request,
      url.searchParams.get("shopId") || undefined,
    );
    assertOwnerOrManager(owner);

    const bootstrap = await getBootstrap(owner.shopId);
    const appointment = selectRepresentativeAppointment(bootstrap.appointments);
    const pet = appointment
      ? bootstrap.pets.find((item) => item.id === appointment.pet_id) ?? null
      : bootstrap.pets[0] ?? null;
    const guardian = appointment
      ? bootstrap.guardians.find((item) => item.id === appointment.guardian_id) ?? null
      : bootstrap.guardians[0] ?? null;
    const service = appointment
      ? bootstrap.services.find((item) => item.id === appointment.service_id) ?? null
      : bootstrap.services[0] ?? null;
    const previewToken = "preview";
    const bookingEntryUrl = buildBookingEntryUrl(owner.shopId);
    const bookingManageUrl = buildBookingManageUrl(owner.shopId, previewToken);
    const values = buildNotificationTemplateValues({
      appointment,
      bookingAccessToken: previewToken,
      bookingEntryUrl,
      bookingManageUrl,
      directionsUrl: buildDirectionsUrl(bootstrap.shop.name, bootstrap.shop.address),
      petName: pet?.name ?? "반려동물",
      recipientName: guardian?.name ?? "보호자",
      serviceName: service?.name ?? "예약 서비스",
      shopAddress: bootstrap.shop.address ?? null,
      shopName: bootstrap.shop.name,
    });
    if (!values.예약일시) values.예약일시 = "예약 일시";
    const types = ALIMTALK_NOTIFICATION_REGISTRY.map((item) => item.type);
    const templates = await getApprovedSsodaaNotificationTemplates(types, values);

    return Response.json({
      shopId: owner.shopId,
      shopName: bootstrap.shop.name,
      sample: {
        appointmentId: appointment?.id ?? null,
        petName: pet?.name ?? null,
        guardianName: guardian?.name ?? null,
        serviceName: service?.name ?? null,
      },
      templates: templates
        .filter((template) => Boolean(template))
        .map((template) => {
          const registryItem = ALIMTALK_NOTIFICATION_REGISTRY.find(
            (item) => item.type === template?.type,
          );
          return {
            type: template?.type,
            title: registryItem?.title ?? template?.type,
            templateCode: template?.templateCode ?? null,
            templateName: template?.templateName ?? null,
            body: template?.body ?? "",
            buttons:
              template?.buttons?.map((button) => ({ name: button.name })) ?? [],
            inspectionStatus: template?.inspectionStatus ?? null,
            serviceStatus: template?.serviceStatus ?? null,
            source: template?.source ?? "draft",
          };
        }),
    });
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return Response.json({ message: error.message }, { status: error.status });
    }

    const message =
      error instanceof Error
        ? error.message
        : "쏘다 승인 알림톡 내용을 불러오지 못했습니다.";
    return Response.json({ message }, { status: 503 });
  }
}
