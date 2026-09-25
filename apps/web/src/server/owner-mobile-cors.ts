import { NextRequest, NextResponse } from "next/server";

const OWNER_MOBILE_ALLOWED_ORIGINS = new Set([
  "http://localhost:8086",
  "http://127.0.0.1:8086",
  "http://localhost:3100",
  "http://127.0.0.1:3100",
  "capacitor://localhost",
]);
const READ_ONLY_METHODS = "GET, OPTIONS";
const READ_ONLY_HEADERS = "Authorization, Content-Type, Accept";

type OwnerMobileCorsOptions = {
  methods?: string;
  headers?: string;
};

function getOwnerMobileCorsHeaders(
  request: NextRequest,
  options: OwnerMobileCorsOptions = {},
): Record<string, string> {
  const origin = request.headers.get("origin");
  if (!origin || !OWNER_MOBILE_ALLOWED_ORIGINS.has(origin)) return {};

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": options.methods ?? READ_ONLY_METHODS,
    "Access-Control-Allow-Headers": options.headers ?? READ_ONLY_HEADERS,
    "Vary": "Origin",
  };
}

export function ownerMobileCorsJson(
  request: NextRequest,
  body: unknown,
  init?: ResponseInit,
  options: OwnerMobileCorsOptions = {},
) {
  const response = NextResponse.json(body, init);

  for (const [key, value] of Object.entries(getOwnerMobileCorsHeaders(request, options))) {
    response.headers.set(key, value);
  }

  return response;
}

export function ownerMobileCorsPreflight(
  request: NextRequest,
  options: OwnerMobileCorsOptions = {},
) {
  const requestedMethod = request.headers.get("access-control-request-method")?.toUpperCase();
  const allowedMethods = options.methods ?? READ_ONLY_METHODS;
  const headers = getOwnerMobileCorsHeaders(request, options);

  if (
    requestedMethod &&
    !allowedMethods
      .split(",")
      .map((method) => method.trim().toUpperCase())
      .includes(requestedMethod)
  ) {
    return new NextResponse(null, {
      status: 405,
      headers: {
        ...headers,
        Allow: allowedMethods,
      },
    });
  }

  return new NextResponse(null, {
    status: 204,
    headers,
  });
}
