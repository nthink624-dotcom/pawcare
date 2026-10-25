import { NextRequest } from "next/server";
import { z } from "zod";
import { assertOwnerOrManager, requireOwnerShop, OwnerApiError } from "@/server/owner-api-auth";
import { actOnPreparation, getPreparation, initializePreparation, listConsentArchive } from "@/server/booking-preparation";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";
const cors = { methods: "GET, POST, OPTIONS" };
export function OPTIONS(request: NextRequest) { return ownerMobileCorsPreflight(request, cors); }
const headers = { "Cache-Control": "no-store" };
export async function GET(request: NextRequest) {
  try {
    const owner = await requireOwnerShop(request, request.nextUrl.searchParams.get("shopId") ?? undefined); assertOwnerOrManager(owner);
    if (request.nextUrl.searchParams.get("archive") === "1") {
      const cursor = request.nextUrl.searchParams.get("cursor");
      return ownerMobileCorsJson(request, await listConsentArchive(owner.shopId, cursor ? z.string().uuid().parse(cursor) : undefined), { headers }, cors);
    }
    const id = z.string().uuid().parse(request.nextUrl.searchParams.get("appointmentId"));
    return ownerMobileCorsJson(request, await getPreparation(owner.shopId, id, true, request.nextUrl.searchParams.get("details") === "1"), { headers }, cors);
  } catch (e) { return failure(e, request); }
}
export async function POST(request: NextRequest) {
  try {
    const body = await request.json(); const owner = await requireOwnerShop(request, body.shopId); assertOwnerOrManager(owner);
    const id = z.string().uuid().parse(body.appointmentId);
    if (body.action === "initialize") return ownerMobileCorsJson(request, await initializePreparation(owner.shopId, id), { headers }, cors);
    return ownerMobileCorsJson(request, await actOnPreparation(await getPreparation(owner.shopId, id), body, { kind: "owner", userId: owner.userId }), { headers }, cors);
  } catch (e) { return failure(e, request); }
}
function failure(e: unknown, request: NextRequest) {
  return ownerMobileCorsJson(request, { message: e instanceof OwnerApiError ? e.message : "예약 관리 내용을 확인해 주세요." }, { status: e instanceof OwnerApiError ? e.status : 400, headers }, cors);
}
