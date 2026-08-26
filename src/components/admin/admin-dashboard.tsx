"use client";

import { AlertTriangle, ArrowRight, Building2, CircleDollarSign, DoorOpen, Megaphone, MessageSquareText, Settings2, ShieldCheck, Store } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { formatWon, isPendingSupportRequest, type AdminDashboardAccount, type AdminRevenueSummary, type OwnerSupportRequestItem } from "@/components/admin/admin-dashboard-model";
import { ADMIN_SURFACE, ADMIN_TYPOGRAPHY as T } from "@/components/admin/admin-typography";
import PetManagerBrand from "@/components/brand/petmanager-brand";
import { fetchApiJson } from "@/lib/api";
import type { MarketingWarRoomSnapshot } from "@/types/marketing-war-room";

type LoadState = "loading" | "ready" | "error";

export default function AdminDashboard({ sessionLoginId }: { sessionLoginId: string }) {
  const router = useRouter();
  const pathname = usePathname();
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
  const currentAccount = account ?? { fullName: "관리자", loginId: sessionLoginId };

  return <main className={ADMIN_SURFACE}><div className="mx-auto w-full max-w-[1380px]">
    <header className="flex items-start justify-between gap-3 border-b border-[#dbe2df] pb-4"><div className="flex min-w-0 items-center gap-4"><Link href="/admin" aria-label="넘친데이 펫매니저 관리자 홈" className={`${T.button} inline-flex shrink-0 items-center rounded-lg`}><PetManagerBrand imageClassName="h-6 w-auto" nameClassName="text-[18px] text-[#1f6b5b]" /></Link><div className="min-w-0 border-l border-[#dbe2df] pl-4"><h1 className="text-[clamp(24px,2.2vw,30px)] font-bold leading-tight text-[#0f172a]">관리자 홈</h1><p className={`${T.secondary} truncate text-[#64748b]`}>{currentAccount.fullName} · {currentAccount.loginId}</p></div></div><button type="button" onClick={() => void logout()} className={`${T.secondary} inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-[#dbe2ea] bg-white px-3 font-semibold text-[#475569]`}><DoorOpen className="h-4 w-4" />로그아웃</button></header>
    <section className="mt-4 overflow-hidden rounded-xl border border-[#d7dfdb] bg-white" aria-labelledby="admin-menu-title">
      <h2 id="admin-menu-title" className={`${T.secondary} border-b border-[#e4e9e6] bg-[#f8faf9] px-5 py-2 font-bold text-[#475569]`}>관리 메뉴</h2>
      <nav className="grid divide-y divide-[#e4e9e6] sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-3">
        <NavLink href="/admin/operations" icon={Settings2} label="운영 관리" description="문의·운영 처리" active={pathname.startsWith("/admin/operations")} />
        <NavLink href="/admin/owners" icon={Building2} label="업체 관리" description="가입 업체·계정" active={pathname.startsWith("/admin/owners")} />
        <NavLink href="/admin/marketing" icon={Megaphone} label="마케팅 워크룸" description="프로젝트·승인" active={pathname.startsWith("/admin/marketing")} />
      </nav>
    </section>
    {state === "error" ? <div className={`${T.body} mt-4 flex items-center gap-2 border-l-4 border-[#a04455] bg-[#fff7f7] px-4 py-3 text-[#a04455]`}><AlertTriangle className="h-5 w-5" />운영 API 연결 실패 · 값은 집계 대기로 표시</div> : null}

    <section className="mt-5 overflow-hidden rounded-xl border border-[#d7dfdb] bg-white" aria-labelledby="management-status-title">
      <div className="flex items-center justify-between border-b border-[#dfe6e2] bg-[#f8faf9] px-5 py-4"><h2 id="management-status-title" className="text-[clamp(22px,2vw,26px)] font-bold text-[#111827]">관리 현황</h2><span className={`${T.secondary} text-[#64748b]`}>수동 원장 2026-08-26 15:48 KST</span></div>

      <div className="grid border-b border-[#dfe6e2] lg:grid-cols-[180px_1fr]"><h3 className={`${T.body} bg-[#fbfcfb] px-5 py-4 font-bold text-[#334155]`}>확인할 일</h3><div className="divide-y divide-[#edf1ef]"><StatusRow href="/admin/operations" icon={MessageSquareText} label="미처리 고객 문의" value={countValue(pendingSupport, state)} /><StatusRow href="/admin/marketing?view=approval" icon={ShieldCheck} label="대표 승인 대기" value={warRoom ? `${warRoom.pendingRepresentativeDecisions.length}건` : pendingValue(state)} emphasized={Boolean(warRoom?.pendingRepresentativeDecisions.length)} /><StatusRow href="/admin/marketing?view=blocked" icon={AlertTriangle} label="막힌 업무" value={countValue(blockedWork, state)} /></div></div>

      <div className="grid border-b border-[#dfe6e2] lg:grid-cols-[180px_1fr]"><div className="flex items-center justify-between gap-3 bg-[#fbfcfb] px-5 py-4 lg:block"><h3 className={`${T.body} font-bold text-[#334155]`}>진행 중 업무</h3><Link href="/admin/marketing?view=flow" className={`${T.secondary} mt-0 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#1f6b5b] px-4 font-bold text-white lg:mt-3`}>전체 흐름 그림 보기<ArrowRight className="h-4 w-4" /></Link></div><div className="divide-y divide-[#edf1ef]"><SimpleWorkRow name="1인 미용샵 체험 모집" status="신청 페이지 제작 준비" nextAction="미리보기 확인 예정" href="/admin/marketing?work=PM-GROWTH-20260826-006" previewUrl={growth?.artifact.previewUrl} /><SimpleWorkRow name="관리자 화면 개선" status="배포 후 화면 점검" nextAction="불편한 부분 수정" href="/admin/marketing?work=PM-ADMIN-HOME-R2" previewUrl="/admin" /><SimpleWorkRow name="모바일 앱 연결" status="운영 화면 연결 완료" nextAction="기기 확인 예정" href="/admin/marketing?work=PM-MOBILE-CONNECTION" previewUrl="/demo/owner-mobile" /><SimpleWorkRow name="단일 요금제·알림톡 포함" status="변경 범위 확인 중" nextAction="가격안 검토 예정" href="/admin/marketing?view=flow" previewUrl={null} /></div></div>

      <div className="grid lg:grid-cols-[180px_1fr]"><h3 className={`${T.body} bg-[#fbfcfb] px-5 py-4 font-bold text-[#334155]`}>운영 요약</h3><Link href="/admin/operations" className="grid min-h-14 grid-cols-2 divide-x divide-[#edf1ef] hover:bg-[#fbfdfc] sm:grid-cols-4"><CompactValue icon={CircleDollarSign} label="이번 달 매출" value={revenue ? formatWon(revenue.monthRevenue) : pendingValue(state)} /><CompactValue icon={CircleDollarSign} label="예상 반복 매출" value={revenue ? formatWon(revenue.expectedMonthlyRecurringRevenue) : pendingValue(state)} /><CompactValue icon={Store} label="유료 이용 매장" value={revenue ? `${revenue.activePaidSubscriptions}곳` : pendingValue(state)} /><CompactValue icon={Store} label="활성 오너·전체 매장" value="미연결" /></Link></div>
    </section>
  </div></main>;
}

