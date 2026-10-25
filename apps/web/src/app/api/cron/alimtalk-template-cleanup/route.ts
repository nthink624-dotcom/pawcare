import type { NextRequest } from "next/server";
import { runRetiredAlimtalkCleanup } from "@/server/alimtalk-template-cleanup";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
const headers = { "Cache-Control": "no-store" };
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ ok: false }, { status: 401, headers });
  try {
    const result = await runRetiredAlimtalkCleanup();
    console.info("[alimtalk-template-cleanup] completed", result);
    return Response.json({ ok: true, ...result }, { headers });
  } catch {
    console.error("[alimtalk-template-cleanup] failed");
    return Response.json({ ok: false }, { status: 503, headers });
  }
}
