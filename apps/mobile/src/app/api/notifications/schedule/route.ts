import { NextRequest, NextResponse } from "next/server";

import { serverEnv } from "@/lib/server-env";
import { runScheduledNotificationDispatch } from "@/server/notification-dispatch";

function isAuthorized(request: NextRequest) {
  if (!serverEnv.notificationCronSecret) {
    return process.env.NODE_ENV !== "production";
  }

  const headerSecret = request.headers.get("x-cron-secret") ?? request.headers.get("authorization")?.replace("Bearer ", "");
  return headerSecret === serverEnv.notificationCronSecret;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "스케줄 실행 권한이 없습니다." }, { status: 401 });
  }

  try {
    const result = await runScheduledNotificationDispatch();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "자동 알림 스케줄 실행에 실패했습니다.";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export const GET = POST;
