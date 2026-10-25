import type { NextRequest } from "next/server";
import { runRetiredAlimtalkCleanup } from "@/server/alimtalk-template-cleanup";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
const headers = { "Cache-Control": "no-store" };
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ ok: false }, { status: 401, headers });
  try { return Response.json({ ok: true, ...await runRetiredAlimtalkCleanup() }, { headers }); }
  catch { return Response.json({ ok: false }, { status: 503, headers }); }
}
