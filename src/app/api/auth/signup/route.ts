import { NextRequest, NextResponse } from "next/server";
import { forwardAtomicSignupRequest, readAtomicSignupRequest } from "@/lib/auth/atomic-signup-proxy";

/**
 * F is a mobile shell only. The main application owns the single atomic signup
 * operation; this route intentionally contains no Supabase/Auth/database work.
 */
export async function POST(request: NextRequest) {
  const requestBody = await readAtomicSignupRequest({
    contentLength: request.headers.get("content-length"),
    contentType: request.headers.get("content-type"),
    body: request.body,
  });
  if (requestBody.error) {
    return new NextResponse(requestBody.error.body, {
      status: requestBody.error.status,
      headers: { "content-type": requestBody.error.contentType, "cache-control": "no-store" },
    });
  }

  const response = await forwardAtomicSignupRequest({
    enabled: process.env.ATOMIC_OWNER_SIGNUP_ENABLED === "true",
    mainOrigin: process.env.PETMANAGER_MAIN_APP_ORIGIN,
    nodeEnv: process.env.NODE_ENV,
    allowLocalFixture: process.env.ATOMIC_OWNER_SIGNUP_LOCAL_FIXTURE_ENABLED === "true",
    payload: requestBody.payload,
    signal: request.signal,
  });

  return new NextResponse(response.body, {
    status: response.status,
    headers: { "content-type": response.contentType, "cache-control": "no-store" },
  });
}
