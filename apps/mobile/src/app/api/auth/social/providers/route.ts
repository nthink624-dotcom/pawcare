import { NextRequest, NextResponse } from "next/server";

import { requestCanonicalApi } from "@/server/owner-api-auth";

export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const { ok, body } = await requestCanonicalApi({ request, path: "/api/auth/social/providers", auth: "omit" });
    if (ok && body && typeof body === "object" && "naver" in body && "kakao" in body && "google" in body) {
      return NextResponse.json({ naver: body.naver === true, kakao: body.kakao === true, google: body.google === true }, { headers });
    }
  } catch {
    // Credentials and upstream error metadata stay on the canonical server.
  }
  return NextResponse.json({ message: "소셜 로그인 설정을 확인하지 못했습니다." }, { status: 503, headers });
}
