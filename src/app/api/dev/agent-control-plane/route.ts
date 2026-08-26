import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

import { projectControlPlaneEvents } from "@/lib/agent-control-plane";
import type { ControlPlaneEvent } from "@/types/agent-control-plane";

const ledgerPath = path.join(process.cwd(), ".petmanager-status", "demo-agent-control-plane-events.json");

function unavailable() { return NextResponse.json({ error: "개발 전용" }, { status: 404 }); }
async function readLedger(): Promise<ControlPlaneEvent[]> { try { return JSON.parse(await readFile(ledgerPath, "utf8")) as ControlPlaneEvent[]; } catch { return []; } }

export async function GET() {
  if (process.env.NODE_ENV !== "development") return unavailable();
  const events = await readLedger();
  return NextResponse.json(projectControlPlaneEvents({ events, now: new Date().toISOString() }), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") return unavailable();
  const event = await request.json() as ControlPlaneEvent;
  const events = await readLedger();
  if (!events.some((item) => item.eventId === event.eventId)) events.push(event);
  await mkdir(path.dirname(ledgerPath), { recursive: true });
  await writeFile(ledgerPath, JSON.stringify(events, null, 2), "utf8");
  return NextResponse.json({ accepted: true, duplicate: events.some((item, index) => item.eventId === event.eventId && index !== events.findIndex((candidate) => candidate.eventId === event.eventId)), externalExecution: false });
}
