import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertOwnerOrManager, requireOwnerShop, OwnerApiError } from "@/server/owner-api-auth";
import { readBookingPolicy, saveBookingPolicy } from "@/server/booking-preparation";
const headers = { "Cache-Control": "no-store" };
export async function GET(request: NextRequest) {
  try {
    const owner = await requireOwnerShop(request, request.nextUrl.searchParams.get("shopId") ?? undefined);
    assertOwnerOrManager(owner);
    return NextResponse.json(await readBookingPolicy(owner.shopId), { headers });
  } catch (e) { return failure(e); }
}
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const owner = await requireOwnerShop(request, body.shopId); assertOwnerOrManager(owner);
    const version = z.number().int().nonnegative().parse(body.version);
    return NextResponse.json(await saveBookingPolicy(owner.shopId, body.policy, version), { headers });
  } catch (e) { return failure(e); }
}
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const owner = await requireOwnerShop(request, body.shopId); assertOwnerOrManager(owner);
    const version = z.number().int().nonnegative().parse(body.version);
    const depositMode = z.enum(["off", "optional", "required"]).parse(body.depositMode);
    const current = await readBookingPolicy(owner.shopId);
    if (current.version !== version) throw new OwnerApiError("예약금 설정이 변경되었습니다. 새로 불러온 뒤 다시 선택해 주세요.", 409);
    if (current.policy.depositMode === depositMode) return NextResponse.json(current, { headers });
    return NextResponse.json(await saveBookingPolicy(owner.shopId, { ...current.policy, depositMode }, version), { headers });
  } catch (e) { return failure(e); }
}
function failure(e: unknown) {
  return NextResponse.json({ message: e instanceof OwnerApiError ? e.message : e instanceof z.ZodError ? e.issues[0]?.message : "예약 정책 처리 중 문제가 발생했습니다." }, { status: e instanceof OwnerApiError ? e.status : 400, headers });
}
