"use client";

import { KeyRound } from "lucide-react";

import { ADMIN_TYPOGRAPHY } from "@/components/admin/admin-typography";

export default function OwnerAdminPasswordPanel({
  email,
}: {
  email: string | null;
}) {
  return (
    <section className="rounded-[14px] border border-[#E8EDF3] bg-[#F8FAFC] p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#EFF6FF] text-[#2563EB]">
          <KeyRound className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className={`${ADMIN_TYPOGRAPHY.sectionTitle} text-[#0f172a]`}>계정 접근 관리</p>
          <p className={`mt-1 text-[#64748b] ${ADMIN_TYPOGRAPHY.helper}`}>
            임시비밀번호 원문을 만들거나 표시하지 않습니다. 최근 재인증과 2인 승인 정책 결정 후 안전한 계정 복구 방식으로 제공합니다.
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-[10px] border border-[#E8EDF3] bg-white px-3 py-3">
        <p className={`${ADMIN_TYPOGRAPHY.label} text-[#64748b]`}>로그인 이메일</p>
        <p className={`mt-1 truncate text-[#0f172a] ${ADMIN_TYPOGRAPHY.bodyStrong}`}>{email ?? "-"}</p>
        <p className={`mt-2 text-[#8C6E53] ${ADMIN_TYPOGRAPHY.helper}`}>현재 발급은 보안 승인 정책이 정해진 뒤 제공됩니다.</p>
      </div>
    </section>
  );
}
