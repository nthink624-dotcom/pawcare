import { NextRequest } from "next/server";

import { getBootstrap } from "@/server/bootstrap";
import { assertOwnerOrManager, OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { createAppointment, createGuardian, createPet } from "@/server/owner-mutations";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";
import { scopeBootstrapForStaff } from "@/server/staff-privacy";

function isDateString(value: string | null) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedShopId = searchParams.get("shopId") || undefined;
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!isDateString(from) || !isDateString(to)) {
      return ownerMobileCorsJson(request, { message: "조회할 날짜 범위가 필요합니다." }, { status: 400 });
    }

    const owner = await requireOwnerShop(request, requestedShopId);
    const data = await getBootstrap(owner.shopId, {
      allowMock: false,
      includeLanding: false,
      includeNotifications: true,
      appointmentsFrom: from ?? undefined,
      appointmentsTo: to ?? undefined,
      groomingRecordsFrom: from ?? undefined,
      groomingRecordsTo: to ?? undefined,
      groomingRecordLimit: 1000,
      notificationLimit: 200,
    });

    const scopedData = scopeBootstrapForStaff(data, owner);

    return ownerMobileCorsJson(request, {
      shopId: data.shop.id,
      from,
      to,
      appointments: scopedData.appointments,
      groomingRecords: scopedData.groomingRecords,
      notifications: scopedData.notifications,
    });
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return ownerMobileCorsJson(request, { message: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "예약 범위 데이터를 불러오지 못했습니다.";
    return ownerMobileCorsJson(request, { message }, { status: 500 });
  }
}

function getBodyString(body: Record<string, unknown>, key: string) {
  const value = body[key];
  return typeof value === "string" ? value : "";
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const owner = await requireOwnerShop(request, getBodyString(body, "shopId") || undefined);
    assertOwnerOrManager(owner);
    const shopId = owner.shopId;
    const customerMode = getBodyString(body, "customerMode");

    let guardianId = getBodyString(body, "guardianId");
    let petId = getBodyString(body, "petId");
    let guardian = null;
    let pet = null;

    if (customerMode === "new") {
      const customerName = getBodyString(body, "customerName").trim();
      const customerPhone = getBodyString(body, "customerPhone").replace(/\D/g, "");
      const petName = getBodyString(body, "petName").trim();

      if (!customerName || customerPhone.length < 10 || !petName) {
        return ownerMobileCorsJson(request, { message: "고객명, 반려동물 이름, 고객 연락처를 모두 입력해 주세요." }, { status: 400 });
      }

      guardian = await createGuardian({
        shopId,
        name: customerName,
        phone: customerPhone,
        memo: "",
      });
      pet = await createPet({
        shopId,
        guardianId: guardian.id,
        name: petName,
        breed: "미입력",
        groomingCycleWeeks: 4,
      });
      guardianId = guardian.id;
      petId = pet.id;
    }

    if (!guardianId || !petId) {
      return ownerMobileCorsJson(request, { message: "고객과 반려동물 정보를 확인해 주세요." }, { status: 400 });
    }

    const appointment = await createAppointment({
      shopId,
      guardianId,
      petId,
      serviceId: getBodyString(body, "serviceId"),
      staffId: getBodyString(body, "staffId"),
      appointmentDate: getBodyString(body, "appointmentDate"),
      appointmentTime: getBodyString(body, "appointmentTime"),
      memo: getBodyString(body, "memo"),
      source: "owner",
    });

    return ownerMobileCorsJson(request, { guardian, pet, appointment });
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return ownerMobileCorsJson(request, { message: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "예약 등록 중 문제가 발생했습니다.";
    return ownerMobileCorsJson(request, { message }, { status: 400 });
  }
}

export async function OPTIONS(request: NextRequest) {
  return ownerMobileCorsPreflight(request);
}
