import type { Metadata } from "next";
import Link from "next/link";

import AccountDeletionRequest from "@/components/account-deletion/account-deletion-request";
import { LEGAL_SERVICE_NAME } from "@/lib/legal/legal-info";

export const metadata: Metadata = {
  title: `계정 삭제 요청 | ${LEGAL_SERVICE_NAME}`,
  description: `${LEGAL_SERVICE_NAME} 오너 계정 삭제 범위와 요청 방법을 안내합니다.`,
};

export default function AccountDeletionPage() {
  return (
    <main className="min-h-screen bg-[#f1f3f7] px-4 py-8 text-[#15213b] sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-[760px]">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-[8px] px-1 text-[14px] leading-5 font-medium tracking-[-0.005em] text-[#64748b] hover:text-[#15213b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"
        >
          ← {LEGAL_SERVICE_NAME} 메인으로
        </Link>

        <header className="mt-5">
          <h1 className="text-[24px] leading-8 font-semibold tracking-[-0.02em] text-[#15213b] sm:text-[28px] sm:leading-9">
            계정 삭제 요청
          </h1>
          <p className="mt-3 text-[16px] leading-6 font-normal text-[#64748b]">
            삭제 범위를 확인한 뒤 본인 계정으로 안전하게 요청할 수 있습니다.
          </p>
        </header>

        <section className="mt-7 border-y border-[#dbe2ea] py-5" aria-labelledby="account-deletion-scope">
          <h2 id="account-deletion-scope" className="text-[20px] leading-7 font-semibold tracking-[-0.015em] text-[#15213b]">
            삭제 및 보관 범위
          </h2>
          <ul className="mt-3 space-y-2 text-[14px] leading-5 font-normal text-[#526174]">
            <li>오너 계정, 프로필, 소유 매장과 연결된 운영 데이터 및 첨부 파일을 삭제합니다.</li>
            <li>삭제를 시작하면 모든 로그인 세션이 종료되며 삭제된 정보는 복구할 수 없습니다.</li>
            <li>진행 중인 결제·환불이 있거나 보존 대상 결제 기록의 확인이 필요하면 삭제를 시작하지 않고 안내합니다.</li>
          </ul>
          <p className="mt-4 text-[13px] leading-5 font-normal text-[#64748b]">
            개인정보 권리와 처리 기준은{" "}
            <Link href="/privacy" className="font-medium text-[#2563eb] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2">
              개인정보처리방침
            </Link>
            에서 확인할 수 있습니다.
          </p>
        </section>

        <div className="mt-7">
          <AccountDeletionRequest />
        </div>
      </div>
    </main>
  );
}
