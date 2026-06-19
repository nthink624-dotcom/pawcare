import { NextRequest, NextResponse } from "next/server";

import { processAutomaticVisitReminders } from "@/server/visit-reminder-processor";

export const dynamic = "force-dynamic";

function isAuthorizedCronRequest(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET || process.env.NOTIFICATION_CRON_SECRET;
  const authorization = request.headers.get("authorization") ?? "";

  if (cronSecret) {
    return authorization === `Bearer ${cronSecret}`;
  }

  if (process.env.NODE_ENV !== "production") return true;

  const userAgent = request.headers.get("user-agent") ?? "";
  return userAgent.toLowerCase().includes("vercel-cron");
}

async function handleVisitReminderCron(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ message: "Unauthorized visit reminder cron request." }, { status: 401 });
  }

  const result = await processAutomaticVisitReminders();
  return NextResponse.json(result, { status: result.ok ? 200 : 207 });
}

export async function GET(request: NextRequest) {
  return handleVisitReminderCron(request);
}

export async function POST(request: NextRequest) {
  return handleVisitReminderCron(request);
}
