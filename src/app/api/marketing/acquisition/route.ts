import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  MARKETING_UTM_FIELDS,
  MarketingAcquisitionInputError,
  parseMarketingAcquisitionSource,
} from "@/lib/marketing-acquisition";
import {
  marketingAcquisitionCookieOptions,
  MARKETING_ACQUISITION_COOKIE,
  recordAnonymousMarketingTouch,
} from "@/server/marketing-acquisition";

const utmShape = Object.fromEntries(MARKETING_UTM_FIELDS.map((field) => [field, z.string()])) as Record<
  (typeof MARKETING_UTM_FIELDS)[number],
  z.ZodString
>;
const utmSchema = z.object(utmShape).partial().strict();
const bodySchema = z.discriminatedUnion("eventName", [
  z.object({ eventName: z.literal("landing_view"), utm: utmSchema }).strict(),
  z.object({ eventName: z.literal("landing_cta_click"), ctaId: z.literal("signup"), utm: utmSchema }).strict(),
]);

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    if (!origin || new URL(origin).origin !== request.nextUrl.origin) {
      return NextResponse.json({ accepted: false, message: "허용되지 않은 유입 기록 요청입니다." }, { status: 403 });
    }
    const body = bodySchema.parse(await request.json());
    const source = parseMarketingAcquisitionSource(body.utm);
    const result = await recordAnonymousMarketingTouch({
      request,
      eventName: body.eventName,
      source,
      ctaId: body.eventName === "landing_cta_click" ? body.ctaId : undefined,
    });
    const response = NextResponse.json({ accepted: true, recorded: result.status === "recorded" }, { status: 202 });
    if (result.shouldSetCookie) {
      response.cookies.set(MARKETING_ACQUISITION_COOKIE, result.acquisitionId, marketingAcquisitionCookieOptions());
    }
    return response;
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof MarketingAcquisitionInputError) {
      return NextResponse.json({ accepted: false, message: "유입 정보를 안전하게 확인하지 못했습니다." }, { status: 400 });
    }
    return NextResponse.json({ accepted: false, message: "유입 기록을 시작하지 못했습니다." }, { status: 503 });
  }
}
