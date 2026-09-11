"use client";

import { RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import AdminSectionNav from "@/components/admin/admin-section-nav";
import { ADMIN_TYPOGRAPHY } from "@/components/admin/admin-typography";
import { fetchApiJson } from "@/lib/api";
import {
  testerFeedbackCategories,
  testerFeedbackCategoryLabels,
  testerFeedbackScreenLabels,
  testerFeedbackStatuses,
  testerFeedbackStatusLabels,
  type TesterFeedbackCategory,
  type TesterFeedbackItem,
  type TesterFeedbackStatus,
} from "@/lib/tester-feedback";

type CategoryFilter = "all" | TesterFeedbackCategory;
type StatusFilter = "all" | TesterFeedbackStatus;
type LoadState = "loading" | "ready" | "error";

function formatDateTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "시간 확인 필요";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(date);
}

export default function AdminTesterFeedbackScreen({
  initialFeedback,
}: {
  initialFeedback?: TesterFeedbackItem[];
}) {
  const fixtureMode = initialFeedback !== undefined;
  const [feedback, setFeedback] = useState<TesterFeedbackItem[]>(initialFeedback ?? []);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loadState, setLoadState] = useState<LoadState>(fixtureMode ? "ready" : "loading");
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingDecisionId, setSavingDecisionId] = useState<string | null>(null);

  const loadFeedback = useCallback(async () => {
    if (fixtureMode) return;
    setLoadState("loading");
    try {
      const result = await fetchApiJson<{ feedback: TesterFeedbackItem[] }>(
        "/api/admin/tester-feedback?limit=100",
        { cache: "no-store" },
      );
      setFeedback(result.feedback);
      setError(null);
      setLoadState("ready");
    } catch {
      setError("테스터 피드백을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setLoadState("error");
    }
  }, [fixtureMode]);

  useEffect(() => {
    if (fixtureMode) return;
    const frame = window.requestAnimationFrame(() => void loadFeedback());
    return () => window.cancelAnimationFrame(frame);
  }, [fixtureMode, loadFeedback]);

  const visibleFeedback = useMemo(
    () => feedback.filter((item) =>
      (categoryFilter === "all" || item.category === categoryFilter) &&
      (statusFilter === "all" || item.status === statusFilter)),
    [categoryFilter, feedback, statusFilter],
  );
  const testerDecisionFeedbackIds = useMemo(() => {
    const seenShops = new Set<string>();
    const ids = new Set<string>();
    for (const item of feedback) {
      if (!item.tester.isTester || seenShops.has(item.shopId)) continue;
      seenShops.add(item.shopId);
      ids.add(item.id);
    }
    return ids;
  }, [feedback]);

  async function changeStatus(item: TesterFeedbackItem, status: TesterFeedbackStatus) {
    if (item.status === status) return;
    if (fixtureMode) {
      setFeedback((current) => current.map((entry) =>
        entry.id === item.id ? { ...entry, status, updatedAt: new Date().toISOString() } : entry));
      return;
    }
    setSavingId(item.id);
    setError(null);
    try {
      const result = await fetchApiJson<{ feedback: TesterFeedbackItem }>("/api/admin/tester-feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedbackId: item.id, status }),
      });
      setFeedback((current) => current.map((entry) => entry.id === item.id ? result.feedback : entry));
    } catch {
      setError("피드백 상태를 저장하지 못했습니다. 입력한 피드백은 그대로 보존됩니다.");
    } finally {
      setSavingId(null);
    }
  }

  async function decideAccess(item: TesterFeedbackItem, decision: "extend_3_days" | "end" | "convert") {
    if (!item.tester.isTester) return;
    if (fixtureMode) {
      setFeedback((current) => current.map((entry) => {
        if (entry.id !== item.id) return entry;
        const nextDue = decision === "extend_3_days"
          ? new Date(Math.max(Date.now(), Date.parse(entry.tester.reviewDueAt ?? "")) + 3 * 86_400_000).toISOString()
          : entry.tester.reviewDueAt;
        return {
          ...entry,
          tester: {
            ...entry.tester,
            displayState: decision === "end" ? "ended" : decision === "convert" ? "converted" : "active",
            reviewDueAt: nextDue,
            noticeKey: null,
            noticeLabel: null,
          },
        };
      }));
      return;
    }
    setSavingDecisionId(item.id);
    setError(null);
    try {
      await fetchApiJson("/api/admin/tester-feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "tester_access",
          feedbackId: item.id,
          decision,
          requestId: crypto.randomUUID(),
        }),
      });
      await loadFeedback();
    } catch {
      setError("테스트 기간 결정을 저장하지 못했습니다. 기존 상태는 그대로 유지됩니다.");
    } finally {
      setSavingDecisionId(null);
    }
  }

  async function openScreenshot(item: TesterFeedbackItem) {
    if (!item.screenshot.attached || fixtureMode) return;
    try {
      const result = await fetchApiJson<{ signedUrl: string }>(
        `/api/admin/tester-feedback?screenshotFeedbackId=${encodeURIComponent(item.id)}`,
        { cache: "no-store" },
      );
      window.open(result.signedUrl, "_blank", "noopener,noreferrer");
    } catch {
      setError("스크린샷을 불러오지 못했습니다. 다시 시도해 주세요.");
    }
  }

  async function removeScreenshot(item: TesterFeedbackItem) {
    if (!item.screenshot.attached) return;
    if (fixtureMode) {
      setFeedback((current) => current.map((entry) => entry.id === item.id
        ? { ...entry, screenshot: { ...entry.screenshot, attached: false, deletedAt: new Date().toISOString() } }
        : entry));
      return;
    }
    setSavingDecisionId(item.id);
    try {
      await fetchApiJson("/api/admin/tester-feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove_screenshot", feedbackId: item.id }),
      });
      await loadFeedback();
    } catch {
      setError("스크린샷을 완전히 삭제하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setSavingDecisionId(null);
    }
  }

  return (
    <main className="min-h-screen overflow-x-clip bg-[#F1F3F7] px-3 py-3 text-[#15213B] sm:px-5 sm:py-6 lg:px-8 lg:py-8">
      <section className="mx-auto w-full max-w-[1240px] overflow-hidden rounded-[14px] border border-[#DBE2EA] bg-white">
        <header className="border-b border-[#E8EDF3] px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className={`break-keep text-[#15213B] ${ADMIN_TYPOGRAPHY.pageTitle}`}>피드백 허브</h1>
              </div>
              <p className={`mt-2 text-[#64748B] ${ADMIN_TYPOGRAPHY.body}`}>
                모든 대표 오너가 보낸 문의·개선 제안·문제를 최신순으로 확인합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadFeedback()}
              disabled={fixtureMode || loadState === "loading"}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border border-[#DBE2EA] bg-white px-4 text-[#334155] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 disabled:opacity-50 ${ADMIN_TYPOGRAPHY.control}`}
            >
              <RefreshCcw className="h-4 w-4" aria-hidden />
              새로고침
            </button>
          </div>
          <div className="mt-4"><AdminSectionNav active="testerFeedback" /></div>
        </header>

        <div className="px-4 py-5 sm:px-6 lg:px-8">
          <div className="grid gap-3 border-b border-[#E8EDF3] pb-5 sm:grid-cols-2" aria-label="피드백 필터">
            <label className={`grid gap-1.5 text-[#475569] ${ADMIN_TYPOGRAPHY.label}`}>
              분류
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value as CategoryFilter)}
                className={`min-h-11 rounded-[10px] border border-[#DBE2EA] bg-white px-3 text-[#15213B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] ${ADMIN_TYPOGRAPHY.control}`}
              >
                <option value="all">전체 분류</option>
                {testerFeedbackCategories.map((category) => <option key={category} value={category}>{testerFeedbackCategoryLabels[category]}</option>)}
              </select>
            </label>
            <label className={`grid gap-1.5 text-[#475569] ${ADMIN_TYPOGRAPHY.label}`}>
              상태
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                className={`min-h-11 rounded-[10px] border border-[#DBE2EA] bg-white px-3 text-[#15213B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] ${ADMIN_TYPOGRAPHY.control}`}
              >
                <option value="all">전체 상태</option>
                {testerFeedbackStatuses.map((status) => <option key={status} value={status}>{testerFeedbackStatusLabels[status]}</option>)}
              </select>
            </label>
          </div>

          {error ? <p role="alert" className={`border-b border-[#E8EDF3] py-4 text-[#9A5E4E] ${ADMIN_TYPOGRAPHY.body}`}>{error}</p> : null}
          {loadState === "loading" ? <p className={`py-12 text-center text-[#64748B] ${ADMIN_TYPOGRAPHY.body}`}>피드백을 불러오는 중입니다.</p> : null}
          {loadState === "error" ? (
            <div className="py-12 text-center">
              <button type="button" onClick={() => void loadFeedback()} className={`min-h-11 rounded-[10px] bg-[#111A30] px-5 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 ${ADMIN_TYPOGRAPHY.control}`}>다시 시도</button>
            </div>
          ) : null}
          {loadState === "ready" && visibleFeedback.length === 0 ? (
            <p className={`py-12 text-center text-[#64748B] ${ADMIN_TYPOGRAPHY.body}`}>조건에 맞는 피드백이 없습니다.</p>
          ) : null}
          {loadState === "ready" && visibleFeedback.length > 0 ? (
            <div className="divide-y divide-[#E8EDF3]">
              {visibleFeedback.map((item) => (
                <article key={item.id} className="grid min-w-0 gap-3 py-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className={`inline-flex items-center gap-1.5 text-[#334155] ${ADMIN_TYPOGRAPHY.meta}`}>
                        {item.status === "new" ? <span className="h-2 w-2 rounded-full bg-[#64748B]" aria-hidden /> : null}
                        {testerFeedbackCategoryLabels[item.category]}
                      </span>
                      <span className={`text-[#64748B] ${ADMIN_TYPOGRAPHY.helper}`}>{item.shopName ?? "매장명 확인 필요"}</span>
                      <span className={`text-[#64748B] ${ADMIN_TYPOGRAPHY.helper}`}>{testerFeedbackScreenLabels[item.screenKey]} · {item.appVersion}</span>
                      {item.tester.isTester ? (
                        <span className={`inline-flex items-center gap-1.5 text-[#7F622F] ${ADMIN_TYPOGRAPHY.meta}`}>
                          <span className="h-2 w-2 rounded-full bg-[#B98121]" aria-hidden />
                          테스트 멤버
                        </span>
                      ) : null}
                    </div>
                    <p className={`mt-2 whitespace-pre-wrap break-words text-[#15213B] ${ADMIN_TYPOGRAPHY.body}`}>{item.body}</p>
                    <p className={`mt-2 text-[#64748B] ${ADMIN_TYPOGRAPHY.helper}`}>{formatDateTime(item.createdAt)}</p>
                    {item.screenshot.attached ? (
                      <div className={`mt-3 flex flex-wrap items-center gap-2 text-[#475569] ${ADMIN_TYPOGRAPHY.helper}`}>
                        <span>동의 후 첨부된 스크린샷 · {item.screenshot.contentType} · {item.screenshot.byteSize ? `${Math.ceil(item.screenshot.byteSize / 1024)}KB` : "크기 확인 필요"}</span>
                        <button type="button" onClick={() => void openScreenshot(item)} className={`min-h-11 rounded-[10px] border border-[#DBE2EA] bg-white px-3 text-[#334155] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] ${ADMIN_TYPOGRAPHY.control}`}>보기</button>
                        <button type="button" onClick={() => void removeScreenshot(item)} disabled={savingDecisionId === item.id} className={`min-h-11 rounded-[10px] border border-[#DBE2EA] bg-white px-3 text-[#8A4B55] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] disabled:opacity-60 ${ADMIN_TYPOGRAPHY.control}`}>완전히 삭제</button>
                      </div>
                    ) : null}
                    {item.tester.noticeLabel ? (
                      <p className={`mt-3 rounded-[8px] border border-[#E8EDF3] bg-[#FAFBFC] px-3 py-2 text-[#475569] ${ADMIN_TYPOGRAPHY.helper}`}>
                        {item.tester.noticeLabel}
                      </p>
                    ) : null}
                  </div>
                  <div className="grid gap-3">
                    <label className={`grid gap-1.5 text-[#475569] ${ADMIN_TYPOGRAPHY.label}`}>
                      처리 상태
                      <select
                        value={item.status}
                        disabled={savingId === item.id}
                        onChange={(event) => void changeStatus(item, event.target.value as TesterFeedbackStatus)}
                        className={`min-h-11 rounded-[10px] border border-[#DBE2EA] bg-white px-3 text-[#15213B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] disabled:opacity-60 ${ADMIN_TYPOGRAPHY.control}`}
                      >
                        {testerFeedbackStatuses.map((status) => <option key={status} value={status}>{testerFeedbackStatusLabels[status]}</option>)}
                      </select>
                    </label>
                    {testerDecisionFeedbackIds.has(item.id) && item.tester.schemaReady && item.tester.isTester && item.tester.displayState !== "ended" && item.tester.displayState !== "converted" ? (
                      <div className="grid gap-2" aria-label="테스트 기간 결정">
                        <span className={`text-[#475569] ${ADMIN_TYPOGRAPHY.label}`}>테스트 기간 결정</span>
                        <button type="button" onClick={() => void decideAccess(item, "extend_3_days")} disabled={savingDecisionId === item.id} className={`min-h-11 rounded-[10px] bg-[#111A30] px-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 disabled:opacity-60 ${ADMIN_TYPOGRAPHY.control}`}>3일 연장</button>
                        <div className="grid grid-cols-2 gap-2">
                          <button type="button" onClick={() => void decideAccess(item, "end")} disabled={savingDecisionId === item.id} className={`min-h-11 rounded-[10px] border border-[#DBE2EA] bg-white px-3 text-[#334155] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] disabled:opacity-60 ${ADMIN_TYPOGRAPHY.control}`}>종료</button>
                          <button type="button" onClick={() => void decideAccess(item, "convert")} disabled={savingDecisionId === item.id} className={`min-h-11 rounded-[10px] border border-[#DBE2EA] bg-white px-3 text-[#334155] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] disabled:opacity-60 ${ADMIN_TYPOGRAPHY.control}`}>유료 전환 확인</button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
