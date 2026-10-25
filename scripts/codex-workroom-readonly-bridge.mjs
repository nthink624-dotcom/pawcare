#!/usr/bin/env node
import { createHash } from "node:crypto";
import { open, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const sessionsRoot = process.env.CODEX_SESSIONS_ROOT ?? "C:\\Users\\happy\\.codex\\sessions";
const ingestUrl = process.env.WORKROOM_LOCAL_INGEST_URL ?? "http://127.0.0.1:3000/api/admin/marketing/demo-control-plane";
const bridgeTokenPath = process.env.WORKROOM_BRIDGE_TOKEN_PATH ?? path.join(process.cwd(), ".petmanager-status", "workroom-bridge-token");
const pollMs = 750;
const allowlist = new Map([
  ["01a03c61-9b24-7d41-99e3-31833f9b3bd1", task("운영팀", "CODEX-OPS-THREAD", "운영팀 업무 지시 관제", "하위 팀 결과 검수")],
  ["01a037e1-7cd5-79d3-9071-a2036874a8c6", task("성장팀", "GROWTH-CLAIMS-LEDGER", "검증된 제품 사실·허용 문구 원장 작성", "허용 문구 검수")],
  ["01a03c2c-ca60-7922-bfd2-df89d8fc4a1c", task("마케팅 분석팀", "ANALYSIS-RELEASE-MEASUREMENT", "LAUNCH_MEASUREMENT_BASELINE v0.1", "구현팀의 LAUNCH_FUNNEL_EVENT_LEDGER v0.1 결과 검수 대기")],
  ["01a03cc1-1be5-7633-9fd8-0323f63c4510", task("경쟁사 분석팀", "COMPETITOR-KR-THREE", "국내 직접 경쟁사 3곳 공식 근거 비교", "공식 근거 비교 제출")],
  ["019ffb7d-6dbe-75d2-b21e-d8d800080c63", task("초기 세팅팀", "SETUP-SERVICE-PRICE-ONCE", "실제 회원가입에 서비스 요금 1회 등록 연결", "연결 결과 제출")],
  ["019fea32-9ed6-7530-978d-282807d2e996", task("Android팀", "ANDROID-FCM-DIAGNOSIS", "알림 토글 비활성·FCM 정적 원인 진단", "원인 범위 확정")],
  ["01a0409e-c4e6-7fa1-a390-25d6b95d867b", task("보안팀", "SECURITY-SIGNUP-RELEASE-GATE", "회원가입 원자성·RLS·파일 보안 출시 게이트 작성", "초기 세팅팀 구현 결과 보안 재검수 대기")],
  ["01a040af-18e8-73f3-99c3-c0152d5773f9", task("UI 디자인팀", "UI-DESIGN-PLAYBOOK", "관리자 홈·예약 보드 디자인 플레이북 적용", "적용 시안 제출")],
]);
const observed = new Map();

while (true) {
  try {
    const files = await findSessionFiles(sessionsRoot);
    for (const session of files) await syncFile(session);
  } catch (error) {
    process.stderr.write(`[bridge] ${error instanceof Error ? error.message : String(error)}\n`);
  }
  await new Promise((resolve) => setTimeout(resolve, pollMs));
}

async function syncFile({ file, threadId }) {
  const definition = allowlist.get(threadId);
  if (!definition) return;

  const fileStat = await stat(file);
  // A single tool-result record can be several megabytes. Keep the read bounded,
  // but large enough to reach the trailing task lifecycle event without loading
  // an entire long-running desktop transcript into memory.
  const tailBytes = Math.min(fileStat.size, 32 * 1024 * 1024);
  const start = fileStat.size - tailBytes;
  const handle = await open(file, "r");
  const buffer = Buffer.alloc(tailBytes);
  try {
    await handle.read(buffer, 0, tailBytes, start);
  } finally {
    await handle.close();
  }
  const source = buffer.toString("utf8");
  const lines = source.split(/\r?\n/);
  if (start > 0) lines.shift();

  const relevant = lines.map(safeJson).filter((item) => item?.type === "event_msg" && ["task_started", "task_complete", "turn_aborted"].includes(item.payload?.type));
  const last = relevant.at(-1);
  if (!last) return;
  const stableKey = `${threadId}:${last.ordinal}:${last.payload.type}:${definition.title}`;
  if (observed.get(threadId) === stableKey) return;
  await ingest(toWorkroomEvent(threadId, definition, last, stableKey));
  observed.set(threadId, stableKey);
}

function toWorkroomEvent(threadId, definition, record, stableKey) {
  const completed = record.payload.type === "task_complete";
  const blocked = record.payload.type === "turn_aborted";
  const status = completed ? "completed" : blocked ? "blocked" : "in_progress";
  const eventType = completed ? "task.completed" : blocked ? "task.blocked" : "turn.started";
  const sourceEventAt = record.timestamp;
  return {
    eventId: `codex-live-${createHash("sha256").update(stableKey).digest("hex").slice(0, 24)}`,
    sequence: Date.parse(sourceEventAt),
    workId: definition.workId,
    parentWorkId: definition.workId === "CODEX-OPS-THREAD" ? null : "CODEX-OPS-THREAD",
    source: "codex",
    sourceThreadRef: createHash("sha256").update(threadId).digest("hex").slice(0, 12),
    role: definition.role,
    eventType,
    status,
    title: definition.title,
    originalDirectiveSummary: definition.title,
    operationsDirectiveSummary: definition.role === "운영팀" ? "대표 요청을 하위 팀 업무로 정리" : `운영팀이 ${definition.role}에 전달한 허용 범위 업무`,
    completedSummary: completed ? `${definition.title} 완료 보고 수신` : null,
    blockerSummary: blocked ? "작업 중단 상태 확인 필요" : null,
    nextAction: definition.nextAction,
    approvalRequired: false,
    artifact: null,
    category: definition.role === "운영팀" ? undefined : "team_progress",
    eventSource: "codex_live",
    sourceEventAt,
    receivedAt: new Date().toISOString(),
  };
}

async function ingest(event) {
  const bridgeToken = (await readFile(bridgeTokenPath, "utf8")).trim();
  const response = await fetch(ingestUrl, { method: "POST", headers: { "Content-Type": "application/json", "x-workroom-bridge-token": bridgeToken }, body: JSON.stringify(event), signal: AbortSignal.timeout(3_000) });
  if (!response.ok) throw new Error(`ingest ${response.status}`);
}

async function findSessionFiles(root) {
  const result = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(fullPath);
      else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        const threadId = [...allowlist.keys()].find((id) => entry.name.includes(id));
        if (threadId) result.push({ file: fullPath, threadId });
      }
    }
  }
  return result;
}

function safeJson(value) { try { return JSON.parse(value); } catch { return null; } }
function task(role, workId, title, nextAction) { return { role, workId, title, nextAction }; }
