import type { NextRequest } from "next/server";
import { runAlimtalkApprovalSync } from "@/server/alimtalk-approval-worker";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
const headers = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false }, { status: 401, headers });
  }
  try {
    const result = await runAlimtalkApprovalSync();
    console.info("[alimtalk-approvals] completed", result);
    return Response.json({ ok: true, ...result }, { headers });
  } catch {
    console.error("[alimtalk-approvals] synchronization failed");
    return Response.json({ ok: false }, { status: 503, headers });
  }
}
