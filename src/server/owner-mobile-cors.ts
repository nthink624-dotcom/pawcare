import { NextRequest, NextResponse } from "next/server";

const OWNER_MOBILE_DEV_ORIGIN = "http://localhost:8096";
const READ_ONLY_METHODS = "GET, OPTIONS";
const READ_ONLY_HEADERS = "Authorization, Content-Type, Accept";

function getOwnerMobileCorsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get("origin");
  if (origin !== OWNER_MOBILE_DEV_ORIGIN) return {};

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": READ_ONLY_METHODS,
    "Access-Control-Allow-Headers": READ_ONLY_HEADERS,
    "Vary": "Origin",
  };
}

export function ownerMobileCorsJson(request: NextRequest, body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);

  for (const [key, value] of Object.entries(getOwnerMobileCorsHeaders(request))) {
    response.headers.set(key, value);
  }

  return response;
}

export function ownerMobileCorsPreflight(request: NextRequest) {
  const requestedMethod = request.headers.get("access-control-request-method")?.toUpperCase();
  const headers = getOwnerMobileCorsHeaders(request);

  if (requestedMethod && requestedMethod !== "GET") {
    return new NextResponse(null, {
      status: 405,
      headers: {
        ...headers,
        Allow: READ_ONLY_METHODS,
      },
    });
  }

  return new NextResponse(null, {
    status: 204,
    headers,
  });
}
