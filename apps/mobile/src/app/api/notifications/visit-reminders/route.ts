import { NextRequest, NextResponse } from "next/server";

import { serverEnv } from "@/lib/server-env";
import { runScheduledNotificationDispatch } from "@/server/notification-dispatch";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET || serverEnv.notificationCronSecret;
  if (!cronSecret) return process.env.NODE_ENV !== "production";

  const authorization = request.headers.get("authorization") ?? "";
  const headerSecret = request.headers.get("x-cron-secret") ?? "";
  return authorization === `Bearer ${cronSecret}` || headerSecret === cronSecret;
}

async function handleVisitReminders(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized visit reminder cron request." }, { status: 401 });
  }

  try {
    const result = await runScheduledNotificationDispatch();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "방문 전 자동 안내를 처리하지 못했습니다." },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return handleVisitReminders(request);
}

export async function POST(request: NextRequest) {
  return handleVisitReminders(request);
}
