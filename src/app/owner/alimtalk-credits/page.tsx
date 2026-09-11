import Link from "next/link";

export default function OwnerAlimtalkCreditsPage() {
  return (
    <main className="owner-font min-h-screen bg-[#f8fafc] px-5 py-10 text-[#0f172a]">
      <section className="mx-auto max-w-[520px] rounded-[14px] border border-[#dbe2ea] bg-white px-6 py-7">
        <p className="text-[12px] font-semibold text-[#607080]">알림톡 이용 안내</p>
        <h1 className="mt-2 text-[24px] font-bold tracking-[-0.03em]">알림톡 이용 설정이 요금제로 통합되었습니다</h1>
        <p className="mt-3 text-[14px] leading-6 text-[#526070]">
          알림톡 발송 기능은 현재 요금제의 이용 정책에 따라 제공됩니다. 발송 설정과 이력은 오너 화면에서
          계속 확인할 수 있습니다.
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
