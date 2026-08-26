"use client";

import { AlertTriangle, ArrowRight, CircleDollarSign, DoorOpen, MessageSquareText, ShieldCheck, Store } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { formatWon, isPendingSupportRequest, type AdminDashboardAccount, type AdminRevenueSummary, type OwnerSupportRequestItem } from "@/components/admin/admin-dashboard-model";
import { ADMIN_SURFACE, ADMIN_TYPOGRAPHY as T } from "@/components/admin/admin-typography";
import PetManagerBrand from "@/components/brand/petmanager-brand";
import { fetchApiJson } from "@/lib/api";
import type { MarketingWarRoomSnapshot } from "@/types/marketing-war-room";

type LoadState = "loading" | "ready" | "error";

export default function AdminDashboard({ sessionLoginId }: { sessionLoginId: string }) {
  const router = useRouter();
  const [account, setAccount] = useState<AdminDashboardAccount | null>(null);
  const [support, setSupport] = useState<OwnerSupportRequestItem[] | null>(null);
  const [revenue, setRevenue] = useState<AdminRevenueSummary | null>(null);
  const [warRoom, setWarRoom] = useState<MarketingWarRoomSnapshot | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  const load = useCallback(async () => {
    const results = await Promise.allSettled([
      fetchApiJson<AdminDashboardAccount>("/api/admin/session", { cache: "no-store" }),
      fetchApiJson<{ requests: OwnerSupportRequestItem[] }>("/api/admin/support-requests?limit=50", { cache: "no-store" }),
      fetchApiJson<AdminRevenueSummary>("/api/admin/revenue-summary", { cache: "no-store" }),
      fetchApiJson<MarketingWarRoomSnapshot>("/api/admin/marketing/work-room", { cache: "no-store" }),
    ]);
    setAccount(results[0].status === "fulfilled" ? results[0].value : null);
    setSupport(results[1].status === "fulfilled" ? results[1].value.requests : null);
    setRevenue(results[2].status === "fulfilled" ? results[2].value : null);
    setWarRoom(results[3].status === "fulfilled" ? results[3].value : null);
    setState(results.every((result) => result.status === "rejected") ? "error" : "ready");
  }, []);

  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 30_000); return () => window.clearInterval(timer); }, [load]);
  async function logout() { try { await fetchApiJson("/api/admin/auth/logout", { method: "POST" }); } finally { router.replace("/admin/login" as never); router.refresh(); } }

  const pendingSupport = support?.filter(isPendingSupportRequest).length ?? null;
  const blockedWork = warRoom?.nodes.filter((node) => node.status === "blocked" || node.status === "rejected" || node.safetyViolation).length ?? null;
  const growth = warRoom?.teamWorkItems.find((item) => item.team === "펫매니저 성장팀");
  const analysis = warRoom?.teamWorkItems.find((item) => item.workId.endsWith("-ANALYSIS"));
  const currentAccount = account ?? { fullName: "관리자", loginId: sessionLoginId };

  return <main className={ADMIN_SURFACE}><div className="mx-auto w-full max-w-[1380px]">
    <header className="flex flex-col gap-3 border-b border-[#dbe2df] pb-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex min-w-0 items-center gap-4"><Link href="/admin" aria-label="넘친데이 펫매니저 관리자 홈" className={`${T.button} inline-flex shrink-0 items-center rounded-lg`}><PetManagerBrand imageClassName="h-6 w-auto" nameClassName="text-[18px] text-[#1f6b5b]" /></Link><div className="min-w-0 border-l border-[#dbe2df] pl-4"><h1 className="text-[clamp(24px,2.2vw,30px)] font-bold leading-tight text-[#0f172a]">관리자 홈</h1><p className={`${T.secondary} truncate text-[#64748b]`}>{currentAccount.fullName} · {currentAccount.loginId}</p></div></div><nav className="flex flex-wrap gap-2"><NavLink href="/admin/operations" label="운영 상세" /><NavLink href="/admin/owners" label="오너·매장" /><NavLink href="/admin/marketing" label="마케팅 워크룸" primary /><button type="button" onClick={() => void logout()} className={`${T.button} inline-flex items-center gap-2 rounded-lg border border-[#dbe2ea] bg-white px-4 text-[#475569]`}><DoorOpen className="h-5 w-5" />로그아웃</button></nav></header>
    {state === "error" ? <div className={`${T.body} mt-4 flex items-center gap-2 border-l-4 border-[#a04455] bg-[#fff7f7] px-4 py-3 text-[#a04455]`}><AlertTriangle className="h-5 w-5" />운영 API 연결 실패 · 값은 집계 대기로 표시</div> : null}

    <section className="mt-5 overflow-hidden rounded-xl border border-[#d7dfdb] bg-white" aria-labelledby="management-status-title">
      <div className="flex items-center justify-between border-b border-[#dfe6e2] bg-[#f8faf9] px-5 py-4"><h2 id="management-status-title" className="text-[clamp(22px,2vw,26px)] font-bold text-[#111827]">관리 현황</h2><span className={`${T.secondary} text-[#64748b]`}>수동 원장 2026-08-26 15:48 KST</span></div>

      <div className="grid border-b border-[#dfe6e2] lg:grid-cols-[180px_1fr]"><h3 className={`${T.body} bg-[#fbfcfb] px-5 py-4 font-bold text-[#334155]`}>확인할 일</h3><div className="divide-y divide-[#edf1ef]"><StatusRow href="/admin/operations" icon={MessageSquareText} label="미처리 고객 문의" value={countValue(pendingSupport, state)} /><StatusRow href="/admin/marketing?view=approval" icon={ShieldCheck} label="대표 승인 대기" value={warRoom ? `${warRoom.pendingRepresentativeDecisions.length}건` : pendingValue(state)} emphasized={Boolean(warRoom?.pendingRepresentativeDecisions.length)} /><StatusRow href="/admin/marketing?view=blocked" icon={AlertTriangle} label="막힌 업무" value={countValue(blockedWork, state)} /></div></div>

      <div className="grid border-b border-[#dfe6e2] lg:grid-cols-[180px_1fr]"><h3 className={`${T.body} bg-[#fbfcfb] px-5 py-4 font-bold text-[#334155]`}>진행 중 업무</h3><div className="divide-y divide-[#edf1ef]"><WorkRow item={growth} href="/admin/marketing?work=PM-GROWTH-20260826-006" /><WorkRow item={analysis} href="/admin/marketing?work=PM-GROWTH-20260826-006-ANALYSIS" /></div></div>

      <div className="grid lg:grid-cols-[180px_1fr]"><h3 className={`${T.body} bg-[#fbfcfb] px-5 py-4 font-bold text-[#334155]`}>운영 요약</h3><Link href="/admin/operations" className="grid min-h-14 grid-cols-2 divide-x divide-[#edf1ef] hover:bg-[#fbfdfc] sm:grid-cols-4"><CompactValue icon={CircleDollarSign} label="이번 달 매출" value={revenue ? formatWon(revenue.monthRevenue) : pendingValue(state)} /><CompactValue icon={CircleDollarSign} label="예상 반복 매출" value={revenue ? formatWon(revenue.expectedMonthlyRecurringRevenue) : pendingValue(state)} /><CompactValue icon={Store} label="유료 이용 매장" value={revenue ? `${revenue.activePaidSubscriptions}곳` : pendingValue(state)} /><CompactValue icon={Store} label="활성 오너·전체 매장" value="미연결" /></Link></div>
    </section>
  </div></main>;
}

