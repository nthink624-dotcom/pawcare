import type { AdminHighRiskAction } from "@/lib/admin-high-risk-contract";
import type { AdminAccount } from "@/server/admin-account";
import { AdminApiError } from "@/server/admin-api-auth";

export function assertAdminHighRiskActionReady(_action: AdminHighRiskAction, account: AdminAccount): never {
  if (!account.isActive || !account.isSuperAdmin) {
    throw new AdminApiError("이 고위험 작업을 실행할 관리자 권한이 없습니다.", 403);
  }

  // 최근 재인증과 2인 승인, 내구성 실행 원장이 모두 연결되기 전에는
  // super-admin도 실제 provider/Auth/DB 작업을 실행할 수 없다.
  throw new AdminApiError("고위험 작업은 최근 재인증과 2인 승인 정책이 준비될 때까지 비활성화됩니다.", 503);
}
