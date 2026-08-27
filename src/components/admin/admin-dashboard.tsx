"use client";

import { AlertTriangle, ArrowRight, Building2, CircleDollarSign, DoorOpen, Megaphone, MessageSquareText, Settings2, ShieldCheck, Store } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { formatWon, isPendingSupportRequest, type AdminRevenueSummary, type OwnerSupportRequestItem } from "@/components/admin/admin-dashboard-model";
import { ADMIN_SURFACE, ADMIN_TYPOGRAPHY as T } from "@/components/admin/admin-typography";
import PetManagerBrand from "@/components/brand/petmanager-brand";
import { fetchApiJson } from "@/lib/api";
import type { MarketingWarRoomSnapshot } from "@/types/marketing-war-room";
import type { ControlPlaneNode, ControlPlaneSnapshot } from "@/types/agent-control-plane";

type LoadState = "loading" | "ready" | "error";

export default function AdminDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const [support, setSupport] = useState<OwnerSupportRequestItem[] | null>(null);
  const [revenue, setRevenue] = useState<AdminRevenueSummary | null>(null);
  const [warRoom, setWarRoom] = useState<MarketingWarRoomSnapshot | null>(null);
  const [demoWorkroom, setDemoWorkroom] = useState<ControlPlaneSnapshot | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  const load = useCallback(async () => {
    const results = await Promise.allSettled([
      fetchApiJson<{ requests: OwnerSupportRequestItem[] }>("/api/admin/support-requests?limit=50", { cache: "no-store" }),
      fetchApiJson<AdminRevenueSummary>("/api/admin/revenue-summary", { cache: "no-store" }),
      fetchApiJson<MarketingWarRoomSnapshot>("/api/admin/marketing/work-room", { cache: "no-store" }),
      process.env.NODE_ENV === "development"
        ? fetchApiJson<ControlPlaneSnapshot>("/api/admin/marketing/demo-control-plane", { cache: "no-store" })
        : Promise.resolve(null),
    ]);
    setSupport(results[0].status === "fulfilled" ? results[0].value.requests : null);
    setRevenue(results[1].status === "fulfilled" ? results[1].value : null);
    setWarRoom(results[2].status === "fulfilled" ? results[2].value : null);
    setDemoWorkroom(results[3].status === "fulfilled" ? results[3].value : null);
    setState(results.every((result) => result.status === "rejected") ? "error" : "ready");
  }, []);

  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 30_000); return () => window.clearInterval(timer); }, [load]);
  async function logout() { try { await fetchApiJson("/api/admin/auth/logout", { method: "POST" }); } finally { router.replace("/admin/login" as never); router.refresh(); } }

  const pendingSupport = support?.filter(isPendingSupportRequest).length ?? null;
  const blockedWork = warRoom?.nodes.filter((node) => node.status === "blocked" || node.status === "rejected" || node.safetyViolation).length ?? null;
  const approvals = demoWorkroom?.nodes.filter((node) => node.category === "approval" && node.approvalRequired) ?? [];
  const teamProgress = demoWorkroom?.nodes.filter((node) => node.category === "team_progress") ?? [];
  const userActions = demoWorkroom?.nodes.filter((node) => node.category === "user_action") ?? [];
  return <main className={`${ADMIN_SURFACE} h-[100dvh] overflow-hidden`}><div className="mx-auto flex h-full w-full max-w-[1380px] flex-col">
    <header className="flex items-center justify-between gap-3 border-b border-[#d4d4d4] pb-2"><div className="flex min-w-0 items-center gap-3"><Link href="/admin" aria-label="넘친데이 펫매니저 관리자 홈" className={`${T.button} inline-flex shrink-0 items-center rounded-md`}><PetManagerBrand imageClassName="h-5 w-auto" nameClassName="text-[16px] text-[#262626]" /></Link><div className="min-w-0 border-l border-[#d4d4d4] pl-3"><h1 className="text-[clamp(24px,2.2vw,28px)] font-bold leading-tight text-[#171717]">관리자 홈</h1></div></div><button type="button" onClick={() => void logout()} className={`${T.secondary} inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md border border-[#d4d4d4] bg-white px-3 font-medium text-[#404040]`}><DoorOpen className="h-4 w-4" />로그아웃</button></header>
    <section className="mt-3 overflow-hidden rounded-md border border-[#d4d4d4] bg-white" aria-labelledby="admin-menu-title">
      <h2 id="admin-menu-title" className="sr-only">관리 메뉴</h2>
      <nav className="grid grid-cols-3 divide-x divide-[#e4e9e6] overflow-x-auto">
        <NavLink href="/admin/operations" icon={Settings2} label="운영 관리" accent="border-[#7c3aed] text-[#5b21b6]" active={pathname.startsWith("/admin/operations")} />
        <NavLink href="/admin/owners" icon={Building2} label="업체 관리" accent="border-[#b98121] text-[#7c4a12]" active={pathname.startsWith("/admin/owners")} />
        <NavLink href="/admin/marketing" icon={Megaphone} label="마케팅 워크룸" accent="border-[#2563eb] text-[#1d4ed8]" active={pathname.startsWith("/admin/marketing")} />
      </nav>
    </section>
    {state === "error" ? <div className={`${T.body} mt-3 flex items-center gap-2 border border-[#d4d4d4] bg-white px-4 py-2 text-[#404040]`}><AlertTriangle className="h-5 w-5" />운영 API 연결 실패 · 값은 집계 대기로 표시</div> : null}

    <section className="mt-3 min-h-0 flex-1 overflow-hidden rounded-md border border-[#d4d4d4] bg-white" aria-labelledby="management-status-title">
      <div className="flex items-center justify-between border-b border-[#d4d4d4] bg-white px-4 py-2"><h2 id="management-status-title" className="text-[18px] font-medium text-[#171717]">관리 현황</h2><span className={`${T.secondary} text-[#737373]`}>수동 원장 · 동기화 제한</span></div>

      <div className="grid border-b border-[#d4d4d4] lg:grid-cols-[140px_1fr]"><h3 className={`${T.body} px-4 py-2 font-medium text-[#404040]`}>확인할 일</h3><div className="divide-y divide-[#e5e5e5]"><StatusRow href="/admin/operations" icon={MessageSquareText} label="미처리 고객 문의" value={countValue(pendingSupport, state)} /><StatusRow href="/admin/marketing?view=approval" icon={ShieldCheck} label="대표 승인 대기" value={demoWorkroom ? `${approvals.length}건` : pendingValue(state)} emphasized={approvals.length > 0} /><StatusRow href="/admin/marketing?view=blocked" icon={AlertTriangle} label="막힌 업무" value={countValue(blockedWork, state)} /></div></div>

      <div className="grid border-b border-[#d4d4d4] lg:grid-cols-[140px_1fr]"><h3 className={`${T.body} px-4 py-2 font-medium text-[#404040]`}>대표 승인</h3><div className="divide-y divide-[#e5e5e5]">{approvals.map((node) => <WorkroomRow key={node.workId} node={node} />)}</div></div>

      <div className="grid border-b border-[#d4d4d4] lg:grid-cols-[168px_1fr]"><div className="grid content-center gap-2 px-4 py-2 sm:grid-cols-[1fr_auto] sm:items-center lg:grid-cols-1"><h3 className={`${T.body} font-medium text-[#404040]`}>팀별 진행</h3><Link href="/admin/marketing" className={`${T.secondary} inline-flex min-h-11 w-full min-w-[132px] items-center justify-center gap-1 whitespace-nowrap rounded-md bg-[#171717] px-4 font-medium text-white sm:w-auto lg:mt-1 lg:w-full`}><span className="whitespace-nowrap break-normal">워크룸 보기</span><ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" /></Link></div><div className="grid divide-y divide-[#e5e5e5] lg:grid-cols-2 lg:divide-x lg:divide-y-0">{teamProgress.map((node) => <WorkroomRow key={node.workId} node={node} />)}</div></div>

      <div className="grid border-b border-[#d4d4d4] lg:grid-cols-[140px_1fr]"><h3 className={`${T.body} px-4 py-2 font-medium text-[#404040]`}>사용자 행동</h3><div className="divide-y divide-[#e5e5e5]">{userActions.map((node) => <WorkroomRow key={node.workId} node={node} />)}</div></div>

      <div className="grid lg:grid-cols-[140px_1fr]"><h3 className={`${T.body} px-4 py-2 font-medium text-[#404040]`}>운영 요약</h3><Link href="/admin/operations" className="grid grid-cols-2 divide-x divide-[#e5e5e5] hover:bg-[#f5f5f5] sm:grid-cols-4"><CompactValue icon={CircleDollarSign} label="이번 달 매출" value={revenue ? formatWon(revenue.monthRevenue) : pendingValue(state)} /><CompactValue icon={CircleDollarSign} label="예상 반복 매출" value={revenue ? formatWon(revenue.expectedMonthlyRecurringRevenue) : pendingValue(state)} /><CompactValue icon={Store} label="유료 이용 매장" value={revenue ? `${revenue.activePaidSubscriptions}곳` : pendingValue(state)} /><CompactValue icon={Store} label="활성 오너·전체 매장" value="미연결" /></Link></div>
    </section>
  </div></main>;
}

