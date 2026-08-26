#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";

const ingestUrl = process.env.CONTROL_PLANE_INGEST_URL;
const token = process.env.MARKETING_WORK_EVENT_TOKEN;
if (!ingestUrl || !token) throw new Error("CONTROL_PLANE_INGEST_URL과 MARKETING_WORK_EVENT_TOKEN이 필요합니다.");

const snapshots = [
  work("PM-OPS-CONTROL-PLANE", null, "운영팀", "operations", "운영 업무 관제", "in_progress", "운영 데이터 연결", "실시간 원장 검증", "신규 하위 업무 연결", "sync_limited"),
  work("PM-GROWTH-20260826-006", "PM-OPS-CONTROL-PLANE", "성장팀", "growth", "체험 페이지 Preview", "completed", "크리에이티브 검수 완료", "문안·안전 잠금 검수 완료", "외부 공개 전 상태 유지", "sync_limited"),
  work("PM-GROWTH-20260826-006-ANALYSIS", "PM-OPS-CONTROL-PLANE", "분석팀", "analysis", "마케팅 측정 검토", "completed", "측정·정책 계약 검토 완료", "분석 계약 검토 완료", "실행 전 상태 유지", "sync_limited"),
  work("PM-CODEX-CONTROL-PLANE", "PM-OPS-CONTROL-PLANE", "구현팀", "codex", "실시간 워크룸 연결", "in_progress", "운영 원장 연결 구현", "격리 Preview와 계약 테스트 완료", "운영 연결 검증", "sync_limited"),
];

await probeCodexAppServer();
for (const [index, snapshot] of snapshots.entries()) await ingest({ ...snapshot, sourceSequence: Date.now() * 10 + index });
if (process.argv.includes("--e2e-child")) {
  await ingest({ ...work(`PM-OPS-E2E-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`, "PM-OPS-CONTROL-PLANE", "구현팀", "codex", "신규 연결 확인", "in_progress", "운영팀 지시 수신", null, "자동 반영 확인", "connected"), sourceSequence: Date.now() * 10 + 9 });
}
process.stdout.write(JSON.stringify({ accepted: true, count: snapshots.length, appServer: "stdio", externalExecution: false }) + "\n");

async function ingest(event) {
  const sourceEventAt = new Date().toISOString();
  const stable = `${event.workId}:${event.sourceSequence}:${event.status}`;
  const payload = { ...event, idempotencyKey: `gateway:${createHash("sha256").update(stable).digest("hex")}`, sourceType: "operational", eventType: event.status === "completed" ? "completed" : "status_changed", sourceEventAt, approvalRequired: event.status === "approval_waiting" };
  const response = await fetch(ingestUrl, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`event ingest failed (${response.status})`);
}

async function probeCodexAppServer() {
  const child = spawn("codex", ["app-server", "--stdio"], { stdio: ["pipe", "pipe", "ignore"], windowsHide: true });
  const requestId = randomUUID();
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: requestId, method: "initialize", params: { clientInfo: { name: "petmanager-control-plane-gateway", version: "0.1.0" }, capabilities: {} } }) + "\n");
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Codex App Server stdio 연결 실패")), 5_000);
    child.stdout.once("data", () => { clearTimeout(timeout); resolve(); });
    child.once("error", reject);
  }).finally(() => child.kill());
}

function work(workId, parentWorkId, roleLabel, sourceSystem, title, status, currentStage, completedSummary, nextAction, syncState) {
  return { workId, parentWorkId, roleLabel, ownerTeam: `펫매니저 ${roleLabel}`, sourceSystem, title, status, currentStage, completedSummary, blockerSummary: null, nextAction, syncState, originalDirectiveSummary: "대표 승인 범위의 비식별 업무 상태", operationsDirectiveSummary: "운영팀이 안전 경계 안에서 전달한 비식별 지시" };
}
