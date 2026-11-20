import { NextRequest } from "next/server";
import { z } from "zod";
import { isCalendarDate } from "@petmanager/shared/lib/owner-calendar";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";
import { CalendarImportError, calendarImportLimit, calendarImportTextLimit, parseCalendarImport } from "@/server/parse-calendar-import";
import { getImportedCalendarKeys, importShopCalendarEvents, requireCalendarEditor } from "@/server/shop-calendar";

const cors = { methods: "POST, OPTIONS" };
const maxBody = 1_600_000;
const date = z.string().refine(value => isCalendarDate(value) && value >= "1970-01-01" && value <= "2100-12-31");
const inputSchema = z.object({
  ics: z.string().min(1).max(calendarImportTextLimit),
  from: date,
  to: date,
  selectedKeys: z.array(z.string().regex(/^[0-9a-f]{64}$/)).min(1).max(calendarImportLimit).optional(),
}).refine(input => input.from <= input.to && Date.parse(input.to) - Date.parse(input.from) < 366 * 86_400_000);

function reply(request: NextRequest, body: unknown, status = 200) {
  return ownerMobileCorsJson(request, body, { status, headers: { "Cache-Control": "private, no-store" } }, cors);
}

async function readBody(request: NextRequest) {
  if (Number(request.headers.get("content-length")) > maxBody) throw new OwnerApiError("파일 용량을 줄여 주세요.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new OwnerApiError("가져올 파일을 선택해 주세요.", 400);
  const decoder = new TextDecoder();
  let text = "";
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBody) {
      await reader.cancel();
      throw new OwnerApiError("파일 용량을 줄여 주세요.", 413);
    }
    text += decoder.decode(value, { stream: true });
  }
  return JSON.parse(text + decoder.decode()) as unknown;
}

export async function POST(request: NextRequest) {
  try {
    const shopId = z.string().trim().min(1).max(120).parse(request.nextUrl.searchParams.get("shopId"));
    const owner = await requireOwnerShop(request, shopId, undefined, { deferBillingMaintenance: true });
    requireCalendarEditor(owner);
    const input = inputSchema.parse(await readBody(request));
    const { items, skipped } = parseCalendarImport(input.ics, input.from, input.to);
    if (!input.selectedKeys) {
      const existing = await getImportedCalendarKeys(owner, items.map(item => item.key));
      return reply(request, { items: items.map(item => ({ ...item, alreadyImported: existing.has(item.key) })), skipped });
    }
    const keys = new Set(input.selectedKeys);
    const selected = items.filter(item => keys.has(item.key));
    if (keys.size !== selected.length) throw new OwnerApiError("미리보기에서 다시 선택해 주세요.", 400);
    return reply(request, await importShopCalendarEvents(owner, selected));
  } catch (error) {
    if (error instanceof OwnerApiError) return reply(request, { message: error.message }, error.status);
    if (error instanceof CalendarImportError) return reply(request, { message: error.message }, 400);
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return reply(request, { message: "파일과 조회 기간을 확인해 주세요. 최대 1년을 선택할 수 있어요." }, 400);
    }
    return reply(request, { message: "파일을 읽지 못했어요. .ics 형식을 확인해 주세요." }, 503);
  }
}

export function OPTIONS(request: NextRequest) { return ownerMobileCorsPreflight(request, cors); }