function NavLink({ href, icon: Icon, label, accent, active }: { href: string; icon: typeof Store; label: string; accent: string; active: boolean }) { return <Link href={href as never} aria-current={active ? "page" : undefined} className={`group flex h-12 min-w-[112px] items-center justify-center gap-2 whitespace-nowrap border-t-[3px] px-2 transition-colors hover:bg-[#f5f5f5] ${active ? accent : "border-transparent text-[#404040]"}`}><Icon className={`h-4 w-4 shrink-0 ${active ? "" : "text-[#525252]"}`} /><span className="text-[15px] font-medium leading-none">{label}</span></Link>; }
function StatusRow({ href, icon: Icon, label, value, emphasized = false }: { href: string; icon: typeof Store; label: string; value: string; emphasized?: boolean }) { return <Link href={href as never} className={`flex min-h-11 items-center gap-2 px-4 py-1 hover:bg-[#f5f5f5] ${emphasized ? "border-b border-[#171717]" : ""}`}><Icon className="h-4 w-4 shrink-0 text-[#737373]" /><span className={`${T.body} flex-1 text-[#404040]`}>{label}</span><span className="text-[16px] font-medium text-[#171717]">{value}</span><ArrowRight className="h-4 w-4 text-[#a3a3a3]" /></Link>; }
function WorkroomRow({ node }: { node: ControlPlaneNode }) { return <Link href={`/admin/marketing?work=${encodeURIComponent(node.workId)}` as never} className="flex h-11 min-w-0 items-center gap-2 px-4 hover:bg-[#f5f5f5]"><span className={`${T.body} min-w-0 flex-1 truncate text-[#262626]`}>[{teamLabel(node)}] · {node.title}</span><span className={`${T.secondary} shrink-0 text-[#737373]`}>{statusLabel(node.status)}</span><ArrowRight className="h-4 w-4 shrink-0 text-[#a3a3a3]" /></Link>; }
function teamLabel(node: ControlPlaneNode) { if (node.role === "성장팀") return "성장팀"; if (node.role === "마케팅 분석팀" || node.role === "분석팀") return "마케팅 분석팀"; if (node.role === "구현팀") return "구현팀"; return node.role; }
function statusLabel(status: ControlPlaneNode["status"]) { return ({ not_started: "대기", received: "접수", in_progress: "진행 중", review: "검수 중", approval_waiting: "대표 승인 대기", approved: "승인", rejected: "미승인", completed: "완료", blocked: "막힘", failed: "실패" } as const)[status]; }
function CompactValue({ icon: Icon, label, value }: { icon: typeof Store; label: string; value: string }) { return <div className="min-w-0 px-3 py-2"><p className={`${T.secondary} flex items-center gap-2 text-[#737373]`}><Icon className="h-4 w-4" />{label}</p><p className="truncate text-[16px] font-medium leading-6 text-[#171717]">{value}</p></div>; }
function pendingValue(state: LoadState) { return state === "loading" ? "집계 중" : "집계 대기"; }
function countValue(value: number | null, state: LoadState) { return value === null ? pendingValue(state) : `${value}건`; }
