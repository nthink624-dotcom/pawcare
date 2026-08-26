import "server-only";

import { applyMarketingDecision, buildMarketingWarRoomSnapshot } from "@/lib/marketing-war-room-contract";
import type { MarketingApprovalDecision, MarketingApprovalGateId, MarketingAuditEntry, MarketingNodeStatus } from "@/types/marketing-war-room";

const statuses: Partial<Record<string, MarketingNodeStatus>> = {};
const auditHistory: MarketingAuditEntry[] = [];

export function getMarketingWarRoom(representative: boolean) {
  return buildMarketingWarRoomSnapshot({ representative, statuses, auditHistory: [...auditHistory] });
}

export function decideMarketingApproval(input: {
  representative: boolean;
  gateId: MarketingApprovalGateId;
  decision: MarketingApprovalDecision;
}) {
  if (!input.representative) throw new Error("REPRESENTATIVE_REQUIRED");
  const snapshot = getMarketingWarRoom(true);
  const result = applyMarketingDecision({ ...input, snapshot, now: new Date().toISOString() });
  statuses[input.gateId] = result.nextStatus;
  auditHistory.unshift(result.audit);
  return getMarketingWarRoom(true);
}
