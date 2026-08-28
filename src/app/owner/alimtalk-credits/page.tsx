import Link from "next/link";

export default function OwnerAlimtalkCreditsPage() {
  return (
    <main className="owner-font min-h-screen bg-[#f8fafc] px-5 py-10 text-[#0f172a]">
      <section className="mx-auto max-w-[520px] rounded-[14px] border border-[#dbe2ea] bg-white px-6 py-7">
        <p className="text-[12px] font-semibold text-[#607080]">알림톡 이용 안내</p>
        <h1 className="mt-2 text-[24px] font-bold tracking-[-0.03em]">추가 발송 이용권 판매가 종료되었습니다</h1>
        <p className="mt-3 text-[14px] leading-6 text-[#526070]">
          신규 월 정기 요금에는 알림톡 기능이 포함됩니다. 별도 건수 충전이나 월별 크레딧 리셋은 없습니다.
        </p>
        <Link
          href="/owner/billing"
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-[10px] bg-[#17243c] text-[14px] font-semibold text-white"
        >
          요금제 확인
        </Link>
      </section>
    </main>
  );
}
