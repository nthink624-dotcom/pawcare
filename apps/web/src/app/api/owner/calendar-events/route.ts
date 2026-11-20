import { NextRequest } from "next/server";
import { z } from "zod";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";
import { calendarEventSchema, listShopCalendarEvents, removeShopCalendarEvent, requireCalendarEditor, saveShopCalendarEvent, shopCalendarMonthSchema } from "@/server/shop-calendar";

const cors = { methods: "GET, POST, PATCH, DELETE, OPTIONS" };
const requestId = z.string().uuid();

function reply(request: NextRequest, body: unknown, status = 200) {
  return ownerMobileCorsJson(request, body, { status, headers: { "Cache-Control": "private, no-store" } }, cors);
}

function failure(request: NextRequest, error: unknown) {
  if (error instanceof OwnerApiError) return reply(request, { message: error.message }, error.status);
  if (error instanceof z.ZodError || error instanceof SyntaxError) return reply(request, { message: "일정의 날짜, 시간, 제목을 확인해 주세요." }, 400);
  return reply(request, { message: "매장 일정 요청을 처리하지 못했어요." }, 503);
}

async function getShop(request: NextRequest) {
  const shopId = z.string().trim().min(1).max(120).parse(request.nextUrl.searchParams.get("shopId"));
  const owner = await requireOwnerShop(request, shopId, undefined, { deferBillingMaintenance: true });
  if (!owner.userId) throw new OwnerApiError("로그인이 필요합니다.", 401);
  return owner;
}

export async function GET(request: NextRequest) {
  try {
    const owner = await getShop(request);
    const month = shopCalendarMonthSchema.parse(request.nextUrl.searchParams.get("month"));
    return reply(request, await listShopCalendarEvents(owner, month));
  } catch (error) { return failure(request, error); }
}

async function save(request: NextRequest, create: boolean) {
  try {
    const owner = await getShop(request);
    requireCalendarEditor(owner);
    const id = requestId.parse(request.nextUrl.searchParams.get("id"));
    const event = calendarEventSchema.parse(await request.json());
    return reply(request, { event: await saveShopCalendarEvent(owner, id, event, create) });
  } catch (error) { return failure(request, error); }
}

export function POST(request: NextRequest) { return save(request, true); }
export function PATCH(request: NextRequest) { return save(request, false); }

export async function DELETE(request: NextRequest) {
  try {
    const owner = await getShop(request);
    const id = requestId.parse(request.nextUrl.searchParams.get("id"));
    await removeShopCalendarEvent(owner, id);
    return reply(request, { deleted: true });
  } catch (error) { return failure(request, error); }
}

export function OPTIONS(request: NextRequest) { return ownerMobileCorsPreflight(request, cors); }
