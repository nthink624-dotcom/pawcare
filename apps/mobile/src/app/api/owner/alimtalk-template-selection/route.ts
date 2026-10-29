import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Read the shared owner catalog without introducing a second template store. */
export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store" };
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ") || !authorization.slice(7).trim()) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401, headers });
  }
  const shopId = request.nextUrl.searchParams.get("shopId")?.trim();
  if (!shopId || shopId.length > 100) {
    return NextResponse.json({ message: "매장 정보를 확인해 주세요." }, { status: 400, headers });
  }
  const url = new URL("https://www.petmanager.co.kr/api/owner/alimtalk-template-selection");
  url.searchParams.set("shopId", shopId);
  try {
    // The shared endpoint validates the bearer session and shop membership.
    const response = await fetch(url, {
      headers: { Authorization: authorization },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      return NextResponse.json({ message: "템플릿을 불러오지 못했습니다." }, {
        status: response.status === 401 || response.status === 403 ? response.status : 502,
        headers,
      });
    }
    const data = await response.json();
    if (!Array.isArray(data.items)) throw new Error("Invalid template catalog");
    return NextResponse.json({ items: data.items }, { headers });
  } catch {
    return NextResponse.json({ message: "템플릿을 불러오지 못했습니다." }, { status: 502, headers });
  }
}
