import type { AdminAccount } from "@/server/admin-account";
import { AdminApiError } from "@/server/admin-api-auth";
import type { AdminHighRiskAction } from "@/lib/admin-high-risk-contract";

export { ADMIN_HIGH_RISK_ACTIONS_READY, ADMIN_HIGH_RISK_SCOPE_MATRIX, hashHighRiskApprovalPayload, validateHighRiskApproval } from "@/lib/admin-high-risk-contract";

export function assertAdminHighRiskActionReady(_action: AdminHighRiskAction, _account: AdminAccount): never {
  // The role/scope, step-up, two-person approval, and durable saga stores do not
  // exist in the active environment yet. An authenticated request must fail as
  // unavailable, not as a known authorization denial.
  throw new AdminApiError("고위험 작업의 권한·추가 인증·2인 승인·실행 원장이 아직 준비되지 않았습니다.", 503);
}
