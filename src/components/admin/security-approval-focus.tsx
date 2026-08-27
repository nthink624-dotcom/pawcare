"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ControlPlaneNode } from "@/types/agent-control-plane";

export default function SecurityApprovalFocus({ node: _node }: { node: ControlPlaneNode }) {
  const router = useRouter();
  const [decision, setDecision] = useState<"즉시 폐기" | "제한 보관" | "보류" | null>(null);
  return <main className="h-[100dvh] overflow-hidden bg-white px-2 pb-2 pt-[84px] text-[#111111] sm:p-4"><div className="mx-auto grid h-full max-w-[1080px] grid-rows-[auto_44px_minmax(0,1fr)_58px]">
    <header className="grid min-h-12 grid-cols-[minmax(0,1fr)_100px] items-center gap-1 border-b border-[#e5e7eb]"><div className="min-w-0"><p className="truncate text-[15px] font-medium sm:text-[16px]">보안팀 · 가입 후 가격표 원본 보관 정책 · 대표 승인 대기</p><p className="truncate text-[13px] text-[#6b7280]">대표 요청 → 운영팀 → 보안팀 → 승인 대기</p></div><div className="grid grid-cols-2 gap-1"><Link href="/admin/marketing" className="inline-flex h-10 w-12 items-center justify-center border border-[#e5e7eb] text-[13px] font-medium sm:text-[14px]">워크룸</Link><button type="button" onClick={() => router.back()} className="h-10 w-12 border border-[#e5e7eb] text-[13px] font-medium sm:text-[14px]">뒤로</button></div></header>
    <div className="grid min-w-0 grid-cols-3 items-center overflow-hidden border-b border-[#e5e7eb] text-[11px] sm:text-[13px]"><Meta label="대상" value="회원가입 원자료" /><Meta label="위치" value="보안 보관 정책" /><Meta label="결정 영향" value="보관 또는 폐기" /></div>
    <section className="grid max-h-[300px] min-h-0 self-start overflow-auto border-b border-[#e5e7eb] md:grid-cols-[58fr_42fr]"><div><FocusRow label="요청 내용" value="가입 처리 뒤 가격표 원본을 보관할지 결정합니다." /><FocusRow label="팀의 판단" value="판독과 대표 확인이 끝나면 즉시 폐기하는 방안을 권고합니다." /><FocusRow label="위험" value="원본을 오래 보관하면 개인정보 노출과 접근 통제 부담이 커집니다." /></div><div className="md:border-l md:border-[#e5e7eb]"><FocusRow label="근거 요약" value="회원가입 원자성·RLS·파일 보안 출시 게이트 검토 결과" /><FocusRow label="결정 영향" value="즉시 폐기하면 보유 위험을 줄이고, 제한 보관하면 별도 동의와 접근 통제가 필요합니다." /></div></section>
    <footer className="grid grid-cols-1 items-center border-t border-[#e5e7eb] sm:grid-cols-[1fr_auto] sm:gap-2"><span className="hidden truncate text-[13px] text-[#6b7280] sm:block">{decision ? `${decision} 선택됨 · 저장·외부 실행 없음` : "대표 선택"}</span><div className="grid w-full grid-cols-3 gap-1">{(["즉시 폐기", "제한 보관", "보류"] as const).map((value) => <button key={value} type="button" onClick={() => setDecision(value)} className={`h-10 whitespace-nowrap px-1 text-[13px] font-medium sm:px-3 sm:text-[14px] ${decision === value ? "bg-black text-white" : "border border-[#111111] bg-white"}`}>{value}</button>)}</div></footer>
  </div></main>;
}

function Meta({ label, value }: { label: string; value: string }) { return <div className="min-w-0 truncate px-1 sm:px-2"><span className="text-[#6b7280]">{label}: </span><span>{value}</span></div>; }
function FocusRow({ label, value }: { label: string; value: string }) { return <><div className="border-b border-[#e5e7eb] px-4 py-3 text-[14px] text-[#6b7280]">{label}</div><div className="border-b border-[#e5e7eb] px-4 py-3 text-[16px]">{value}</div></>; }
