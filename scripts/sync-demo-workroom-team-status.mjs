import { readFile } from "node:fs/promises";
import path from "node:path";

const endpoint = "http://127.0.0.1:3000/api/admin/marketing/demo-control-plane";
const bridgeToken = (await readFile(path.join(process.cwd(), ".petmanager-status", "workroom-bridge-token"), "utf8")).trim();
const startedAt = Date.now();

const definitions = [
  {
    eventId: "team-sync-owner-approval-graph-request-v01",
    workId: "OWNER-ADMIN-APPROVAL-GRAPH-REQUEST",
    role: "운영팀",
    status: "received",
    title: "대표 승인 대상을 바로 이해하고 선택하는 관리자 화면",
    originalDirectiveSummary: "승인 항목을 누르면 해당 대상만 이해하고 결정할 수 있게 개선",
    operationsDirectiveSummary: "승인 딥링크와 워크룸 그래프 구조를 수정",
    completedSummary: null,
    blockerSummary: null,
    nextAction: "집중 승인과 그래프 클릭 회귀 검증",
  },
  {
    eventId: "team-sync-security-retention-approval-v03",
    workId: "SECURITY-PRICE-SOURCE-RETENTION",
    parentWorkId: "OWNER-ADMIN-APPROVAL-GRAPH-REQUEST",
    role: "보안팀",
    status: "approval_waiting",
    title: "가입 후 가격표 원본 보관 정책",
    category: "approval",
    originalDirectiveSummary: "가입 처리 후 가격표 원본 보관 범위를 대표가 결정",
    operationsDirectiveSummary: "보안팀 권고와 보유 위험을 비교해 두 선택지 중 결정",
    completedSummary: "보안 검토 완료",
    blockerSummary: "대표 정책 결정 대기",
    nextAction: "두 선택지 중 하나 결정",
    approvalRequired: true,
    detailRows: [
      { label: "보안팀 권고", value: "판독·대표 확인 후 즉시 폐기" },
      { label: "보유 위험", value: "원본 장기 보관 시 개인정보·접근통제 부담 증가" },
      { label: "선택 1", value: "판독·대표 확인 후 즉시 폐기" },
      { label: "선택 2", value: "별도 명시 동의 시에만 제한 보관" },
    ],
  },
  {
    eventId: "team-sync-growth-content-approval-v03",
    workId: "GROWTH-CONTENT-D1-D7-REVIEW",
    parentWorkId: "OWNER-ADMIN-APPROVAL-GRAPH-REQUEST",
    role: "성장팀",
    status: "approval_waiting",
    title: "Instagram 피드 4건 + 자사 웹 콘텐츠 2건 검수",
    category: "approval",
    originalDirectiveSummary: "D1~D7 콘텐츠를 대표가 다시 검수",
    operationsDirectiveSummary: "미승인 상태를 유지하고 자동 게시·다음 콘텐츠 진행을 차단",
    completedSummary: "검수 자료 제출",
    blockerSummary: "대표 검수 대기",
    nextAction: "검수 자료 확인",
    approvalRequired: true,
    artifact: { title: "D1~D7 검수 자료 열기", url: "/admin/marketing/artifacts/growth-content-review" },
  },
  {
    eventId: "team-sync-security-gate-start-v01",
    workId: "SECURITY-SIGNUP-RELEASE-GATE",
    role: "보안팀",
    status: "in_progress",
    title: "회원가입 원자성·RLS·파일 보안 출시 게이트 작성",
    category: "team_progress",
    completedSummary: null,
    blockerSummary: null,
    nextAction: "출시 게이트 작성",
  },
  {
    eventId: "team-sync-security-gate-complete-v01",
    workId: "SECURITY-SIGNUP-RELEASE-GATE",
    role: "보안팀",
    status: "completed",
    title: "회원가입 원자성·RLS·파일 보안 출시 게이트 작성",
    category: "team_progress",
    completedSummary: "회원가입 원자성·RLS·파일 보안 출시 게이트 작성 완료",
    blockerSummary: "초기 세팅팀 구현 결과·변경 참조 미도착",
    nextAction: "초기 세팅팀 구현 결과 보안 재검수 대기",
  },
  { eventId: "team-sync-setup-v01", workId: "SETUP-SERVICE-PRICE-ONCE", role: "초기 세팅팀", status: "in_progress", title: "실제 회원가입에 서비스 요금 1회 등록 연결", category: "team_progress", nextAction: "연결 결과 제출" },
  { eventId: "team-sync-growth-ledger-v01", workId: "GROWTH-CLAIMS-LEDGER", role: "성장팀", status: "in_progress", title: "검증된 제품 사실·허용 문구 원장 작성", category: "team_progress", nextAction: "허용 문구 검수" },
  { eventId: "team-sync-measurement-v01", workId: "ANALYSIS-RELEASE-MEASUREMENT", role: "마케팅 분석팀", status: "in_progress", title: "가입→예약→결제→알림톡 출시 계측 기준 작성", category: "team_progress", nextAction: "계측 기준 제출" },
  { eventId: "team-sync-competitor-v01", workId: "COMPETITOR-KR-THREE", role: "경쟁사 분석팀", status: "in_progress", title: "국내 직접 경쟁사 3곳 공식 근거 비교", category: "team_progress", nextAction: "공식 근거 비교 제출" },
  { eventId: "team-sync-android-v01", workId: "ANDROID-FCM-DIAGNOSIS", role: "Android팀", status: "in_progress", title: "알림 토글 비활성·FCM 정적 원인 진단", category: "team_progress", nextAction: "원인 범위 확정" },
  { eventId: "team-sync-ui-v01", workId: "UI-DESIGN-PLAYBOOK", role: "UI 디자인팀", status: "in_progress", title: "관리자 홈·예약 보드 디자인 플레이북 적용", category: "team_progress", nextAction: "적용 시안 제출" },
  { eventId: "team-sync-implementation-v01", workId: "CODEX-IMPLEMENTATION-VERIFY", role: "구현팀", status: "in_progress", title: "예약 보드 구조·관리자 홈·결제 알림 경로 수정/검증", category: "team_progress", nextAction: "수정 결과 검증" },
  { eventId: "team-sync-approval-deeplink-graph-v03", workId: "ADMIN-APPROVAL-DEEPLINK-GRAPH", parentWorkId: "OWNER-ADMIN-APPROVAL-GRAPH-REQUEST", role: "운영팀", status: "in_progress", title: "승인 딥링크와 마케팅 워크룸 그래프 구조 수정", category: "team_progress", nextAction: "홈→집중 승인→그래프 클릭 회귀 검증" },
  { eventId: "actual-workroom-owner-request-v02", eventType: "owner_request_received", workId: "OWNER-ACTUAL-WORKROOM-GRAPH", role: "운영팀", status: "received", title: "마케팅 워크룸에서 업무 흐름을 한눈에 확인", originalDirectiveSummary: "대표 요청부터 결과와 승인까지 비주얼 그래프로 확인", operationsDirectiveSummary: "실제 3000 관리자 경로에 그래프와 집중 승인 화면 구현", nextAction: "운영팀 지시 확인" },
  { eventId: "actual-workroom-operations-directive-v02", eventType: "operations_directive_sent", workId: "OPS-ACTUAL-WORKROOM-GRAPH", parentWorkId: "OWNER-ACTUAL-WORKROOM-GRAPH", role: "운영팀", status: "received", title: "마케팅 워크룸 비주얼 그래프 구현 지시", originalDirectiveSummary: "대표 요청을 안전한 업무 요약으로 접수", operationsDirectiveSummary: "그래프 기본 화면·Inspector·집중 승인 경로 구현", nextAction: "Codex 구현팀 착수" },
  { eventId: "actual-workroom-implementation-v02", workId: "ADMIN-ACTUAL-WORKROOM-GRAPH", parentWorkId: "OPS-ACTUAL-WORKROOM-GRAPH", role: "구현팀", status: "in_progress", title: "마케팅 워크룸 비주얼 그래프 실제 반영", category: "team_progress", originalDirectiveSummary: "대표 요청부터 하위 작업까지 그래프로 표시", operationsDirectiveSummary: "UI팀 구현 계약을 3000 관리자 화면에 적용", nextAction: "홈→승인→그래프 클릭 검증" },
  { eventId: "actual-workroom-result-v02", workId: "ADMIN-ACTUAL-WORKROOM-GRAPH-RESULT", parentWorkId: "ADMIN-ACTUAL-WORKROOM-GRAPH", role: "구현팀", status: "review", title: "그래프·집중 승인 화면 검증 결과", category: "team_progress", originalDirectiveSummary: "마케팅 워크룸 그래프 결과물 검수", operationsDirectiveSummary: "3000 실제 화면과 클릭 회귀 결과 제출", nextAction: "운영팀 검수", artifact: { title: "마케팅 워크룸 열기", url: "/admin/marketing" } },
  { eventId: "team-sync-android-device-v01", workId: "ANDROID-DEVICE-ACCESS", role: "Android팀", status: "not_started", title: "내부 테스트용 실제 기기·USB·Play 권한 계정 필요", category: "user_action", blockerSummary: "실제 기기·USB·Play 권한 계정 필요", nextAction: "테스트 환경 준비", approvalRequired: false },
];

for (const [index, definition] of definitions.entries()) {
  const timestamp = new Date(startedAt + index).toISOString();
  const event = {
    sequence: 100 + index,
    parentWorkId: null,
    source: "operations",
    eventSource: "manual",
    sourceThreadRef: null,
    eventType: definition.status === "completed" ? "agent_status_changed" : definition.category === "approval" ? "owner_approval_requested" : "agent_work_started",
    originalDirectiveSummary: definition.originalDirectiveSummary ?? definition.title,
    operationsDirectiveSummary: definition.operationsDirectiveSummary ?? definition.title,
    completedSummary: definition.completedSummary ?? null,
    blockerSummary: definition.blockerSummary ?? null,
    approvalRequired: definition.approvalRequired ?? false,
    artifact: definition.artifact ?? null,
    detailRows: definition.detailRows,
    sourceEventAt: timestamp,
    receivedAt: timestamp,
    ...definition,
  };
  const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", "x-workroom-bridge-token": bridgeToken }, body: JSON.stringify(event) });
  if (!response.ok) throw new Error(`${definition.eventId}: ${response.status}`);
}

console.log(JSON.stringify({ accepted: definitions.length, externalExecution: false }));
