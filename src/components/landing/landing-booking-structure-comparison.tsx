import Image from "next/image";

export function BookingStructureComparison() {
  return (
    <section className="bg-[#f6f8fb]" aria-labelledby="booking-structure-title">
      <div className="mx-auto w-full max-w-[1440px] px-5 py-16 md:px-8 md:py-20 xl:px-0">
        <header className="mx-auto max-w-[1040px] text-center">
          <h3 id="booking-structure-title" className="break-keep text-[30px] font-semibold leading-[1.28] text-[#111827] md:text-[42px]">
            고객은 기다리지 않고, 대표님은 서두르지 않도록.
            <br />
            <strong className="font-semibold">넘친Day 펫매니저는 매장과 고객의 시간을 함께 지킵니다.</strong>
          </h3>
        </header>

        <figure className="relative mt-10 overflow-hidden rounded-[8px] border border-[#dbe3ea] bg-white shadow-[0_18px_44px_rgba(15,23,42,0.08)] md:mt-12">
          <Image
            src="/images/landing/section-new-booking-notification-v1.png"
            alt="미용사가 강아지를 미용하는 동안 휴대폰으로 새 예약 알림을 확인하는 장면"
            width={1536}
            height={1024}
            className="h-auto w-full"
            sizes="(min-width: 1440px) 1440px, calc(100vw - 40px)"
          />

          <div className="absolute right-[8%] top-[26%] hidden w-[21%] rounded-[8px] border border-[#c9e2da] bg-white/95 p-3.5 text-left shadow-[0_12px_28px_rgba(15,23,42,0.14)] backdrop-blur-sm md:block">
            <p className="text-[12px] font-semibold text-[#5f746e]">넘친Day 펫매니저</p>
            <p className="mt-1 text-[16px] font-bold text-[#173f37]">새 예약이 등록됐어요</p>
            <p className="mt-2 border-t border-[#e2eee9] pt-2 text-[12px] font-medium leading-5 text-[#58736c]">
              보리 · 목욕 + 부분정리
              <br />오늘 오후 2:00
            </p>
          </div>
        </figure>
      </div>
    </section>
  );
}
