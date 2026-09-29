import { NextResponse } from "next/server";

import { getReleaseId, getRequestId } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  return NextResponse.json(
    { status: "ok", requestId, release: getReleaseId() },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "x-request-id": requestId,
      },
    },
  );
}
