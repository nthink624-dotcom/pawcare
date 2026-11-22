"use client";

import { useEffect, useRef, useState } from "react";
import { IconDownload as Download, IconRefresh as RefreshCw } from "@tabler/icons-react";
import type { RevenueAnalyticsPayload, RevenueGroup, RevenueTransaction } from "@petmanager/shared/contracts/revenue-analytics";
import { fetchApiJson, fetchApiJsonWithAuth } from "@/lib/api";
import { formatRevenueWon as won, paymentMethodLabels, resolveRevenuePeriod, revenueComparison, revenueToday, shiftRevenueMonth } from "@/lib/revenue-analytics";
import RevenueControls, { type RevenueScreenQuery } from "@/components/owner-web/revenue-controls";
import RevenueChart from "@/components/owner-web/revenue-chart";
import RevenueTransactions from "@/components/owner-web/revenue-transactions";
import RevenueCashDialog from "@/components/owner-web/revenue-cash-dialog";
import styles from "./revenue-analytics.module.css";

const action = "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border border-[#dfe5ec] bg-white px-3 text-[14px] font-medium text-[#172033] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:opacity-50";
type LoadedState = { key: string; status: "loading" | "ready" | "error"; payload: RevenueAnalyticsPayload | null; error: string };

function Group({ title, rows, methods = false }: { title: string; rows: RevenueGroup[]; methods?: boolean }) {
  return <section className="border-t border-[#e8edf3] px-4 py-5 sm:px-5"><h2 className="text-[18px] font-semibold leading-6 text-[#172033]">{title}</h2>{!rows.length && <p className="mt-3 text-[14px] text-[#64748b]">기록된 내역이 없습니다.</p>}<ul className="mt-2 divide-y divide-[#e8edf3]">{rows.map(row => <li key={row.key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 text-[14px] leading-5"><div className="min-w-0"><p className="break-words font-medium text-[#172033]">{methods ? paymentMethodLabels[row.key as keyof typeof paymentMethodLabels] ?? row.name : row.name}</p><p className="mt-1 text-[13px] text-[#64748b]">수금 {won(row.collectedAmount)} · 환불 {won(row.refundAmount)}</p></div><p className={`font-medium tabular-nums ${row.netAmount < 0 ? "text-[#9a5e4e]" : "text-[#172033]"}`}>{won(row.netAmount)}</p></li>)}</ul></section>;
}

export default function ProfitabilityAnalyticsScreen({ shopId }: { shopId: string }) {
  const today = revenueToday();
  const [query, setQuery] = useState<RevenueScreenQuery>({ preset: "month", from: today.slice(0, 7) + "-01", to: today, staffId: "", paymentMethod: "all", view: "payments", page: 1, snapshotAt: "", cashSnapshot: "", outstandingRevision: "", kind: "all" });
  const [custom, setCustom] = useState({ from: query.from, to: query.to });
  const [reload, setReload] = useState(0);
  const [state, setState] = useState<LoadedState>({ key: "", status: "loading", payload: null, error: "" });
  const [selected, setSelected] = useState<RevenueTransaction | null>(null);
  const [downloadProgress, setDownloadProgress] = useState("");
  const [notice, setNotice] = useState("");
  const exportAbort = useRef<AbortController | null>(null);
  const demo = ["demo-shop", "owner-demo"].includes(shopId);
  const key = JSON.stringify({ shopId, query, reload });
  const busy = state.key !== key || state.status === "loading";
  const payload = state.key === key && state.status === "ready" ? state.payload : null;
  const controlsPayload = state.payload;

  useEffect(() => {
    const abort = new AbortController();
    const params = new URLSearchParams({ shopId, preset: query.preset, from: query.from, to: query.to, staffId: query.staffId, paymentMethod: query.paymentMethod, view: query.view, kind: query.kind, version: "2", page: String(query.page) });
    if (query.snapshotAt) params.set("snapshotAt", query.snapshotAt);
    if (query.cashSnapshot) params.set("cashSnapshot", query.cashSnapshot);
    if (query.outstandingRevision) params.set("outstandingRevision", query.outstandingRevision);
    setState(previous => ({ ...previous, key, status: "loading", error: "" }));
    const request = demo ? fetchApiJson : fetchApiJsonWithAuth;
    void request<RevenueAnalyticsPayload>(`/api/owner/profitability?${params}`, { cache: "no-store", signal: abort.signal })
      .then(result => { if (!abort.signal.aborted) { if (result.contractVersion !== 2) throw new Error("매출 화면 업데이트가 필요합니다. 새로고침해 주세요."); setState({ key, status: "ready", payload: result, error: "" }); } })
      .catch(reason => { if (!abort.signal.aborted) setState({ key, status: "error", payload: null, error: reason instanceof Error ? reason.message : "매출 정보를 불러오지 못했습니다." }); });
    return () => abort.abort();
  }, [demo, key, query, shopId]);
  useEffect(() => () => exportAbort.current?.abort(), []);
  useEffect(() => { setSelected(null); }, [shopId]);

  function change(patch: Partial<RevenueScreenQuery>) {
    setNotice("");
    setQuery(previous => {
      const next = { ...previous, ...patch, page: 1, snapshotAt: "", cashSnapshot: "", outstandingRevision: "" };
      return JSON.stringify(next) === JSON.stringify(previous) ? previous : next;
    });
  }
  function refresh() { setNotice(""); setQuery(previous => ({ ...previous, snapshotAt: "", cashSnapshot: "", outstandingRevision: "" })); setReload(value => value + 1); }
  function applyCustom() {
    try { resolveRevenuePeriod("custom", custom); change({ preset: "custom", ...custom }); }
    catch (error) { setNotice(error instanceof Error ? error.message : "기간을 확인해 주세요."); }
  }
  function moveMonth(direction: number) {
    const period = resolveRevenuePeriod(query.preset, { from: query.from, to: query.to });
    const from = shiftRevenueMonth(period.from.slice(0, 7) + "-01", direction);
    const last = new Date(Date.parse(shiftRevenueMonth(from, 1) + "T00:00:00Z") - 86400000).toISOString().slice(0, 10);
    if (from > today) return;
    const next = { from, to: last > today ? today : last };
    setCustom(next); change({ preset: "custom", ...next });
  }
  function showTransactions(view: "payments" | "outstanding", kind: "all" | "payment" | "refund" = "all") {
    if (query.view !== view || query.page !== 1 || query.kind !== kind) setQuery(previous => ({ ...previous, view, kind, page: 1, snapshotAt: payload?.generatedAt ?? "", cashSnapshot: payload?.cashSnapshot ?? "", outstandingRevision: payload?.outstandingRevision ?? "" }));
    document.getElementById("revenue-transactions")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  async function download() {
    if (!payload || downloadProgress || demo) return;
    const abort = new AbortController(); exportAbort.current = abort;
    setNotice(""); setDownloadProgress("자료 준비 중…");
    const parts: string[] = ["\uFEFF"];
    let snapshotAt = payload.generatedAt;
    let filename = "펫매니저_매출.csv";
    let expectedTotal: number | null = null;
    try {
      for (let page = 1; ; page += 1) {
        const params = new URLSearchParams({ shopId, preset: payload.period.preset, from: payload.period.from, to: payload.period.to, staffId: payload.filters.staffId, paymentMethod: payload.filters.paymentMethod, view: payload.pagination.view, snapshotAt, cashSnapshot: payload.cashSnapshot, outstandingRevision: payload.outstandingRevision, page: String(page) });
        const chunk = await fetchApiJsonWithAuth<{ csv: string; filename: string; total: number; snapshotAt: string; cashSnapshot: string; outstandingRevision: string; done: boolean }>(`/api/owner/revenue/export?${params}`, { cache: "no-store", signal: abort.signal });
        if (chunk.cashSnapshot !== payload.cashSnapshot || chunk.outstandingRevision !== payload.outstandingRevision) throw new Error("조회 기준이 변경되었습니다. 새로고침 후 다시 내려받아 주세요.");
        if (expectedTotal !== null && expectedTotal !== chunk.total) throw new Error("거래 내역이 변경되었습니다. 새로고침 후 다시 내려받아 주세요.");
        expectedTotal = chunk.total; snapshotAt = chunk.snapshotAt; filename = chunk.filename; parts.push(chunk.csv);
        setDownloadProgress(`${Math.min(page * 500, chunk.total).toLocaleString("ko-KR")} / ${chunk.total.toLocaleString("ko-KR")}건 준비`);
        if (chunk.done) break;
      }
      if (abort.signal.aborted) return;
      const url = URL.createObjectURL(new Blob(parts, { type: "text/csv;charset=utf-8;" }));
      const link = document.createElement("a"); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) { if (!abort.signal.aborted) setNotice(reason instanceof Error ? reason.message : "자료를 내려받지 못했습니다."); }
    finally { if (exportAbort.current === abort) { exportAbort.current = null; setDownloadProgress(""); } }
  }

  const metrics = payload ? [
    { label: "수금 매출", value: won(payload.summary.netAmount), note: revenueComparison(payload.summary.netAmount, payload.previous.netAmount, payload.previous.eventCount), onClick: () => showTransactions("payments") },
    { label: "수금 건수", value: `${payload.summary.paidCount.toLocaleString("ko-KR")}건`, note: "같은 원장 항목의 복합결제는 1건", onClick: () => showTransactions("payments") },
    { label: "적용 할인", value: won(payload.summary.discountAmount), note: "수금액에 이미 반영된 할인", onClick: () => showTransactions("payments") },
    { label: "환불", value: won(payload.summary.refundAmount), note: "실제 환불 날짜에 차감", onClick: () => showTransactions("payments", "refund") },
  ] : [];

  return <div id="owner-revenue-analytics" data-profitability-main-surface aria-busy={busy} className={`${styles.surface} h-full min-h-0 min-w-0 overflow-auto bg-white text-[#172033]`}>
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8edf3] px-4 py-4 sm:px-5"><h1 className="text-[20px] font-semibold leading-7">매출 분석</h1><div className="flex flex-wrap gap-2"><button data-owner-control-size="content" type="button" onClick={download} disabled={busy || !payload || Boolean(downloadProgress) || demo} className={action}><Download className="h-4 w-4" aria-hidden="true" />{downloadProgress || "기간 CSV"}</button><button data-owner-control-size="content" type="button" onClick={refresh} disabled={busy} aria-label="매출 새로고침" className={action}><RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} aria-hidden="true" /><span className="sr-only">새로고침</span></button></div></header>
    <RevenueControls query={query} payload={controlsPayload} custom={custom} onCustom={setCustom} onChange={change} onApplyCustom={applyCustom} onMonth={moveMonth} />
    {notice && <p role="alert" className="border-b border-[#e8edf3] px-4 py-3 text-[14px] leading-5 text-[#9a5e4e]">{notice}</p>}
    {busy ? <div role="status" data-profitability-state="loading" className="px-5 py-16 text-center text-[14px] text-[#64748b]">선택한 조건의 매출을 불러오고 있습니다.</div> : state.status === "error" ? <div role="alert" data-profitability-state="error" className="space-y-3 px-5 py-10 text-center"><p className="text-[14px] text-[#9a5e4e]">{state.error}</p><button data-owner-control-size="content" type="button" onClick={refresh} className={action}>다시 조회</button></div> : payload && <>
      <div className="space-y-1 px-4 py-4 text-[13px] leading-5 text-[#64748b] sm:px-5"><p>조회 {payload.period.from} ~ {payload.period.to} · 실제 수금·환불일 기준</p><p>비교 {payload.period.previousFrom} ~ {payload.period.previousTo}</p><p>기준 시각 {new Date(payload.generatedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}{demo ? " · 데모 데이터" : ""}</p></div>
      <section aria-label="매출 요약" className="grid grid-cols-2 gap-2 px-4 pb-4 lg:grid-cols-4 sm:px-5">{metrics.map(metric => <button data-owner-control-size="content" key={metric.label} type="button" aria-label={`${metric.label} 상세 내역`} onClick={metric.onClick} className="min-h-11 min-w-0 rounded-lg border border-[#e8edf3] p-3 text-left focus-visible:outline-2 focus-visible:outline-[#2563eb]"><span className="block text-[14px] leading-5 text-[#64748b]">{metric.label}</span><span className="mt-1 block break-words text-[24px] font-semibold leading-8 tabular-nums">{metric.value}</span><span className="mt-1 block text-[13px] leading-5 text-[#64748b]">{metric.note}</span></button>)}</section>
      <p className="px-4 pb-4 text-[14px] leading-5 text-[#64748b] sm:px-5">수금액 {won(payload.summary.collectedAmount)} − 환불 {won(payload.summary.refundAmount)} = 수금 매출 {won(payload.summary.netAmount)}</p>
      {payload.outstanding.count > 0 && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e8edf3] bg-[#f8fafc] px-4 py-4 sm:px-5"><div><p className="text-[16px] font-medium">미수·확인 필요 {won(payload.outstanding.amount)} · {payload.outstanding.count}건</p><p className="mt-1 text-[13px] leading-5 text-[#64748b]">{payload.outstanding.reviewRequiredCount ? `기존 기록 ${payload.outstanding.reviewRequiredCount}건은 수금 여부를 확인해야 합니다. ` : ""}수금 매출 합계에 포함하지 않았습니다.</p></div><button data-owner-control-size="content" type="button" onClick={() => showTransactions("outstanding")} className={action}>내역 확인</button></div>}
      <RevenueChart key={`${payload.period.from}:${payload.period.to}`} payload={payload} onDrillDown={bucket => { const next = { from: bucket.from, to: bucket.to }; setCustom(next); change({ preset: "custom", ...next, view: "payments", kind: "all" }); }} />
      <Group title="서비스·상품별 구성" rows={payload.categories} />
      <section className="border-t border-[#e8edf3] px-4 py-5 sm:px-5"><h2 className="text-[18px] font-semibold leading-6">혜택 적용</h2><p className="mt-1 text-[13px] leading-5 text-[#64748b]">수금 거래에 기록된 혜택입니다. 할인은 수금액에 이미 반영되어 있습니다.</p>{payload.benefits?.length ? <ul className="mt-2 divide-y divide-[#e8edf3]">{payload.benefits.map(benefit => <li key={benefit.name} className="flex flex-wrap items-center justify-between gap-2 py-3 text-[14px] leading-5"><span>{benefit.name}</span><span className="text-[#64748b]">적용 거래 {benefit.usageCount}건{benefit.freeServiceCount ? ` · 무료 서비스 ${benefit.freeServiceCount}건` : ""}{benefit.discountAmount ? ` · 할인 ${won(benefit.discountAmount)}` : ""}</span></li>)}</ul> : <p className="mt-3 text-[14px] text-[#64748b]">수금 거래에 기록된 혜택이 없습니다.</p>}</section>
      <Group title="담당자별 매출" rows={payload.staff} />
      <Group title="결제수단별 매출" rows={payload.paymentMethods} methods />
      <RevenueTransactions shopId={shopId} payload={payload} demo={demo} onView={showTransactions} onKind={kind => showTransactions("payments", kind)} onPage={page => setQuery(previous => ({ ...previous, page, snapshotAt: payload.generatedAt, cashSnapshot: payload.cashSnapshot, outstandingRevision: payload.outstandingRevision }))} onRecord={setSelected} />
    </>}
    {selected && <RevenueCashDialog shopId={shopId} transaction={selected} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); refresh(); setNotice("수금·환불 기록을 저장했습니다."); }} />}
  </div>;
}
