import { NextRequest, NextResponse } from "next/server";

function isMobileOwnerRequest(request: NextRequest) {
  const clientHintsMobile = request.headers.get("sec-ch-ua-mobile");
  if (clientHintsMobile === "?1") return true;

  const userAgent = request.headers.get("user-agent")?.toLowerCase() ?? "";
  return /android|iphone|ipod|mobile/.test(userAgent);
}

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname !== "/owner") {
    return NextResponse.next();
  }

  if (!isMobileOwnerRequest(request)) {
    return NextResponse.next();
  }

  const mobileOwnerUrl = request.nextUrl.clone();
  mobileOwnerUrl.pathname = "/owner/mobile";
  return NextResponse.redirect(mobileOwnerUrl);
}

export const config = {
  matcher: ["/owner"],
};
