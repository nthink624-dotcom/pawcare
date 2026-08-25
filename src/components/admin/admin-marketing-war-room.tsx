"use client";

import {
  Activity,
  ArrowLeft,
  Bot,
  ExternalLink,
  GitPullRequestArrow,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { fetchApiJson } from "@/lib/api";
import { getDotIndicatorClass } from "@/components/owner-web/status-indicators";
import type { MarketingAgentStatus } from "@/types/marketing-agent";

const REFRESH_INTERVAL_MS = 10_000;

export default function AdminMarketingWarRoom({
  sessionLoginId,
}: {
  sessionLoginId: string;
}) {
  const [status, setStatus] = useState<MarketingAgentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
    <main className="min-h-screen bg-[#f4f6f5] px-4 py-4 text-[#172033] md:px-6">
      <div className="mx-auto w-full max-w-[1240px]">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-semibold text-[#1f6b5b]">마케팅 워룸</p>
              <span className="rounded-full border border-[#dbe2ea] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#607080]">
                {environmentLabel} · 상태 조회 전용
              </span>
            </div>
            <h1 className="mt-0.5 text-[24px] font-semibold tracking-[-0.03em] text-[#0f172a]">
              성장팀 실행 현황
            </h1>
            <p className="mt-1 text-[13px] text-[#64748b]">접속 관리자 · {sessionLoginId}</p>
          </div>
          <Link
            href="/admin"
            className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[13px] font-semibold text-[#334155] hover:bg-[#f8fafc]"
          >
            <ArrowLeft className="h-4 w-4" />
            관리자 메인
          </Link>
        </header>

        {error ? (
          <p className="mt-4 rounded-[8px] border border-[#f0d1d1] bg-[#fff7f7] px-3 py-2 text-[13px] text-[#a04455]">
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
            value="잠김"
            tone="warning"
            detail={status?.ai.keyConfigured ? "키는 감지됐지만 POC 호출은 비활성입니다." : "키·과금 승인 전 호출하지 않습니다."}
          />
          <StatusCard
            icon={GitPullRequestArrow}
            label="Codex 연결"
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

        <section className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <div className="rounded-[10px] border border-[#e2e8f0] bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[12px] font-semibold text-[#1f6b5b]">현재 워크플로</p>
                <h2 className="mt-1 text-[18px] font-semibold text-[#111827]">
                  {status?.workflow.label ?? "측정 신호 → Codex 검토 → 사람 승인"}
                </h2>
                <p className="mt-1 font-mono text-[12px] text-[#64748b]">
                  {status?.workflow.id ?? "petmanager-growth-review"}
                </p>
              </div>
              {status?.studio.reachable && status.studio.url ? (
                <a
                  href={status.studio.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-[#1f6b5b] px-3 text-[13px] font-semibold text-white hover:bg-[#195a4d]"
                >
                  고급 보기 · Studio
                  <ExternalLink className="h-4 w-4" />
                </a>
              ) : null}
            </div>
            {status?.workflow.currentWork ? (
              <div className="mt-5 rounded-[8px] border border-[#ead7b6] bg-[#fffbf3] px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[14px] font-semibold text-[#334155]">
                    {status.workflow.currentWork.goal}
                  </p>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-[#8a5c18]">
                    {formatRunStatus(status.workflow.currentWork.status)}
                  </span>
                </div>
                <p className="mt-2 font-mono text-[12px] text-[#64748b]">
                  {status.workflow.currentWork.workItemId} · {status.workflow.currentWork.runId}
                </p>
                <p className="mt-1 text-[12px] text-[#94a3b8]">
                  마지막 변경 {formatCheckedAt(status.workflow.currentWork.lastChangedAt)}
                </p>
              </div>
            ) : (
              <div className="mt-5 rounded-[8px] border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-4 py-8 text-center">
                <p className="text-[14px] font-semibold text-[#334155]">실행 중인 작업 없음</p>
                <p className="mt-1 text-[12px] text-[#64748b]">
                  Mastra Studio에서 워크플로를 시작하면 실행 단계와 승인 대기를 확인할 수 있습니다.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Panel title="성장팀 ↔ Codex">
              <p className="text-[13px] text-[#64748b]">
                {status?.codexBridge.packetReady
                  ? "성장팀 검토 패킷이 준비됐습니다."
                  : "아직 자동으로 주고받은 메시지가 없습니다."}
              </p>
              <p className="mt-2 text-[12px] leading-5 text-[#94a3b8]">
                현재는 워크플로가 검토 질문·근거 링크를 묶고, Codex 작업에서 사람이 전달하는 단계입니다.
              </p>
            </Panel>
            <Panel title="사람 승인 필요">
              <p className="text-[13px] text-[#64748b]">
                {status?.workflow.pendingApprovals
                  ? `${status.workflow.pendingApprovals}건이 Mastra Studio에서 결정을 기다리고 있습니다.`
                  : "대기 중인 승인이 없습니다."}
              </p>
              <p className="mt-2 text-[12px] leading-5 text-[#94a3b8]">
                승인은 워크플로 검토 상태만 바꾸며 외부 실행은 하지 않습니다.
              </p>
            </Panel>
          </div>
        </section>

        <footer className="mt-3 rounded-[8px] border border-[#ead7b6] bg-[#fffbf3] px-4 py-3 text-[12px] leading-5 text-[#8a5c18]">
          광고·메시지·게시·예산 변경 기능 없음 · 실제 KPI 미연결 · Production 데이터 변경 없음
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
    <section className="mt-4 rounded-[10px] border border-[#cfe3dc] bg-[#f5faf8] p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[12px] font-semibold text-[#1f6b5b]">30초 사용법</p>
          <h2 className="mt-0.5 text-[16px] font-semibold text-[#0f172a]">딱 3단계만 하면 됩니다</h2>
        </div>
        <p className="text-[11px] text-[#607080]">Studio는 상세 확인이 필요할 때만 엽니다.</p>
      </div>
      <ol className="mt-3 grid gap-2 md:grid-cols-3">
        {steps.map((step) => (
          <li key={step.number} className="rounded-[8px] border border-[#dbe7e2] bg-white px-3 py-3">
            <div className="flex items-start gap-2.5">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1f6b5b] text-[12px] font-semibold text-white">
                {step.number}
              </span>
              <div>
                <p className="text-[13px] font-semibold text-[#1f2937]">{step.title}</p>
                <p className="mt-1 text-[12px] leading-5 text-[#64748b]">{step.detail}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[11px] leading-5 text-[#607080]">
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
    <div className="rounded-[10px] border border-[#e2e8f0] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] bg-[#edf6f2] text-[#1f6b5b]">
          <Icon className="h-4 w-4" />
        </span>
        <span className={dotClass} aria-hidden="true" />
      </div>
      <p className="mt-3 text-[12px] text-[#64748b]">{label}</p>
      <p className="mt-0.5 text-[17px] font-semibold text-[#111827]">{value}</p>
      <p className="mt-1 min-h-10 text-[12px] leading-5 text-[#64748b]">{detail}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[10px] border border-[#e2e8f0] bg-white p-4">
      <h2 className="text-[14px] font-semibold text-[#111827]">{title}</h2>
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