function NavLink({ href, icon: Icon, label, description, active }: { href: string; icon: typeof Store; label: string; description: string; active: boolean }) { return <Link href={href as never} aria-current={active ? "page" : undefined} className={`group flex min-h-[56px] items-center gap-3 px-5 py-2.5 transition-colors hover:bg-[#f5faf8] ${active ? "bg-[#edf7f3] text-[#175c4e]" : "text-[#243447]"}`}><Icon className="h-6 w-6 shrink-0 text-[#1f6b5b]" /><span className="min-w-0 flex-1"><strong className="block text-[18px] leading-6">{label}</strong><span className={`${T.secondary} block text-[#64748b]`}>{description}</span></span><ArrowRight className="h-5 w-5 shrink-0 text-[#94a3b8] transition-transform group-hover:translate-x-0.5" /></Link>; }
function StatusRow({ href, icon: Icon, label, value, emphasized = false }: { href: string; icon: typeof Store; label: string; value: string; emphasized?: boolean }) { return <Link href={href as never} className={`flex min-h-14 items-center gap-3 px-5 py-3 hover:bg-[#f8faf9] ${emphasized ? "bg-[#fffaf0]" : ""}`}><Icon className={`h-5 w-5 shrink-0 ${emphasized ? "text-[#b98121]" : "text-[#607080]"}`} /><span className={`${T.body} flex-1 text-[#334155]`}>{label}</span><strong className={`${emphasized ? "text-[24px] text-[#9a6818]" : "text-[20px] text-[#172033]"} leading-none`}>{value}</strong><ArrowRight className="h-4 w-4 text-[#94a3b8]" /></Link>; }
function SimpleWorkRow({ name, status, nextAction, href, previewUrl }: { name: string; status: string; nextAction: string; href: string; previewUrl: string | null | undefined }) { return <div className="grid min-h-[68px] gap-2 px-5 py-3 lg:grid-cols-[minmax(180px,1fr)_minmax(160px,.8fr)_minmax(150px,.8fr)_auto] lg:items-center"><Link href={href as never} className="contents"><strong className={`${T.body} text-[#172033] hover:text-[#1f6b5b]`}>{name}</strong><span className={`${T.body} font-semibold text-[#2563eb]`}>{status}</span><span className={`${T.body} text-[#475569]`}>{nextAction}</span></Link>{previewUrl ? <Link href={previewUrl as never} target="_blank" rel="noreferrer" className={`${T.button} inline-flex min-h-11 items-center justify-center rounded-lg border border-[#b8d4ca] bg-white px-4 font-bold text-[#1f6b5b]`}>화면 보기</Link> : <span className={`${T.secondary} inline-flex min-h-11 items-center text-[#64748b]`}>아직 화면 없음</span>}</div>; }
function CompactValue({ icon: Icon, label, value }: { icon: typeof Store; label: string; value: string }) { return <div className="min-w-0 px-4 py-4"><p className={`${T.secondary} flex items-center gap-2 text-[#64748b]`}><Icon className="h-4 w-4" />{label}</p><p className="mt-1 truncate text-[20px] font-bold leading-tight text-[#172033]">{value}</p></div>; }
function pendingValue(state: LoadState) { return state === "loading" ? "집계 중" : "집계 대기"; }
function countValue(value: number | null, state: LoadState) { return value === null ? pendingValue(state) : `${value}건`; }
