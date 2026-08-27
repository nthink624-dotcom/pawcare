"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RetentionPolicyApprovalFocus() {
  const router = useRouter();

  return <main className="h-[100dvh] overflow-hidden bg-white px-2 pb-2 pt-[84px] text-[#111111] sm:p-4">
    <div className="mx-auto grid h-full max-w-[1080px] grid-rows-[auto_auto_minmax(0,1fr)_58px]">
      <header className="grid min-h-12 grid-cols-[minmax(0,1fr)_100px] items-center gap-1 border-b border-[#e5e7eb]">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-medium sm:text-[16px]">회원 탈퇴 후 어떤 정보를 남길까요?</p>
          <p className="truncate text-[13px] text-[#6b7280]">등록 준비 중 · 실제 결정 저장 없음</p>
        </div>
        <div className="grid grid-cols-2 gap-1">
          <Link href="/admin/marketing" className="inline-flex h-10 w-12 items-center justify-center border border-[#e5e7eb] text-[13px] font-medium sm:text-[14px]">워크룸</Link>
          <button type="button" onClick={() => router.back()} className="h-10 w-12 border border-[#e5e7eb] text-[13px] font-medium sm:text-[14px]">뒤로</button>
        </div>
      </header>
      <section className="border-b border-[#e5e7eb] px-4 py-3">
        <p className="text-[13px] text-[#6b7280]">대표님이 할 일</p>
        <p className="mt-1 text-[16px]">원칙 승인 또는 보류 1건</p>
      </section>
      <section className="min-h-0 overflow-auto">
        <FocusRow label="결정 내용" value="회원 탈퇴 후 법률상 필요한 최소 거래·동의·분쟁 증빙만 접근이 제한된 형태로 보관하고, 나머지 개인정보와 파일은 즉시 삭제하며, 백업 사본은 복구 목적의 승인된 주기가 끝날 때 자연 만료시키는 정책을 승인할지 결정합니다." />
        <FocusRow label="승인하면" value="최소 증빙만 제한 보관하고 나머지 개인정보·파일은 즉시 삭제합니다. 신규 개인정보 전체 사본은 만들지 않습니다." />
        <FocusRow label="아직 확정되지 않는 것" value="법률상 정확한 보관기간과 실제 운영 환경 적용·삭제 실행은 이번 결정에 포함되지 않습니다." />
        <FocusRow label="보류하면" value="법률 확인 전 접근 차단·최소 보관·신규 개인정보 전체 사본 금지의 안전 기본값을 유지합니다." />
      </section>
      <footer className="grid grid-cols-2 items-center gap-1 border-t border-[#e5e7eb]">
        <button type="button" disabled className="h-10 cursor-not-allowed border border-[#d1d5db] bg-[#f3f4f6] px-2 text-[14px] text-[#6b7280]">이 원칙 승인</button>
        <button type="button" disabled className="h-10 cursor-not-allowed border border-[#d1d5db] bg-[#f3f4f6] px-2 text-[14px] text-[#6b7280]">법률 확인 후 결정</button>
      </footer>
    </div>
  </main>;
}

function FocusRow({ label, value }: { label: string; value: string }) {
  return <div className="grid border-b border-[#e5e7eb] px-4 py-3 md:grid-cols-[180px_1fr] md:gap-4">
    <p className="text-[13px] text-[#6b7280]">{label}</p>
    <p className="mt-1 text-[15px] leading-6 md:mt-0">{value}</p>
  </div>;
}
