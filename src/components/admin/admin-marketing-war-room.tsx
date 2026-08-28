"use client";

import {
  Activity,
  Bot,
  ExternalLink,
  GitPullRequestArrow,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import AdminSectionNav from "@/components/admin/admin-section-nav";
import { ADMIN_TYPOGRAPHY } from "@/components/admin/admin-typography";
import { fetchApiJson } from "@/lib/api";
import AdminMarketingKpiPanel from "@/components/admin/admin-marketing-kpi-panel";
import { getDotIndicatorClass } from "@/components/owner-web/status-indicators";
import type { MarketingAgentStatus } from "@/types/marketing-agent";
import type { MarketingKpiSnapshot } from "@/types/marketing-kpi";

const REFRESH_INTERVAL_MS = 10_000;
const KPI_REFRESH_INTERVAL_MS = 5 * 60_000;

export default function AdminMarketingWarRoom({
  sessionLoginId,
}: {
  sessionLoginId: string;
}) {
  const [status, setStatus] = useState<MarketingAgentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<MarketingKpiSnapshot | null>(null);
  const [kpiError, setKpiError] = useState<string | null>(null);
  const [kpiLoading, setKpiLoading] = useState(true);

  const loadStatus = useCallback(async () => {
    try {
      const nextStatus = await fetchApiJson<MarketingAgentStatus>(
        "/api/admin/marketing/status",
        { cache: "no-store" },
      );
      setStatus(nextStatus);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "마케팅 워룸 상태를 확인하지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
    const timer = window.setInterval(() => void loadStatus(), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [loadStatus]);

  const loadKpis = useCallback(async () => {
    try {
      const nextKpis = await fetchApiJson<MarketingKpiSnapshot>(
        "/api/admin/marketing/kpis?days=7",
        { cache: "no-store" },
      );
      setKpis(nextKpis);
      setKpiError(null);
    } catch (loadError) {
      setKpiError(
        loadError instanceof Error
          ? loadError.message
          : "마케팅 운영 KPI를 확인하지 못했습니다.",
      );
    } finally {
      setKpiLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadKpis();
    const timer = window.setInterval(() => void loadKpis(), KPI_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [loadKpis]);

  const studioState = loading
    ? "확인 중"
    : status?.studio.connected
      ? "API 연결됨"
      : status?.studio.reachable
        ? "Cloud 도달"
        : status?.studio.configured
          ? "연결 실패"
          : "미설정";

  const environmentLabel =
    status?.mode === "cloud-poc"
      ? "Cloud POC"
      : status?.mode === "local-poc"
        ? "로컬 POC"
        : "연결 전";

  return (
    <main className="min-h-screen bg-[#f4f7fb] px-5 py-6 text-[#172033] lg:px-8 lg:py-8">
      <div className="mx-auto w-full max-w-[1440px]">
        <header className="rounded-[20px] border border-[#dce5f0] bg-white px-6 py-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)] lg:px-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className={`${ADMIN_TYPOGRAPHY.meta} text-[#2563eb]`}>MARKETING WAR ROOM</p>
                <span className={`rounded-full border border-[#dbe2ea] bg-[#f8fafc] px-2.5 py-1 text-[#607080] ${ADMIN_TYPOGRAPHY.badge}`}>
                  {environmentLabel} · 상태 조회 전용
                </span>
              </div>
              <h1 className={`mt-1 tracking-[-0.03em] text-[#0f172a] ${ADMIN_TYPOGRAPHY.pageTitle}`}>성장팀 실행 현황</h1>
              <p className={`mt-2 text-[#64748b] ${ADMIN_TYPOGRAPHY.body}`}>접속 관리자 · {sessionLoginId}</p>
            </div>
          </div>
          <div className="mt-5 border-t border-[#edf2f7] pt-5">
            <AdminSectionNav active="marketing" />
          </div>
        </header>

        {error ? (
          <p className={`mt-4 rounded-[12px] border border-[#f0d1d1] bg-[#fff7f7] px-4 py-3 text-[#a04455] ${ADMIN_TYPOGRAPHY.body}`}>
            {error}
          </p>
        ) : null}

        <QuickUsageGuide />

        <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatusCard
            icon={Activity}
            label="Mastra 연결"
            value={studioState}
            tone={status?.studio.connected ? "success" : status?.studio.reachable ? "warning" : "neutral"}
            detail={status?.studio.message ?? "연결 상태를 확인하고 있습니다."}
          />
          <StatusCard
            icon={Bot}
            label="AI 실행"
            value="자동 실행 안 함"
            tone="warning"
            detail={status?.ai.keyConfigured ? "키는 감지됐지만 POC 호출은 비활성입니다." : "키·과금 승인 전 호출하지 않습니다."}
          />
          <StatusCard
            icon={GitPullRequestArrow}
            label="Codex 전달"
            value={status?.codexBridge.packetReady ? "검토 패킷 준비" : "수동 핸드오프"}
            tone={status?.codexBridge.packetReady ? "warning" : "neutral"}
            detail={status?.codexBridge.message ?? "구조화된 검토 패킷을 확인하고 있습니다."}
          />
          <StatusCard
            icon={ShieldCheck}
            label="승인 대기"
            value={`${status?.workflow.pendingApprovals ?? 0}건`}
            tone="neutral"
            detail="저장된 실제 승인 건만 표시합니다."
          />
        </section>

        <AdminMarketingKpiPanel snapshot={kpis} error={kpiError} loading={kpiLoading} />

        <section className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
          <div className="rounded-[16px] border border-[#dce5f0] bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className={`${ADMIN_TYPOGRAPHY.meta} text-[#2563eb]`}>현재 워크플로</p>
                <h2 className={`mt-1 text-[#111827] ${ADMIN_TYPOGRAPHY.sectionTitle}`}>
                  {status?.workflow.label ?? "측정 신호 → Codex 검토 → 사람 승인"}
                </h2>
                <p className={`mt-1 font-mono text-[#64748b] ${ADMIN_TYPOGRAPHY.meta}`}>
                  {status?.workflow.id ?? "petmanager-growth-review"}
                </p>
              </div>
              {status?.studio.reachable && status.studio.url ? (
                <a
                  href={buildStudioWorkflowUrl(status.studio.url)}
                  target="_blank"
                  rel="noreferrer"
                  className={`inline-flex h-11 items-center gap-1.5 rounded-[8px] bg-[#2563eb] px-4 text-white hover:bg-[#1d4ed8] ${ADMIN_TYPOGRAPHY.control}`}
                >
                  고급 보기 · Studio
                  <ExternalLink className="h-4 w-4" />
                </a>
              ) : null}
            </div>
            {status?.workflow.currentWork ? (
              <div className="mt-5 rounded-[8px] border border-[#ead7b6] bg-[#fffbf3] px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className={`${ADMIN_TYPOGRAPHY.bodyStrong} text-[#334155]`}>
                    {status.workflow.currentWork.goal}
                  </p>
                  <span className={`rounded-full bg-white px-2.5 py-1 text-[#8a5c18] ${ADMIN_TYPOGRAPHY.badge}`}>
                    {formatRunStatus(status.workflow.currentWork.status)}
                  </span>
                </div>
                <p className={`mt-2 font-mono text-[#64748b] ${ADMIN_TYPOGRAPHY.meta}`}>
                  {status.workflow.currentWork.workItemId} · {status.workflow.currentWork.runId}
                </p>
                <p className={`mt-1 text-[#94a3b8] ${ADMIN_TYPOGRAPHY.helper}`}>
                  마지막 변경 {formatCheckedAt(status.workflow.currentWork.lastChangedAt)}
                </p>
              </div>
            ) : (
              <div className="mt-5 rounded-[8px] border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-4 py-8 text-center">
                <p className={`${ADMIN_TYPOGRAPHY.bodyStrong} text-[#334155]`}>실행 중인 작업 없음</p>
                <p className={`mt-1 text-[#64748b] ${ADMIN_TYPOGRAPHY.body}`}>
                  Mastra Studio에서 워크플로를 시작하면 실행 단계와 승인 대기를 확인할 수 있습니다.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Panel title="성장팀 → Codex">
              <p className={`${ADMIN_TYPOGRAPHY.body} text-[#64748b]`}>
                {status?.codexBridge.packetReady
                  ? "성장팀 검토 패킷이 준비됐습니다."
                  : "아직 자동으로 주고받은 메시지가 없습니다."}
              </p>
              <p className={`mt-2 text-[#94a3b8] ${ADMIN_TYPOGRAPHY.helper}`}>
                현재는 워크플로가 검토 질문·근거 링크를 묶고, Codex 작업에서 사람이 전달하는 단계입니다.
              </p>
            </Panel>
            <Panel title="사람 승인 필요">
              <p className={`${ADMIN_TYPOGRAPHY.body} text-[#64748b]`}>
                {status?.workflow.pendingApprovals
                  ? `${status.workflow.pendingApprovals}건이 Mastra Studio에서 결정을 기다리고 있습니다.`
                  : "대기 중인 승인이 없습니다."}
              </p>
              <p className={`mt-2 text-[#94a3b8] ${ADMIN_TYPOGRAPHY.helper}`}>
                승인은 워크플로 검토 상태만 바꾸며 외부 실행은 하지 않습니다.
              </p>
            </Panel>
          </div>
        </section>

        <footer className={`mt-4 rounded-[12px] border border-[#ead7b6] bg-[#fffbf3] px-4 py-3 text-[#8a5c18] ${ADMIN_TYPOGRAPHY.helper}`}>
          광고·메시지·게시·예산 변경 기능 없음 · 운영 KPI 읽기 전용 연결 · 랜딩/CTA/UTM 계측 미연결 · Production 데이터 변경 없음
          {status?.checkedAt ? ` · 마지막 확인 ${formatCheckedAt(status.checkedAt)}` : ""}
        </footer>
      </div>
    </main>
  );
}

function QuickUsageGuide() {
  const steps = [
    {
      number: "1",
      title: "이 채팅에 요청",
      detail: "“성장팀, [목표] 분석 시작해줘”라고 말합니다.",
    },
    {
      number: "2",
      title: "워룸 확인",
      detail: "현재 작업과 승인 대기 건수를 봅니다.",
    },
    {
      number: "3",
      title: "이 채팅에 결정",
      detail: "승인 · 수정: 내용 · 보류 · 반려 중 하나를 말합니다.",
    },
  ];

  return (
    <section className="mt-6 rounded-[16px] border border-[#bfdbfe] bg-[#eff6ff] p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className={`${ADMIN_TYPOGRAPHY.meta} text-[#2563eb]`}>30초 사용법</p>
          <h2 className={`mt-1 text-[#0f172a] ${ADMIN_TYPOGRAPHY.sectionTitle}`}>딱 3단계만 하면 됩니다</h2>
        </div>
        <p className={`${ADMIN_TYPOGRAPHY.helper} text-[#607080]`}>Studio는 상세 확인이 필요할 때만 엽니다.</p>
      </div>
      <ol className="mt-3 grid gap-2 md:grid-cols-3">
        {steps.map((step) => (
          <li key={step.number} className="rounded-[8px] border border-[#dbe7e2] bg-white px-3 py-3">
            <div className="flex items-start gap-2.5">
              <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2563eb] text-white ${ADMIN_TYPOGRAPHY.badge}`}>
                {step.number}
              </span>
              <div>
                <p className={`${ADMIN_TYPOGRAPHY.bodyStrong} text-[#1f2937]`}>{step.title}</p>
                <p className={`mt-1 text-[#64748b] ${ADMIN_TYPOGRAPHY.body}`}>{step.detail}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <p className={`mt-3 text-[#607080] ${ADMIN_TYPOGRAPHY.helper}`}>
        승인해도 지금은 광고·메시지·예산 변경이 자동 실행되지 않습니다.
      </p>
    </section>
  );
}

function StatusCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  detail: string;
  tone: "success" | "warning" | "neutral";
}) {
  const dotClass = getDotIndicatorClass(
    tone === "success" ? "confirmed" : tone === "warning" ? "amber" : "neutral",
  );

  return (
    <div className="rounded-[16px] border border-[#dce5f0] bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-[12px] bg-[#eff6ff] text-[#2563eb]">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <span className={dotClass} aria-hidden="true" />
      </div>
      <p className={`mt-3 text-[#64748b] ${ADMIN_TYPOGRAPHY.meta}`}>{label}</p>
      <p className={`mt-1 text-[#111827] ${ADMIN_TYPOGRAPHY.sectionTitle}`}>{value}</p>
      <p className={`mt-1 min-h-10 text-[#64748b] ${ADMIN_TYPOGRAPHY.body}`}>{detail}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[16px] border border-[#dce5f0] bg-white p-5">
      <h2 className={`${ADMIN_TYPOGRAPHY.sectionTitle} text-[#111827]`}>{title}</h2>
      <div className="mt-3 rounded-[8px] bg-[#f8fafc] px-3 py-3">{children}</div>
    </div>
  );
}

function formatCheckedAt(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function buildStudioWorkflowUrl(studioUrl: string) {
  return `${studioUrl.replace(/\/+$/, "")}/workflows/petmanagerGrowthReviewWorkflow/graph`;
}

function formatRunStatus(
  status: NonNullable<MarketingAgentStatus["workflow"]["currentWork"]>["status"],
) {
  const labels = {
    running: "실행 중",
    suspended: "승인 대기",
    success: "완료",
    failed: "실패",
    unknown: "확인 중",
  } as const;
  return labels[status];
}
