import { randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { ControlPlaneEvent } from "@/types/agent-control-plane";

const runtimeDirectory = path.join(process.cwd(), ".petmanager-status");
export const demoControlPlaneLedgerPath = path.join(runtimeDirectory, "demo-agent-control-plane.sqlite");
export const demoControlPlaneTokenPath = path.join(runtimeDirectory, "workroom-bridge-token");
const legacyJsonPath = path.join(runtimeDirectory, "demo-agent-control-plane-events.json");
let database: DatabaseSync | null = null;

function getDatabase() {
  if (database) return database;
  mkdirSync(runtimeDirectory, { recursive: true });
  database = new DatabaseSync(demoControlPlaneLedgerPath);
  database.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;
    CREATE TABLE IF NOT EXISTS workroom_events (
      event_id TEXT PRIMARY KEY, source_event_at TEXT NOT NULL, observed_at TEXT NOT NULL,
      safe_event_json TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1
    );`);
  if (existsSync(legacyJsonPath)) {
    const events = JSON.parse(readFileSync(legacyJsonPath, "utf8")) as ControlPlaneEvent[];
    const insert = database.prepare("INSERT OR IGNORE INTO workroom_events(event_id,source_event_at,observed_at,safe_event_json) VALUES(?,?,?,?)");
    database.exec("BEGIN IMMEDIATE");
    try {
      for (const event of events) {
        if (!event.eventId || !event.sourceEventAt || !event.receivedAt) continue;
        insert.run(event.eventId, event.sourceEventAt, event.receivedAt, JSON.stringify(event));
      }
      database.exec("COMMIT");
    }
    catch (error) { database.exec("ROLLBACK"); throw error; }
  }
  return database;
}

export async function readDemoControlPlaneLedger(): Promise<ControlPlaneEvent[]> {
  const rows = getDatabase().prepare("SELECT safe_event_json FROM workroom_events ORDER BY source_event_at,event_id").all() as Array<{ safe_event_json: string }>;
  return rows.map(({ safe_event_json }) => JSON.parse(safe_event_json) as ControlPlaneEvent).map((event) => {
    if (event.eventSource !== "codex_live") return event;
    const sourceAt = Date.parse(event.sourceEventAt); const observedAt = Date.parse(event.receivedAt);
    return Number.isFinite(sourceAt) && Number.isFinite(observedAt) && observedAt - sourceAt > 5_000 ? { ...event, eventSource: "local_snapshot" as const } : event;
  });
}

export async function ensureDemoControlPlaneToken() {
  try { return readFileSync(demoControlPlaneTokenPath, "utf8").trim(); }
  catch { const token = randomBytes(32).toString("base64url"); writeFileSync(demoControlPlaneTokenPath, token, { encoding: "utf8", flag: "wx" }); return token; }
}

export async function verifyDemoControlPlaneToken(candidate: string | null) {
  if (!candidate) return false;
  const expected = await ensureDemoControlPlaneToken();
  const left = Buffer.from(candidate); const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function appendDemoControlPlaneEvent(event: ControlPlaneEvent) {
  const result = getDatabase().prepare("INSERT OR IGNORE INTO workroom_events(event_id,source_event_at,observed_at,safe_event_json) VALUES(?,?,?,?)").run(event.eventId, event.sourceEventAt, event.receivedAt, JSON.stringify(event));
  return { accepted: true, duplicate: result.changes === 0 };
}
