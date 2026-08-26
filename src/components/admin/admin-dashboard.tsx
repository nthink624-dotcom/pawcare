"use client";

import { AlertTriangle, ArrowRight, BarChart3, CalendarCheck2, CircleDollarSign, DoorOpen, MessageSquareText, ShieldCheck, Store, TrendingUp, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { formatWon, isPendingSupportRequest, type AdminDashboardAccount, type AdminRevenueSummary, type OwnerSupportRequestItem } from "@/components/admin/admin-dashboard-model";
import { ADMIN_SURFACE, ADMIN_TYPOGRAPHY as T } from "@/components/admin/admin-typography";
import { fetchApiJson } from "@/lib/api";
import type { MarketingKpiSnapshot } from "@/types/marketing-kpi";
import type { MarketingWarRoomSnapshot } from "@/types/marketing-war-room";

type LoadState = "loading" | "ready" | "error";

export default function AdminDashboard({ sessionLoginId }: { sessionLoginId: string }) {
  const router = useRouter();
  const [account, setAccount] = useState<AdminDashboardAccount | null>(null);
  const [support, setSupport] = useState<OwnerSupportRequestItem[] | null>(null);
  const [revenue, setRevenue] = useState<AdminRevenueSummary | null>(null);
  const [kpis, setKpis] = useState<MarketingKpiSnapshot | null>(null);
  const [warRoom, setWarRoom] = useState<MarketingWarRoomSnapshot | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  const load = useCallback(async () => {
    const results = await Promise.allSettled([
      fetchApiJson<AdminDashboardAccount>("/api/admin/session", { cache: "no-store" }),
      fetchApiJson<{ requests: OwnerSupportRequestItem[] }>("/api/admin/support-requests?limit=50", { cache: "no-store" }),
      fetchApiJson<AdminRevenueSummary>("/api/admin/revenue-summary", { cache: "no-store" }),
      fetchApiJson<MarketingKpiSnapshot>("/api/admin/marketing/kpis?days=7", { cache: "no-store" }),
      fetchApiJson<MarketingWarRoomSnapshot>("/api/admin/marketing/work-room", { cache: "no-store" }),
    ]);
    setAccount(results[0].status === "fulfilled" ? results[0].value : null);
    setSupport(results[1].status === "fulfilled" ? results[1].value.requests : null);
    setRevenue(results[2].status === "fulfilled" ? results[2].value : null);
    setKpis(results[3].status === "fulfilled" ? results[3].value : null);
    setWarRoom(results[4].status === "fulfilled" ? results[4].value : null);
    setState(results.every((result) => result.status === "rejected") ? "error" : "ready");
  }, []);

  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 30_000); return () => window.clearInterval(timer); }, [load]);
  async function logout() { try { await fetchApiJson("/api/admin/auth/logout", { method: "POST" }); } finally { router.replace("/admin/login" as never); router.refresh(); } }

  const pendingSupport = support?.filter(isPendingSupportRequest).length ?? null;
  const blockedWork = warRoom?.nodes.filter((node) => node.status === "blocked" || node.status === "rejected" || node.safetyViolation).length ?? null;
  const growth = warRoom?.teamWorkItems.find((item) => item.team === "펫매니저 성장팀");
  const analysis = warRoom?.teamWorkItems.find((item) => item.workId.endsWith("-ANALYSIS"));
  const currentAccount = account ?? { fullName: "관리자", loginId: sessionLoginId };

  return <main className={ADMIN_SURFACE}><div className="mx-auto w-full max-w-[1440px] space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><p className={`${T.badge} font-semibold text-[#1f6b5b]`}>펫매니저 운영 센터</p><h1 className={`${T.pageTitle} mt-1 font-bold text-[#0f172a]`}>관리자 홈</h1><p className={`${T.body} mt-2 text-[#64748b]`}>{currentAccount.fullName} · {currentAccount.loginId}</p></div><nav className="flex flex-wrap gap-2"><NavLink href="/admin/operations" label="운영 상세" /><NavLink href="/admin/owners" label="오너·매장" /><NavLink href="/admin/marketing" label="마케팅 워룸" primary /><button type="button" onClick={() => void logout()} className={`${T.button} inline-flex items-center gap-2 rounded-xl border border-[#dbe2ea] bg-white px-4 text-[#475569]`}><DoorOpen className="h-5 w-5" />로그아웃</button></nav></header>
    {state === "error" ? <div className={`${T.body} flex items-center gap-2 rounded-xl border border-[#e8c9cf] bg-[#fff7f7] p-4 text-[#a04455]`}><AlertTriangle className="h-5 w-5" />운영 API에 연결하지 못했습니다. 값은 0이 아니라 집계 대기로 표시합니다.</div> : null}

    <Section title="지금 확인할 일" subtitle="처리·대표 결정·막힘을 먼저 확인합니다."><div className="grid gap-4 md:grid-cols-3"><MetricLink href="/admin/operations" icon={MessageSquareText} label="미처리 고객 문의" value={countValue(pendingSupport, state)} tone="amber" /><MetricLink href="/admin/marketing?view=approval" icon={ShieldCheck} label="대표 승인 대기" value={warRoom ? `${warRoom.pendingRepresentativeDecisions.length}건` : pendingValue(state)} tone="violet" /><MetricLink href="/admin/marketing?view=blocked" icon={AlertTriangle} label="막힌 업무" value={countValue(blockedWork, state)} tone="burgundy" /></div></Section>

    <Section title="최근 7일" subtitle="실제 운영 집계만 표시하며 계측되지 않은 값은 미연결로 둡니다."><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricLink href="/admin/owners" icon={Users} label="신규 가입 매장" value={kpiValue(kpis?.current.signupCompleted, state)} detail={comparison(kpis?.previous.signupCompleted, kpis?.changes.signupCompletedPercent)} /><MetricLink href="/admin/marketing" icon={TrendingUp} label="직전 7일 대비" value={changeValue(kpis?.changes.signupCompletedPercent, state)} detail="가입 완료 기준" /><MetricLink href="/admin/marketing" icon={CalendarCheck2} label="예약 활성화" value={kpiValue(kpis?.current.activatedShops, state)} detail={rateValue(kpis?.current.signupToActivationRate)} /><MetricLink href="/admin/marketing" icon={CircleDollarSign} label="유료 전환" value={kpiValue(kpis?.current.paidConversions, state)} detail={rateValue(kpis?.current.signupToPaidRate)} /></div></Section>

    <Section title="운영 요약" subtitle="매출·구독 API의 실제 응답을 사용합니다."><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricLink href="/admin/operations" icon={CircleDollarSign} label="이번 달 매출" value={revenue ? formatWon(revenue.monthRevenue) : pendingValue(state)} /><MetricLink href="/admin/operations" icon={BarChart3} label="예상 월 반복 매출" value={revenue ? formatWon(revenue.expectedMonthlyRecurringRevenue) : pendingValue(state)} /><MetricLink href="/owner/admin" icon={Store} label="유료 이용 매장" value={revenue ? `${revenue.activePaidSubscriptions}곳` : pendingValue(state)} /><MetricLink href="/owner/admin" icon={Users} label="활성 오너·전체 매장" value="미연결" detail="현재 요약 API에 집계 없음" /></div></Section>

    <Section title="성장팀·분석팀 현재 업무" subtitle="2026-08-26 15:48 KST 기준 · 수동 동기화"><div className="grid gap-4 xl:grid-cols-2"><WorkSummary item={growth} href="/admin/marketing?work=PM-GROWTH-20260826-006" /><WorkSummary item={analysis} href="/admin/marketing?work=PM-GROWTH-20260826-006-ANALYSIS" /></div></Section>
  </div></main>;
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return <section><div className="mb-3"><h2 className={`${T.sectionTitle} font-bold text-[#111827]`}>{title}</h2><p className={`${T.body} mt-1 text-[#64748b]`}>{subtitle}</p></div>{children}</section>; }
function NavLink({ href, label, primary = false }: { href: string; label: string; primary?: boolean }) { return <Link href={href as never} className={`${T.button} inline-flex items-center gap-2 rounded-xl border px-4 font-semibold ${primary ? "border-[#1f6b5b] bg-[#1f6b5b] text-white" : "border-[#dbe2ea] bg-white text-[#334155]"}`}>{label}<ArrowRight className="h-4 w-4" /></Link>; }
function MetricLink({ href, icon: Icon, label, value, detail, tone = "green" }: { href: string; icon: typeof Store; label: string; value: string; detail?: string; tone?: "green" | "amber" | "violet" | "burgundy" }) { const tones = { green: "bg-[#edf6f2] text-[#1f6b5b]", amber: "bg-[#fff6e8] text-[#b98121]", violet: "bg-[#f3efff] text-[#7c3aed]", burgundy: "bg-[#faecef] text-[#a04455]" }; return <Link href={href as never} className="min-h-40 rounded-2xl border border-[#dbe2ea] bg-white p-5 transition hover:border-[#91b4a9]"><span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="h-6 w-6" /></span><p className={`${T.body} mt-4 text-[#64748b]`}>{label}</p><p className={`${T.metric} mt-1 font-bold text-[#111827]`}>{value}</p>{detail ? <p className={`${T.secondary} mt-2 text-[#64748b]`}>{detail}</p> : null}</Link>; }
function WorkSummary({ item, href }: { item: MarketingWarRoomSnapshot["teamWorkItems"][number] | undefined; href: string }) { if (!item) return <div className={`${T.body} rounded-2xl border border-dashed border-[#cbd5e1] bg-white p-6 text-[#64748b]`}>업무 원장 미연결 · 수동 동기화 대기</div>; return <Link href={href as never} className="rounded-2xl border border-[#dbe2ea] bg-white p-6 hover:border-[#91b4a9]"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className={`${T.secondary} font-mono text-[#64748b]`}>{item.workId}</p><h3 className={`${T.cardTitle} mt-2 font-bold text-[#111827]`}>{item.title}</h3></div><span className={`${T.badge} rounded-full bg-[#fff6e8] px-3 py-1 font-semibold text-[#b98121]`}>{item.stageLabel}</span></div><dl className={`${T.body} mt-5 grid gap-3`}><Row label="완료" value={item.completedSummary} /><Row label="막힘" value={item.blocker} /><Row label="다음 행동" value={item.nextAction} /><Row label="승인" value={item.approvalRequired ? "대표 승인 필요" : "불필요"} /></dl></Link>; }
function Row({ label, value }: { label: string; value: string }) { return <div className="grid gap-1 sm:grid-cols-[90px_1fr]"><dt className="font-semibold text-[#64748b]">{label}</dt><dd className="text-[#334155]">{value}</dd></div>; }
function pendingValue(state: LoadState) { return state === "loading" ? "집계 중" : "집계 대기"; }
function countValue(value: number | null, state: LoadState) { return value === null ? pendingValue(state) : `${value}건`; }
function kpiValue(value: number | null | undefined, state: LoadState) { return value == null ? pendingValue(state) : `${value}곳`; }
function changeValue(value: number | null | undefined, state: LoadState) { return value == null ? pendingValue(state) : `${value > 0 ? "+" : ""}${value}%`; }
function comparison(previous: number | null | undefined, change: number | null | undefined) { return previous == null ? "직전 기간 측정 불가" : change == null ? `직전 ${previous}곳 · 변화 산정 대기` : `직전 ${previous}곳 대비 ${change > 0 ? "+" : ""}${change}%`; }
function rateValue(value: number | null | undefined) { return value == null ? "전환율 측정 불가" : `전환율 ${value}%`; }
