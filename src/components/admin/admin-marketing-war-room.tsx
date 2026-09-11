"use client";

import { X } from "lucide-react";
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import AdminMarketingKpiPanel from "@/components/admin/admin-marketing-kpi-panel";
import AdminSectionNav from "@/components/admin/admin-section-nav";
import { ADMIN_TYPOGRAPHY } from "@/components/admin/admin-typography";
import { fetchApiJson } from "@/lib/api";
import type { MarketingAgentStatus } from "@/types/marketing-agent";
import type { MarketingKpiSnapshot } from "@/types/marketing-kpi";

const REFRESH_INTERVAL_MS = 10_000;
const KPI_REFRESH_INTERVAL_MS = 5 * 60_000;
const WORK_STEPS = ["UI 설계", "구현 담당", "UI 최종 검수", "완료"] as const;
const DECISION_OPTIONS = [
  { id: "approve", label: "승인" },
  { id: "revise", label: "수정" },
  { id: "hold", label: "보류" },
  { id: "reject", label: "반려" },
] as const;

type DecisionOption = (typeof DECISION_OPTIONS)[number]["id"];

export default function AdminMarketingWarRoom({
  sessionLoginId: _sessionLoginId,
}: {
  sessionLoginId: string;
}) {
  const [status, setStatus] = useState<MarketingAgentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<MarketingKpiSnapshot | null>(null);
  const [kpiError, setKpiError] = useState<string | null>(null);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [decisionOption, setDecisionOption] =
    useState<DecisionOption>("approve");
  const [decisionReason, setDecisionReason] = useState("");
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState("");
  const decisionTriggerRef = useRef<HTMLButtonElement>(null);
  const decisionDialogRef = useRef<HTMLDialogElement>(null);
  const firstDecisionRef = useRef<HTMLInputElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  const loadStatus = useCallback(async () => {
    try {
      const nextStatus = await fetchApiJson<MarketingAgentStatus>(
        "/api/admin/marketing/status",
        { cache: "no-store" },
      );
      setStatus(nextStatus);
      setError(null);
    } catch {
      setError("상태 API 응답을 확인하지 못했습니다.");
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
    } catch {
      setKpiError("KPI 집계 응답을 확인하지 못했습니다.");
    } finally {
      setKpiLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadKpis();
    const timer = window.setInterval(() => void loadKpis(), KPI_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [loadKpis]);

  const currentWork = status?.workflow.currentWork ?? null;
  const decisionStateUnknown = loading || Boolean(error) || !status;
  const decisionRequired =
    !decisionStateUnknown && (status.workflow.pendingApprovals ?? 0) > 0;
  const reviewUrl = status?.studio.url
    ? buildReviewUrl(status.studio.url)
    : null;

  const openDecisionDialog = () => {
    setDecisionOption("approve");
    setDecisionReason("");
    setDecisionError(null);
    decisionDialogRef.current?.showModal();
    window.requestAnimationFrame(() => firstDecisionRef.current?.focus());
  };

  const closeDecisionDialog = () => {
    decisionDialogRef.current?.close();
  };

  const handleDecisionSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const reasonRequired =
      decisionOption === "revise" || decisionOption === "reject";

    if (reasonRequired && !decisionReason.trim()) {
      setDecisionError("수정 또는 반려 사유를 입력해 주세요.");
      reasonRef.current?.focus();
      return;
    }

    if (decisionStateUnknown || !reviewUrl) {
      setDecisionError("검토 화면 연결 상태를 먼저 확인해 주세요.");
      return;
    }

    const decisionLabel =
      DECISION_OPTIONS.find((option) => option.id === decisionOption)?.label ??
      "선택한";
    window.open(reviewUrl, "_blank", "noopener,noreferrer");
    setLiveMessage(
      `검토 화면에서 '${decisionLabel}' 결정을 기존 검토 상태에 반영해 주세요.`,
    );
    closeDecisionDialog();
  };

  return (
    <main className="min-h-screen overflow-x-clip bg-[#f4f5f7] px-3 py-3 text-[#172033] sm:px-5 sm:py-6 lg:px-8 lg:py-8">
      <div className="mx-auto w-full max-w-[1440px] overflow-hidden rounded-[14px] border border-[#d9e0e8] bg-white">
        <header className="border-b border-[#e2e8f0] px-4 py-5 sm:px-6 lg:px-8">
          <h1 className={`tracking-[-0.03em] text-[#0f172a] ${ADMIN_TYPOGRAPHY.pageTitle}`}>
            워크룸
          </h1>
          <p className={`mt-2 max-w-3xl text-[#64748b] ${ADMIN_TYPOGRAPHY.body}`}>
            대표 요청과 현재 단계, 다음 행동, 핵심 KPI를 한눈에 확인합니다.
          </p>
          <div className="mt-4">
            <AdminSectionNav active="marketing" />
          </div>
        </header>

        <div className="px-4 py-5 sm:px-6 lg:px-8">
          <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
            <section
              aria-labelledby="current-marketing-work-heading"
              className="min-w-0 rounded-[10px] border border-[#dce2e8] bg-white p-4 sm:p-5"
            >
              <p className={`${ADMIN_TYPOGRAPHY.meta} text-[#64748b]`}>현재 업무</p>
              <h2
                id="current-marketing-work-heading"
                className={`mt-1 text-[#111827] ${ADMIN_TYPOGRAPHY.sectionTitle}`}
              >
                {currentWork ? "대표 요청 기록이 있습니다." : "현재 요청이 없습니다."}
              </h2>

              {currentWork ? (
                <>
                  <div className="mt-4 rounded-[8px] bg-[#f8fafc] px-4 py-3">
                    <p className={`${ADMIN_TYPOGRAPHY.meta} text-[#64748b]`}>
                      대표 요청
                    </p>
                    <p className={`mt-1 break-words text-[#1f2937] ${ADMIN_TYPOGRAPHY.bodyStrong}`}>
                      {currentWork.goal}
                    </p>
                  </div>
                  <WorkProgress />
                  <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    <WorkMeta label="현재 단계" value="진행 단계 확인 불가" />
                    <WorkMeta
                      label="쉬운 이유"
                      value="현재 조회 응답에는 UI 진행 단계 필드가 없습니다."
                    />
                    <WorkMeta
                      label="기다리는 팀"
                      value={decisionRequired ? "대표 결정 대기" : "확인 불가"}
                    />
                    <WorkMeta
                      label="다음 행동"
                      value={
                        decisionRequired
                          ? "대표 결정을 기존 검토 상태에 반영합니다."
                          : "실제 단계 정보가 연결되면 표시합니다."
                      }
                    />
                    <WorkMeta
                      label="대표 결정 여부"
                      value={
                        decisionStateUnknown
                          ? "확인 불가"
                          : decisionRequired
                            ? "필요"
                            : "불필요"
                      }
                    />
                    <WorkMeta
                      label="확인 시각"
                      value={formatCheckedAt(status?.checkedAt ?? null)}
                    />
                    <WorkMeta
                      label="근거"
                      value="unavailable · UI 진행 단계 필드 없음"
                      className="sm:col-span-2"
                    />
                  </dl>
                </>
              ) : (
                <div className="mt-4 rounded-[8px] border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-4 py-6">
                  <p className={`text-[#334155] ${ADMIN_TYPOGRAPHY.bodyStrong}`}>
                    현재 요청이 없습니다.
                  </p>
                  <p className={`mt-1 text-[#64748b] ${ADMIN_TYPOGRAPHY.body}`}>
                    새 요청이 접수되면 대표 요청, 현재 단계와 다음 행동을 여기에 표시합니다.
                  </p>
                </div>
              )}
            </section>

            <section
              aria-labelledby="representative-decision-heading"
              className="min-w-0 rounded-[10px] border border-[#dce2e8] bg-white p-4 sm:p-5"
            >
              <p className={`${ADMIN_TYPOGRAPHY.meta} text-[#64748b]`}>대표 결정</p>
              <h2
                id="representative-decision-heading"
                className={`mt-1 text-[#111827] ${ADMIN_TYPOGRAPHY.sectionTitle}`}
              >
                {decisionStateUnknown
                  ? loading
                    ? "결정 상태를 확인하고 있습니다."
                    : "결정 상태를 확인할 수 없습니다."
                  : decisionRequired
                    ? "결정이 필요한 요청이 있습니다."
                    : "추가 결정이 필요하지 않습니다."}
              </h2>
              <p className={`mt-3 text-[#64748b] ${ADMIN_TYPOGRAPHY.body}`}>
                {decisionStateUnknown
                  ? "작업 연결 상태를 확인한 뒤 다시 표시합니다."
                  : decisionRequired
                    ? `승인 대기 ${status.workflow.pendingApprovals}건을 확인해 주세요.`
                    : "확인된 승인 대기가 없습니다."}
              </p>

              {decisionRequired ? (
                <button
                  ref={decisionTriggerRef}
                  type="button"
                  onClick={openDecisionDialog}
                  className={`mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-[8px] bg-[#2563eb] px-4 text-white transition hover:bg-[#1d4ed8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 ${ADMIN_TYPOGRAPHY.control}`}
                >
                  결정하기
                </button>
              ) : null}

              <p className={`mt-4 border-t border-[#e2e8f0] pt-4 text-[#64748b] ${ADMIN_TYPOGRAPHY.helper}`}>
                광고·메시지·게시·예산은 자동 실행되지 않습니다.
              </p>
            </section>
          </div>

          <AdminMarketingKpiPanel
            snapshot={kpis}
            error={kpiError}
            loading={kpiLoading}
          />

          <details className="mt-5 border-t border-[#e2e8f0] pt-2">
            <summary
              className={`flex min-h-11 cursor-pointer items-center rounded-[8px] px-2 text-[#334155] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 ${ADMIN_TYPOGRAPHY.control}`}
            >
              상세 진단
            </summary>
            <div className="mt-2 grid min-w-0 gap-x-8 gap-y-4 rounded-[8px] bg-[#f8fafc] p-4 md:grid-cols-2">
              <DiagnosticItem
                label="작업 연결 상태"
                value={getWorkConnectionState(status, loading, error)}
              />
              <DiagnosticItem
                label="검토 상태"
                value={getReviewState(status, loading, error)}
              />
              <DiagnosticItem
                label="전달 상태"
                value={getDeliveryState(status, loading, error)}
              />
              <DiagnosticItem
                label="외부 실행"
                value={
                  status?.externalActionsEnabled
                    ? "활성"
                    : "광고·메시지·게시·예산 실행 없음"
                }
              />
              {error ? <DiagnosticItem label="상태 조회" value={error} /> : null}
              {kpiError ? <DiagnosticItem label="KPI 조회" value={kpiError} /> : null}
            </div>
          </details>
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {liveMessage}
      </p>

      <dialog
        ref={decisionDialogRef}
        aria-labelledby="decision-dialog-title"
        aria-describedby="decision-dialog-description"
        onCancel={(event) => {
          event.preventDefault();
          closeDecisionDialog();
        }}
        onClose={() => decisionTriggerRef.current?.focus()}
        className="m-auto w-[calc(100%-24px)] max-w-xl rounded-[14px] border border-[#d9e0e8] bg-white p-0 text-[#172033] shadow-[0_18px_48px_rgba(15,23,42,0.18)] backdrop:bg-[#0f172a]/35"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#e2e8f0] px-4 py-4 sm:px-5">
          <div>
            <h2
              id="decision-dialog-title"
              className={`text-[#111827] ${ADMIN_TYPOGRAPHY.sectionTitle}`}
            >
              대표 결정
            </h2>
            <p
              id="decision-dialog-description"
              className={`mt-1 text-[#64748b] ${ADMIN_TYPOGRAPHY.body}`}
            >
              선택은 기존의 안전한 검토 상태에서만 반영됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={closeDecisionDialog}
            aria-label="결정 창 닫기"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] text-[#64748b] hover:bg-[#f1f5f9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <form onSubmit={handleDecisionSubmit} className="px-4 py-5 sm:px-5">
          <fieldset>
            <legend className={`text-[#334155] ${ADMIN_TYPOGRAPHY.label}`}>
              결정
            </legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {DECISION_OPTIONS.map((option, index) => (
                <label
                  key={option.id}
                  className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-[8px] border px-3 ${ADMIN_TYPOGRAPHY.body} ${
                    decisionOption === option.id
                      ? "border-[#2563eb] bg-[#eff6ff] text-[#1d4ed8]"
                      : "border-[#d9e0e8] bg-white text-[#334155]"
                  }`}
                >
                  <input
                    ref={index === 0 ? firstDecisionRef : undefined}
                    type="radio"
                    name="marketing-decision"
                    value={option.id}
                    checked={decisionOption === option.id}
                    onChange={() => {
                      setDecisionOption(option.id);
                      setDecisionError(null);
                    }}
                    className="h-5 w-5 accent-[#2563eb]"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

          <label
            htmlFor="decision-reason"
            className={`mt-4 block text-[#334155] ${ADMIN_TYPOGRAPHY.label}`}
          >
            사유
            {decisionOption === "revise" || decisionOption === "reject"
              ? " · 필수"
              : " · 선택"}
          </label>
          <textarea
            ref={reasonRef}
            id="decision-reason"
            value={decisionReason}
            onChange={(event) => {
              setDecisionReason(event.target.value);
              setDecisionError(null);
            }}
            aria-invalid={decisionError ? true : undefined}
            aria-describedby={decisionError ? "decision-error" : undefined}
            className={`mt-2 min-h-24 w-full resize-y rounded-[8px] border border-[#cbd5e1] px-3 py-3 text-[#172033] outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe] ${ADMIN_TYPOGRAPHY.body}`}
            placeholder="수정 또는 반려일 때 사유를 입력해 주세요."
          />
          {decisionError ? (
            <p
              id="decision-error"
              role="alert"
              className={`mt-2 text-[#a04455] ${ADMIN_TYPOGRAPHY.body}`}
            >
              {decisionError}
            </p>
          ) : null}

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeDecisionDialog}
              className={`inline-flex min-h-11 items-center justify-center rounded-[8px] border border-[#cbd5e1] bg-white px-4 text-[#334155] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 ${ADMIN_TYPOGRAPHY.control}`}
            >
              닫기
            </button>
            <button
              type="submit"
              className={`inline-flex min-h-11 items-center justify-center rounded-[8px] bg-[#2563eb] px-4 text-white hover:bg-[#1d4ed8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 ${ADMIN_TYPOGRAPHY.control}`}
            >
              검토 화면에서 반영
            </button>
          </div>
        </form>
      </dialog>
    </main>
  );
}

function WorkProgress() {
  return (
    <div className="mt-4">
      <p className={`${ADMIN_TYPOGRAPHY.helper} text-[#64748b]`}>
        UI 설계 → 구현 담당 → UI 최종 검수 → 완료
      </p>
      <ol className="mt-2 grid gap-2 sm:grid-cols-4" aria-label="업무 진행 단계">
        {WORK_STEPS.map((step, index) => (
          <li
            key={step}
            className="flex min-h-11 items-center gap-2 rounded-[8px] border border-[#dce2e8] bg-white px-3 text-[#64748b]"
          >
            <span
              className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#cbd5e1] text-[#64748b] ${ADMIN_TYPOGRAPHY.badge}`}
              aria-hidden
            >
              {index + 1}
            </span>
            <span className={`min-w-0 ${ADMIN_TYPOGRAPHY.meta}`}>{step}</span>
          </li>
        ))}
      </ol>
      <p className={`mt-2 text-[#64748b] ${ADMIN_TYPOGRAPHY.helper}`}>
        과정 설명이며 현재 위치를 뜻하지 않습니다.
      </p>
    </div>
  );
}

function WorkMeta({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className={`${ADMIN_TYPOGRAPHY.meta} text-[#64748b]`}>{label}</dt>
      <dd className={`mt-1 break-words text-[#1f2937] ${ADMIN_TYPOGRAPHY.body}`}>
        {value}
      </dd>
    </div>
  );
}

function DiagnosticItem({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className={`${ADMIN_TYPOGRAPHY.meta} text-[#64748b]`}>{label}</p>
      <div className={`mt-1 break-words text-[#334155] ${ADMIN_TYPOGRAPHY.body}`}>
        {value}
      </div>
    </div>
  );
}

function getWorkConnectionState(
  status: MarketingAgentStatus | null,
  loading: boolean,
  error: string | null,
) {
  if (loading) return "확인 중";
  if (error || !status) return "확인 불가";
  if (status.studio.connected) return "작업 연결됨";
  if (status.studio.reachable) return "연결 확인 필요";
  if (status.studio.configured) return "연결 실패";
  return "연결 전";
}

function getReviewState(
  status: MarketingAgentStatus | null,
  loading: boolean,
  error: string | null,
) {
  if (loading) return "확인 중";
  if (error || !status) return "확인 불가";
  if (status.workflow.pendingApprovals > 0) {
    return `대표 결정 필요 ${status.workflow.pendingApprovals}건`;
  }
  if (!status.workflow.currentWork) return "검토할 요청 없음";
  if (status.workflow.currentWork.status === "running") return "요청 검토 중";
  if (status.workflow.currentWork.status === "suspended") return "대표 확인 필요";
  if (status.workflow.currentWork.status === "failed") return "검토 상태 확인 필요";
  if (status.workflow.currentWork.status === "unknown") return "확인 불가";
  return "검토 기록 확인됨";
}

function getDeliveryState(
  status: MarketingAgentStatus | null,
  loading: boolean,
  error: string | null,
) {
  if (loading) return "확인 중";
  if (error || !status) return "확인 불가";
  return status.codexBridge.packetReady
    ? "검토 자료 준비됨"
    : "수동 확인 필요";
}

function formatCheckedAt(value: string | null) {
  if (!value) return "확인 전";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "확인 전";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function buildReviewUrl(studioUrl: string) {
  return `${studioUrl.replace(/\/+$/, "")}/workflows/petmanagerGrowthReviewWorkflow/graph`;
}
