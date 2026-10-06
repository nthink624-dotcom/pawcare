import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertOwnerOrManager, requireOwnerShop, OwnerApiError } from "@/server/owner-api-auth";
import { actOnPreparation, getPreparation, initializePreparation, listConsentArchive } from "@/server/booking-preparation";
const headers = { "Cache-Control": "no-store" };
export async function GET(request: NextRequest) {
  try {
    const owner = await requireOwnerShop(request, request.nextUrl.searchParams.get("shopId") ?? undefined); assertOwnerOrManager(owner);
    if (request.nextUrl.searchParams.get("archive") === "1") {
      const cursor = request.nextUrl.searchParams.get("cursor");
      return NextResponse.json(await listConsentArchive(owner.shopId, cursor ? z.string().uuid().parse(cursor) : undefined), { headers });
    }
    const id = z.string().uuid().parse(request.nextUrl.searchParams.get("appointmentId"));
    return NextResponse.json(await getPreparation(owner.shopId, id, true), { headers });
  } catch (e) { return failure(e); }
}
export async function POST(request: NextRequest) {
  try {
    const body = await request.json(); const owner = await requireOwnerShop(request, body.shopId); assertOwnerOrManager(owner);
    const id = z.string().uuid().parse(body.appointmentId);
    if (body.action === "initialize") return NextResponse.json(await initializePreparation(owner.shopId, id), { headers });
    return NextResponse.json(await actOnPreparation(await getPreparation(owner.shopId, id), body, { kind: "owner", userId: owner.userId }), { headers });
  } catch (e) { return failure(e); }
}
function failure(e: unknown) {
  return NextResponse.json({ message: e instanceof OwnerApiError ? e.message : "예약 관리 내용을 확인해 주세요." }, { status: e instanceof OwnerApiError ? e.status : 400, headers });
}
