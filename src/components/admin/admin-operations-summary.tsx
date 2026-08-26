"use client";

import { ArrowLeft, CircleDollarSign, MessageSquareText, RefreshCcw, Store } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { formatWon, isPendingSupportRequest, type AdminRevenueSummary, type OwnerSupportRequestItem, type OwnerSupportRequestStatus } from "@/components/admin/admin-dashboard-model";
import AdminSupportInbox from "@/components/admin/admin-support-inbox";
import { ADMIN_SURFACE, ADMIN_TYPOGRAPHY as T } from "@/components/admin/admin-typography";
import { fetchApiJson } from "@/lib/api";

export default function AdminOperationsSummary() {
  const [support, setSupport] = useState<OwnerSupportRequestItem[] | null>(null);
  const [revenue, setRevenue] = useState<AdminRevenueSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [supportLoading, setSupportLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const load = useCallback(async () => {
    const [supportResult, revenueResult] = await Promise.allSettled([
      fetchApiJson<{ requests: OwnerSupportRequestItem[] }>("/api/admin/support-requests?limit=50", { cache: "no-store" }),
      fetchApiJson<AdminRevenueSummary>("/api/admin/revenue-summary", { cache: "no-store" }),
    ]);
    setSupport(supportResult.status === "fulfilled" ? supportResult.value.requests : null);
    setRevenue(revenueResult.status === "fulfilled" ? revenueResult.value : null);
    setError(supportResult.status === "rejected" ? "문의 API 연결 실패 · 이전 값을 폐기했습니다" : revenueResult.status === "rejected" ? "매출 API 연결 실패 · 이전 값을 폐기했습니다" : null);
    setSupportLoading(false);
  }, []);
  async function updateSupportRequest(id: string, status: OwnerSupportRequestStatus, adminNote: string, answerMessage = "") { setSavingId(id); try { const response = await fetchApiJson<{ request: OwnerSupportRequestItem }>("/api/admin/support-requests", { method: "PATCH", body: JSON.stringify({ id, status, adminNote, answerMessage }) }); setSupport((current) => (current ?? []).map((item) => item.id === id ? response.request : item)); setError(null); return true; } catch (updateError) { setError(updateError instanceof Error ? updateError.message : "문의 내용을 저장하지 못했습니다."); return false; } finally { setSavingId(null); } }
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const pending = support?.filter(isPendingSupportRequest) ?? null;
  return <main className={ADMIN_SURFACE}><div className="mx-auto max-w-[1280px]"><header className="flex flex-wrap items-center justify-between gap-4"><div><p className={`${T.badge} font-semibold text-[#1f6b5b]`}>운영 상세</p><h1 className={`${T.pageTitle} mt-1 font-bold`}>문의·매출 운영</h1></div><div className="flex gap-2"><button type="button" onClick={() => void load()} className={`${T.button} inline-flex items-center gap-2 rounded-xl border bg-white px-4`}><RefreshCcw className="h-5 w-5" />새로고침</button><Link href="/admin" className={`${T.button} inline-flex items-center gap-2 rounded-xl border bg-white px-4`}><ArrowLeft className="h-5 w-5" />관리자 홈</Link></div></header>{error ? <p className={`${T.body} mt-5 rounded-xl border border-[#e8c9cf] bg-[#fff7f7] p-4 text-[#a04455]`}>{error}</p> : null}<section className="mt-6 grid gap-4 md:grid-cols-3"><Metric icon={MessageSquareText} label="미처리 문의" value={pending ? `${pending.length}건` : "집계 대기"} /><Metric icon={CircleDollarSign} label="이번 달 매출" value={revenue ? formatWon(revenue.monthRevenue) : "집계 대기"} /><Metric icon={Store} label="유료 이용 매장" value={revenue ? `${revenue.activePaidSubscriptions}곳` : "집계 대기"} /></section><section className="mt-6"><AdminSupportInbox requests={support ?? []} error={error} loading={supportLoading} savingId={savingId} onRefresh={() => void load()} onUpdate={updateSupportRequest} /></section></div></main>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Store; label: string; value: string }) { return <div className="rounded-2xl border border-[#dbe2ea] bg-white p-5"><Icon className="h-7 w-7 text-[#1f6b5b]" /><p className={`${T.body} mt-3 text-[#64748b]`}>{label}</p><p className={`${T.metric} mt-1 font-bold`}>{value}</p></div>; }
