import { after, NextRequest } from "next/server";
import { z } from "zod";

import { getAppointmentWriteErrorMessage } from "@/lib/appointment-write-errors";
import { getBootstrap } from "@/server/bootstrap";
import { assertOwnerOrManager, OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";
import { assertOwnerInitialSetupComplete } from "@/server/owner-initial-setup-guard";
import { createAppointment, updateAppointmentDetails, updateAppointmentStatus } from "@/server/owner-mutations";
import { appointmentBelongsToStaff } from "@/server/staff-privacy";

const APPOINTMENTS_CORS = { methods: "POST, PATCH, OPTIONS" } as const;

function safeAppointmentWriteMessage(error: unknown, fallback: string) {
  const mapped = getAppointmentWriteErrorMessage(error instanceof Error ? error : {}, fallback);
  const rawMessage = error instanceof Error ? error.message.trim() : "";
  return rawMessage && mapped === rawMessage ? fallback : mapped;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const owner = await requireOwnerShop(request, body?.shopId);
    assertOwnerOrManager(owner);
    await assertOwnerInitialSetupComplete(owner.shopId);
    const result = await createAppointment(
      { ...body, source: "owner" },
      { deferNotifications: (task) => after(task) },
    );
    return ownerMobileCorsJson(request, result, undefined, APPOINTMENTS_CORS);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      const message = error.status >= 500
        ? "예약 등록 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요."
        : error.message;
      return ownerMobileCorsJson(request, { message }, { status: error.status }, APPOINTMENTS_CORS);
    }
    if (error instanceof z.ZodError) {
      return ownerMobileCorsJson(
        request,
        { message: "예약 등록 내용을 다시 확인해 주세요." },
        { status: 400 },
        APPOINTMENTS_CORS,
      );
    }

    const message = safeAppointmentWriteMessage(
      error,
      "예약 등록 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    );
    return ownerMobileCorsJson(request, { message }, { status: 400 }, APPOINTMENTS_CORS);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const owner = await requireOwnerShop(request);
    await assertOwnerInitialSetupComplete(owner.shopId);
    const bootstrap = await getBootstrap(owner.shopId);
    const appointment = bootstrap.appointments.find((item) => item.id === body?.appointmentId);
    if (!appointment || !appointmentBelongsToStaff(appointment, owner)) {
      return ownerMobileCorsJson(
        request,
        { message: "예약을 찾을 수 없습니다." },
        { status: 404 },
        APPOINTMENTS_CORS,
      );
    }

    if (owner.role === "staff" && typeof body?.status !== "string") {
      return ownerMobileCorsJson(
        request,
        { message: "직원 계정은 예약 상세 정보를 변경할 수 없습니다." },
        { status: 403 },
        APPOINTMENTS_CORS,
      );
    }

    if (body?.status === "completed" && appointment.status === "completed") {
      return ownerMobileCorsJson(request, appointment, undefined, APPOINTMENTS_CORS);
    }

    const result =
      typeof body?.status === "string"
        ? await updateAppointmentStatus(body, { deferNotifications: (task) => after(task) })
        : await updateAppointmentDetails({ ...body, shopId: owner.shopId });

    return ownerMobileCorsJson(request, result, undefined, APPOINTMENTS_CORS);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      const message = error.status >= 500
        ? "예약 상태를 변경하지 못했습니다. 입력한 내용은 유지되었어요. 다시 시도해 주세요."
        : error.message;
      return ownerMobileCorsJson(request, { message }, { status: error.status }, APPOINTMENTS_CORS);
    }
    if (error instanceof z.ZodError) {
      return ownerMobileCorsJson(
        request,
        { message: "예약 수정 내용을 다시 확인해 주세요." },
        { status: 400 },
        APPOINTMENTS_CORS,
      );
    }

    const message = safeAppointmentWriteMessage(
      error,
      "예약 상태를 변경하지 못했습니다. 입력한 내용은 유지되었어요. 다시 시도해 주세요.",
    );
    return ownerMobileCorsJson(request, { message }, { status: 400 }, APPOINTMENTS_CORS);
  }
}

export async function OPTIONS(request: NextRequest) {
  return ownerMobileCorsPreflight(request, APPOINTMENTS_CORS);
}
