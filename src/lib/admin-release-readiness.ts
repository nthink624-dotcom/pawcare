export type ReleaseReadinessStatus = "blocked" | "approval" | "checking" | "ready";

export type ReleaseReadinessItem = {
  id: string;
  priority: "P0" | "P1" | "P2";
  status: ReleaseReadinessStatus;
  title: string;
  reason: string;
  nextAction: string;
  approval: string | null;
  evidenceAt: string;
  detail: string;
};

export type ReleaseReadinessSummary = {
  releaseStatus: "blocked" | "ready";
  counts: { p0: number; p1: number; approvals: number };
  important: Array<Omit<ReleaseReadinessItem, "detail">>;
  actions: string[];
  checkedAt: string;
  source: "local_snapshot";
  version: string;
};

const SNAPSHOT_AT = "2026-08-28T10:30:00+09:00";

export const RELEASE_READINESS_ITEMS: ReleaseReadinessItem[] = [
  {
    id: "high-risk-schema",
    priority: "P0",
    status: "blocked",
    title: "고위험 관리자 작업은 현재 실행할 수 없음",
    reason: "추가 인증과 이중 승인용 데이터베이스 변경이 운영에 적용됐는지 확인되지 않았습니다.",
    nextAction: "운영 DB 변경 승인 후 마이그레이션과 차단 검증을 별도 수행하세요.",
    approval: "운영 DB 변경 승인",
    evidenceAt: SNAPSHOT_AT,
    detail: "환불, 결제수단 초기화, 임시 비밀번호, 탈퇴는 확인 실패 시 차단하도록 코드와 마이그레이션 후보가 준비되어 있습니다. 운영 데이터베이스에는 아직 적용하지 않은 로컬 기준입니다.",
  },
  {
    id: "production-release",
    priority: "P0",
    status: "approval",
    title: "운영 반영 승인이 필요함",
    reason: "현재 변경은 로컬 후보이며 보호 브랜치와 운영 서비스에 반영되지 않았습니다.",
    nextAction: "로컬 검수 통과 후 대표가 운영 반영 여부를 한 번 결정하세요.",
    approval: "운영 반영 승인",
    evidenceAt: SNAPSHOT_AT,
    detail: "이 화면은 배포를 실행하지 않습니다. 승인 전에는 보호 브랜치 푸시, Production 배포, 운영 환경값 변경을 진행하지 않습니다.",
  },
  {
    id: "owner-login-runtime",
    priority: "P0",
    status: "checking",
    title: "오너 로그인 운영 검증이 남아 있음",
    reason: "운영 후보 코드는 포함했지만 실제 운영 인증 환경에서 최종 확인하지 않았습니다.",
    nextAction: "승인 전 로컬 회귀 검사를 마치고, 승인 후 운영 로그인 확인 범위를 정하세요.",
    approval: "운영 인증 확인 승인",
    evidenceAt: SNAPSHOT_AT,
    detail: "로그인 전달 제거, 결제 완료 복구, 새로고침 복구 커밋을 기준선에 포함했습니다. 운영 Auth에는 쓰기 작업을 하지 않았습니다.",
  },
  {
    id: "local-build",
    priority: "P1",
    status: "checking",
    title: "로컬 빌드와 회귀 검사가 필요함",
    reason: "기준선 병합 뒤 전체 빌드 결과가 아직 기록되지 않았습니다.",
    nextAction: "신뢰성 회귀 검사와 Next.js 빌드를 로컬에서 실행하세요.",
    approval: null,
    evidenceAt: SNAPSHOT_AT,
    detail: "로컬 검사는 외부 상태를 바꾸지 않으며 승인 없이 수행할 수 있습니다. 실패하면 운영 반영을 계속 차단합니다.",
  },
  {
    id: "responsive-qa",
    priority: "P1",
    status: "checking",
    title: "관리자 화면 반응형 검수가 필요함",
    reason: "1440px, 1024px, 390px 실제 화면 검수 기록이 아직 없습니다.",
    nextAction: "세 너비에서 가로 넘침, 기본 노출, 키보드 조작을 확인하세요.",
    approval: null,
    evidenceAt: SNAPSHOT_AT,
    detail: "P0와 승인 항목은 접지 않고 표시하며, 상세 근거만 요청 시 불러오는지 네트워크 요청 수와 함께 확인합니다.",
  },
  {
    id: "payment-verification",
    priority: "P2",
    status: "approval",
    title: "실결제 확인은 별도 승인이 필요함",
    reason: "로컬 검사는 실제 결제 승인과 환불을 대신할 수 없습니다.",
    nextAction: "출시 직전 대표가 최소 실결제 검증 여부를 결정하세요.",
    approval: "실결제 비용 승인",
    evidenceAt: SNAPSHOT_AT,
    detail: "승인 전에는 실결제, 실제 환불, 비용이 발생하는 외부 제공자 호출을 실행하지 않습니다.",
  },
];

export function getReleaseReadinessSummary(): ReleaseReadinessSummary {
  const important = RELEASE_READINESS_ITEMS.filter((item) => item.priority !== "P2").slice(0, 5);
  return {
    releaseStatus: RELEASE_READINESS_ITEMS.some((item) => item.priority === "P0" && item.status !== "ready") ? "blocked" : "ready",
    counts: {
      p0: RELEASE_READINESS_ITEMS.filter((item) => item.priority === "P0" && item.status !== "ready").length,
      p1: RELEASE_READINESS_ITEMS.filter((item) => item.priority === "P1" && item.status !== "ready").length,
      approvals: RELEASE_READINESS_ITEMS.filter((item) => item.approval).length,
    },
    important: important.map(({ detail: _detail, ...item }) => item),
    actions: ["로컬 회귀 검사와 빌드 완료", "세 너비 UI·키보드 검수", "검수 결과로 운영 반영 결정"],
    checkedAt: SNAPSHOT_AT,
    source: "local_snapshot",
    version: "release-readiness-20260828-r1",
  };
}
