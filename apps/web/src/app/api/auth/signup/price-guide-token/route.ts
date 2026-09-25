import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { serverEnv } from "@/lib/server-env";
import {
  assertSignupSameOrigin,
  createSignupPriceGuideSession,
  getSignupPriceGuideSessionMaxAgeSeconds,
  getSignupRequestIp,
  issueSignupPriceGuideAnalysisToken,
  normalizeSignupDeviceFingerprint,
  readSignupPriceGuideSession,
  SIGNUP_PRICE_GUIDE_SESSION_COOKIE,
  SignupPriceGuideGuardError,
} from "@/server/signup-price-guide-analysis-guard";

export const runtime = "nodejs";

const requestSchema = z.object({ deviceFingerprint: z.string().min(16).max(120) });

export async function POST(request: NextRequest) {
  try {
    assertSignupSameOrigin(request);
    const payload = requestSchema.parse(await request.json());
    const deviceFingerprint = normalizeSignupDeviceFingerprint(payload.deviceFingerprint);
    const existingCookie = request.cookies.get(SIGNUP_PRICE_GUIDE_SESSION_COOKIE)?.value;
    let sessionCookie = existingCookie;
    let sessionId: string;
    try {
      sessionId = readSignupPriceGuideSession(existingCookie, serverEnv.signupPriceGuideTokenSecret);
    } catch {
      sessionCookie = createSignupPriceGuideSession(serverEnv.signupPriceGuideTokenSecret);
      sessionId = readSignupPriceGuideSession(sessionCookie, serverEnv.signupPriceGuideTokenSecret);
    }
    const issued = issueSignupPriceGuideAnalysisToken({
      sessionId,
      deviceFingerprint,
      ip: getSignupRequestIp(request.headers),
      secret: serverEnv.signupPriceGuideTokenSecret,
    });
    const response = NextResponse.json({ token: issued.token, expiresAt: issued.expiresAt });
    if (sessionCookie !== existingCookie) {
      response.cookies.set(SIGNUP_PRICE_GUIDE_SESSION_COOKIE, sessionCookie!, {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        path: "/api/auth/signup",
        maxAge: getSignupPriceGuideSessionMaxAgeSeconds(),
      });
    }
    return response;
  } catch (cause) {
    if (cause instanceof SignupPriceGuideGuardError) {
      return NextResponse.json({ code: cause.code, message: cause.message }, { status: cause.status });
    }
    return NextResponse.json({ code: "TOKEN_REQUEST_FAILED", message: "사진 분석 권한을 준비하지 못했습니다." }, { status: 400 });
  }
}
