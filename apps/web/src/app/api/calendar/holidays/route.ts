import { NextRequest } from "next/server";
import { readCalendarHolidays } from "@/server/calendar-holidays";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";

export async function GET(request: NextRequest) {
  const month = request.nextUrl.searchParams.get("month") ?? "";
  if (!/^(?:19[7-9]\d|20\d{2}|2100)-(?:0[1-9]|1[0-2])$/.test(month)) {
    return ownerMobileCorsJson(request, { message: "조회할 연도와 월을 확인해 주세요." }, { status: 400 });
  }
  try {
    const holidays = await readCalendarHolidays(month);
    return ownerMobileCorsJson(request, { month, holidays }, { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" } });
  } catch {
    return ownerMobileCorsJson(request, { message: "공휴일을 불러오지 못했어요." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export function OPTIONS(request: NextRequest) { return ownerMobileCorsPreflight(request); }
