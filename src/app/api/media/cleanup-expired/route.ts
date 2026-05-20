import { NextRequest, NextResponse } from "next/server";

import { serverEnv } from "@/lib/server-env";
import { cleanupExpiredTransientMedia } from "@/server/media-service";
import { OwnerApiError } from "@/server/owner-api-auth";

function isAuthorized(request: NextRequest) {
  if (!serverEnv.mediaCleanupCronSecret) {
    return process.env.NODE_ENV !== "production";
  }

  const headerSecret = request.headers.get("x-cron-secret") ?? request.headers.get("authorization")?.replace("Bearer ", "");
  return headerSecret === serverEnv.mediaCleanupCronSecret;
}

function getBooleanParam(value: string | null, fallback: boolean) {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

async function runCleanup(request: NextRequest, forceDryRun: boolean) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Media cleanup is not authorized." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") || 100);
    const result = await cleanupExpiredTransientMedia({
      dryRun: forceDryRun ? true : getBooleanParam(searchParams.get("dryRun"), true),
      limit: Number.isFinite(limit) ? limit : 100,
      now: searchParams.get("now"),
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Media cleanup failed.";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return runCleanup(request, true);
}

export async function POST(request: NextRequest) {
  return runCleanup(request, false);
}
