"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ControlPlaneNode } from "@/types/agent-control-plane";

export default function SecurityApprovalFocus({ node }: { node: ControlPlaneNode }) {
  const router = useRouter();
  const [decision, setDecision] = useState<"즉시 폐기" | "제한 보관" | "보류" | null>(null);
  return <main className="h-[100dvh] overflow-hidden bg-white p-4 text-[#111111]"><div className="mx-auto flex h-full max-w-[1080px] flex-col">
    <header className="flex min-h-12 items-center justify-between border-b border-[#e5e7eb]"><div className="min-w-0"><p className="truncate text-[16px] font-medium">보안팀 · 가입 후 가격표 원본 보관 정책 · 대표 승인 대기</p><p className="text-[13px] text-[#6b7280]">대표 요청 → 운영팀 → 보안팀 → 승인 대기</p></div><button type="button" onClick={() => router.back()} className="min-h-11 border border-[#e5e7eb] px-3 text-[15px] font-medium">목록으로</button></header>
    <section className="mt-4 grid flex-1 content-start gap-0 border-y border-[#e5e7eb] md:grid-cols-[180px_1fr]">
      <FocusRow label="요청 내용" value="가입 처리 뒤 가격표 원본을 보관할지 결정합니다." /><FocusRow label="팀의 판단" value="판독과 대표 확인이 끝나면 즉시 폐기하는 방안을 권고합니다." /><FocusRow label="위험" value="원본을 오래 보관하면 개인정보 노출과 접근 통제 부담이 커집니다." /><FocusRow label="근거" value="보안팀의 회원가입 원자성·RLS·파일 보안 출시 게이트 검토 결과" />
      <div className="border-b border-[#e5e7eb] px-4 py-3 text-[14px] text-[#6b7280]">대표 선택</div><div className="flex flex-wrap gap-2 border-b border-[#e5e7eb] px-4 py-3">{(["즉시 폐기", "제한 보관", "보류"] as const).map((value) => <button key={value} type="button" onClick={() => setDecision(value)} className={`min-h-11 px-4 text-[15px] font-medium ${decision === value ? "bg-black text-white" : "border border-[#111111] bg-white"}`}>{value}</button>)}</div>
    </section><footer className="flex min-h-14 items-center justify-between border-t border-[#e5e7eb] text-[14px]"><span>{decision ? `${decision} 선택됨` : "선택 대기"}</span><span className="text-[#6b7280]">데모 전용 · 저장·외부 실행 없음</span></footer>
  </div></main>;
}
function FocusRow({ label, value }: { label: string; value: string }) { return <><div className="border-b border-[#e5e7eb] px-4 py-3 text-[14px] text-[#6b7280]">{label}</div><div className="border-b border-[#e5e7eb] px-4 py-3 text-[16px]">{value}</div></>; }
