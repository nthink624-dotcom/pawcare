import { NextRequest } from "next/server";
import { z } from "zod";

import { readAppointmentVisitWeight, saveAppointmentVisitWeight } from "@/server/appointment-visit-weight";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { assertOwnerInitialSetupComplete } from "@/server/owner-initial-setup-guard";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";

export const dynamic = "force-dynamic";

const VISIT_WEIGHT_CORS = { methods: "GET, PUT, OPTIONS" } as const;
const saveSchema = z.object({
  shopId: z.string().trim().min(1).max(120),
  appointmentId: z.string().trim().min(1).max(120),
  weightKg: z.number().finite().min(0.1).max(200),
  idempotencyKey: z.string().uuid(),
});

function errorResponse(request: NextRequest, error: unknown) {
  if (error instanceof OwnerApiError) {
    return ownerMobileCorsJson(request, { message: error.message }, { status: error.status }, VISIT_WEIGHT_CORS);
  }
  if (error instanceof z.ZodError) {
    return ownerMobileCorsJson(request, { message: "몸무게는 0.1kg부터 200kg 사이로 입력해 주세요." }, { status: 400 }, VISIT_WEIGHT_CORS);
  }
  return ownerMobileCorsJson(request, { message: "방문 몸무게를 처리하지 못했습니다. 다시 시도해 주세요." }, { status: 500 }, VISIT_WEIGHT_CORS);
}

export async function GET(request: NextRequest) {
  try {
    const shopId = request.nextUrl.searchParams.get("shopId")?.trim() ?? "";
    const appointmentId = request.nextUrl.searchParams.get("appointmentId")?.trim() ?? "";
    if (!shopId || !appointmentId) throw new OwnerApiError("매장과 예약 정보가 필요합니다.", 400);
    const owner = await requireOwnerShop(request, shopId);
    const result = await readAppointmentVisitWeight(owner, appointmentId);
    return ownerMobileCorsJson(
      request,
      result,
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
      VISIT_WEIGHT_CORS,
    );
  } catch (error) {
    return errorResponse(request, error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const input = saveSchema.parse(await request.json());
    const owner = await requireOwnerShop(request, input.shopId);
    await assertOwnerInitialSetupComplete(owner.shopId);
    const measurement = await saveAppointmentVisitWeight(owner, input);
    return ownerMobileCorsJson(request, { measurement }, undefined, VISIT_WEIGHT_CORS);
  } catch (error) {
    return errorResponse(request, error);
  }
}

export async function OPTIONS(request: NextRequest) {
  return ownerMobileCorsPreflight(request, VISIT_WEIGHT_CORS);
}