function NavLink({ href, label, primary = false }: { href: string; label: string; primary?: boolean }) { return <Link href={href as never} className={`${T.button} inline-flex items-center gap-2 rounded-xl border px-4 font-semibold ${primary ? "border-[#1f6b5b] bg-[#1f6b5b] text-white" : "border-[#dbe2ea] bg-white text-[#334155]"}`}>{label}<ArrowRight className="h-4 w-4" /></Link>; }
function StatusRow({ href, icon: Icon, label, value, emphasized = false }: { href: string; icon: typeof Store; label: string; value: string; emphasized?: boolean }) { return <Link href={href as never} className={`flex min-h-14 items-center gap-3 px-5 py-3 hover:bg-[#f8faf9] ${emphasized ? "bg-[#fffaf0]" : ""}`}><Icon className={`h-5 w-5 shrink-0 ${emphasized ? "text-[#b98121]" : "text-[#607080]"}`} /><span className={`${T.body} flex-1 text-[#334155]`}>{label}</span><strong className={`${emphasized ? "text-[24px] text-[#9a6818]" : "text-[20px] text-[#172033]"} leading-none`}>{value}</strong><ArrowRight className="h-4 w-4 text-[#94a3b8]" /></Link>; }
function WorkRow({ item, href }: { item: MarketingWarRoomSnapshot["teamWorkItems"][number] | undefined; href: string }) { if (!item) return <div className={`${T.body} px-5 py-4 text-[#64748b]`}>업무 원장 미연결</div>; return <Link href={href as never} className="grid min-h-20 gap-2 px-5 py-4 hover:bg-[#f8faf9] xl:grid-cols-[minmax(240px,1.1fr)_minmax(160px,.7fr)_minmax(220px,1fr)_auto] xl:items-center"><div><p className={`${T.secondary} font-mono text-[#64748b]`}>{item.workId}</p><p className={`${T.body} font-bold text-[#172033]`}>{item.title}</p></div><p className={`${T.secondary} font-semibold text-[#2563eb]`}>{item.stageLabel}</p><p className={`${T.secondary} text-[#475569]`}><strong>다음:</strong> {item.nextAction}</p><ArrowRight className="h-5 w-5 text-[#94a3b8]" /></Link>; }
function CompactValue({ icon: Icon, label, value }: { icon: typeof Store; label: string; value: string }) { return <div className="min-w-0 px-4 py-4"><p className={`${T.secondary} flex items-center gap-2 text-[#64748b]`}><Icon className="h-4 w-4" />{label}</p><p className="mt-1 truncate text-[20px] font-bold leading-tight text-[#172033]">{value}</p></div>; }
function pendingValue(state: LoadState) { return state === "loading" ? "집계 중" : "집계 대기"; }
function countValue(value: number | null, state: LoadState) { return value === null ? pendingValue(state) : `${value}건`; }
