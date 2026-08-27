import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { projectControlPlaneEvents } from "@/lib/agent-control-plane";
import { appendDemoControlPlaneEvent, readDemoControlPlaneLedger, verifyDemoControlPlaneToken } from "@/lib/demo-control-plane-ledger";
import { AdminApiError, requireAdminSession } from "@/server/admin-api-auth";
import type { ControlPlaneEvent } from "@/types/agent-control-plane";

function unavailable() { return NextResponse.json({ error: "개발 전용" }, { status: 404 }); }
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") return unavailable();
  try { await requireAdminSession(request); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "권한 없음" }, { status: error instanceof AdminApiError ? error.status : 500 }); }
  const events = await readDemoControlPlaneLedger();
  return NextResponse.json(projectControlPlaneEvents({ events, now: new Date().toISOString() }), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") return unavailable();
  if (!await verifyDemoControlPlaneToken(request.headers.get("x-workroom-bridge-token"))) return NextResponse.json({ error: "권한 없음" }, { status: 401 });
  const event = await request.json() as ControlPlaneEvent;
  if (!event.eventId || !event.workId || !event.sourceEventAt || !["codex_live", "manual"].includes(event.eventSource ?? "")) return NextResponse.json({ error: "잘못된 이벤트" }, { status: 400 });
  const result = await appendDemoControlPlaneEvent(event);
  return NextResponse.json({ ...result, externalExecution: false });
}
