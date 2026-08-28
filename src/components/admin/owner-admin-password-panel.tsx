"use client";

import { KeyRound } from "lucide-react";

export default function OwnerAdminPasswordPanel() {
  return <section className="rounded-[9px] border border-[#edf2f7] bg-[#fbfcfd] p-3">
    <div className="flex items-start gap-2">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f3f4f6] text-[#4b5563]">
        <KeyRound className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[13px] text-[#0f172a]">계정 접근 관리</p>
        <p className="mt-0.5 text-[12px] leading-4 text-[#64748b]">원자적 감사와 추가 인증 절차가 준비될 때까지 임시비밀번호 발급은 차단됩니다.</p>
      </div>
    </div>
  </section>;
}
