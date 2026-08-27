"use client";

import { useEffect, useState } from "react";
import ContentApprovalFocus from "@/components/admin/content-approval-focus";
import RetentionPolicyApprovalFocus from "@/components/admin/retention-policy-approval-focus";
import SecurityApprovalFocus from "@/components/admin/security-approval-focus";
import { fetchApiJson } from "@/lib/api";
import type { ControlPlaneNode, ControlPlaneSnapshot } from "@/types/agent-control-plane";

export default function FocusedApprovalRoute({ approvalId }: { approvalId: string }) {
  const [node, setNode] = useState<ControlPlaneNode | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => { if (["GROWTH-CONTENT-D1-D7-REVIEW", "RETENTION-POLICY-V01"].includes(approvalId)) return; const timer = window.setTimeout(() => { void fetchApiJson<ControlPlaneSnapshot>("/api/admin/marketing/demo-control-plane", { cache: "no-store" }).then((snapshot) => { setNode(snapshot.nodes.find((item) => item.workId === approvalId) ?? null); setError(false); }).catch(() => setError(true)); }, 0); return () => window.clearTimeout(timer); }, [approvalId]);
  if (approvalId === "GROWTH-CONTENT-D1-D7-REVIEW") return <ContentApprovalFocus />;
  if (approvalId === "RETENTION-POLICY-V01") return <RetentionPolicyApprovalFocus />;
  if (approvalId === "SECURITY-PRICE-SOURCE-RETENTION" && node) return <SecurityApprovalFocus node={node} />;
  return <main className="grid h-[100dvh] place-items-center bg-white text-[16px] text-[#111111]"><p>{error ? "승인 자료를 불러올 수 없습니다." : "승인 자료를 확인하는 중입니다."}</p></main>;
}
