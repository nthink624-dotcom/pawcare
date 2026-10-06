import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { actOnPreparation, authorizePreparationToken } from "@/server/booking-preparation";
import { OwnerApiError } from "@/server/owner-api-auth";
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
function customerView(result: Awaited<ReturnType<typeof authorizePreparationToken>>) {
  // Internal notes, processor identifiers and dispatch history are owner-only.
  return { ...result, data: { ...result.data, consents: result.data.consents.map(({ waivedReason: _private, ...doc }) => doc), policy: { ...result.data.policy, templates: [] }, history: [], requests: [], deposit: { ...result.data.deposit, confirmedBy: null } } };
}
export async function GET(request: NextRequest) {
  try {
    const id = z.string().uuid().parse(request.nextUrl.searchParams.get("appointmentId"));
    const token = z.string().min(1).max(4000).parse(request.nextUrl.searchParams.get("t"));
    return NextResponse.json(customerView(await authorizePreparationToken(token, id)), { headers });
  } catch (e) { return failure(e); }
}
export async function POST(request: NextRequest) {
  try {
    const body = await request.json(); const id = z.string().uuid().parse(body.appointmentId);
    const token = z.string().min(1).max(4000).parse(body.accessToken);
    const current = await authorizePreparationToken(token, id);
    return NextResponse.json(customerView(await actOnPreparation(current, body, { kind: "customer", userId: null })), { headers });
  } catch (e) { return failure(e); }
}
function failure(e: unknown) {
  return NextResponse.json({ message: e instanceof OwnerApiError ? e.message : "예약 내용을 확인할 수 없습니다." }, { status: e instanceof OwnerApiError ? e.status : 400, headers });
}
