import {
  ArrowDown,
  ArrowRight,
  BatteryFull,
  BellRing,
  Camera,
  CalendarCheck2,
  Check,
  Clock3,
  Database,
  Flashlight,
  Link2,
  PhoneMissed,
  Scissors,
  Signal,
  UserRoundPen,
  UsersRound,
  Wifi,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { PhoneScreenshot, ScreenshotFrame, SectionHeading, ValueItem } from "@/components/landing/landing-ui";

const bookingDelaySteps = [
  "고객 연락 수신",
  "작업 중이던 미용 중단",
  "미용 가능 시간 파악",
  "고객에게 가능 시간 안내",
] as const;

const bookingDelayConsequences = [
  "미용 중인 아이도 함께 대기",
  "밀린 시간만큼 다음 예약도 지연",
] as const;

const directBookingSteps = [
  "고객이 링크를 통해 직접 예약",
  "오너는 해당 예약을 확인만 하면 끝",
] as const;

const automationSteps = [
  { icon: Link2, title: "예약 접수", body: "고객이 예약 링크에서 필요한 정보를 남깁니다." },
  { icon: CalendarCheck2, title: "방문 안내", body: "예약에 맞는 방문 안내 알림톡을 한 번 보냅니다." },
  { icon: Scissors, title: "미용 진행", body: "오너와 직원이 같은 예약 상태를 확인합니다." },
  { icon: BellRing, title: "완료 안내", body: "픽업 준비와 미용 완료 안내를 이어서 관리합니다." },
] as const;

export function HeroSection({ onViewProduct }: { onViewProduct: () => void }) {
  return (
    <section className="relative min-h-[760px] overflow-hidden border-b border-[#e2e8f0] bg-[#f7f8f7] md:h-[clamp(680px,calc(100vh-96px),808px)] md:min-h-0" aria-labelledby="landing-hero-title">
      <div className="absolute inset-x-0 bottom-0 h-[220px] md:inset-0 md:h-full md:w-full">
        <Image
          src="/images/landing/hero-groomer-missed-call-v2.png"
          alt=""
          fill
          aria-hidden="true"
          className="hidden scale-[1.015] object-cover object-center brightness-[0.98] blur-[6px] md:block"
          sizes="100vw"
        />
        <Image
          src="/images/landing/hero-groomer-missed-call-v2.png"
          alt="미용 중 울리는 휴대폰 옆에서 반려동물을 미용하는 미용사"
          fill
          priority
          className="object-cover object-center md:hidden"
          sizes="100vw"
        />
        <Image
          src="/images/landing/hero-groomer-missed-call-v2.png"
          alt="미용 중 울리는 휴대폰 옆에서 반려동물을 미용하는 미용사"
          fill
          priority
          className="hidden object-contain object-[right_top] md:block"
          sizes="100vw"
          style={{
            WebkitMaskImage:
              "linear-gradient(to right, transparent 0%, transparent 18%, rgba(0,0,0,0.08) 28%, rgba(0,0,0,0.34) 38%, rgba(0,0,0,0.72) 48%, black 58%, black 100%)",
            maskImage:
              "linear-gradient(to right, transparent 0%, transparent 18%, rgba(0,0,0,0.08) 28%, rgba(0,0,0,0.34) 38%, rgba(0,0,0,0.72) 48%, black 58%, black 100%)",
          }}
        />
      </div>

      <div className="relative mx-auto flex min-h-[760px] w-full max-w-[1180px] items-start px-5 pb-[250px] pt-10 md:h-full md:min-h-0 md:items-center md:pb-16 md:pt-16">
        <div className="max-w-[650px] md:w-[57%] md:pr-10">
          <p className="text-[15px] font-semibold text-[#1f6b5b]">반려동물 미용샵 예약·고객관리</p>
          <h1 id="landing-hero-title" className="mt-4 break-keep text-[34px] font-semibold leading-[1.22] text-[#111827] md:text-[46px]">
            미용하다 놓친 연락,
            <br />고객까지 놓치고 있진 않나요?
          </h1>
          <p className="mt-5 break-keep text-[17px] leading-7 text-[#526071] md:text-[19px] md:leading-8">
            고객은 답을 기다릴 필요 없고,
            <br />오너는 미용하던 손을 멈출 필요 없습니다.
          </p>
          <p className="mt-5 text-[21px] font-semibold text-[#1f6b5b] md:text-[24px]">
            예약이 넘쳐도, 놓치지 않게.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex h-13 items-center justify-center gap-2 rounded-[8px] bg-[#2563eb] px-6 text-[16px] font-semibold text-white transition hover:bg-[#1d4ed8]"
            >
              14일 무료로 시작하기
              <ArrowRight className="h-[18px] w-[18px]" aria-hidden="true" />
            </Link>
            <button
              type="button"
              onClick={onViewProduct}
              className="inline-flex h-13 items-center justify-center rounded-[8px] border border-[#cbd5e1] bg-white px-6 text-[16px] font-medium text-[#334155] transition hover:bg-[#f8fafc]"
            >
              실제 화면 먼저 보기
            </button>
          </div>

          <div className="mt-7 hidden flex-wrap gap-x-5 gap-y-2 text-[15px] font-medium text-[#64748b] md:flex">
            {["카드 등록 없이 시작", "설치 없이 예약 링크 사용", "PC와 모바일에서 확인"].map((item) => (
              <span key={item} className="inline-flex items-center gap-1.5">
                <Check className="h-4 w-4 text-[#1f9d55]" aria-hidden="true" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function PainSection() {
  return (
    <section id="pain-points" className="scroll-mt-20 bg-[#eef0f3] py-20 md:py-24">
      <div className="mx-auto w-full max-w-[1040px] px-5 md:px-6">
        <p className="text-[15px] font-bold text-[#c96a3f]">예약 응대의 연쇄 지연</p>
        <h2 className="mt-4 break-keep text-[34px] font-extrabold leading-[1.28] text-[#1b1815] [text-wrap:pretty] md:text-[40px]">
          미용 중 받은 예약 문의,
          <br />다음 고객의 시간까지 밀고 있진 않나요?
        </h2>
        <p className="mt-5 break-keep text-[16px] leading-7 text-[#4a423b] md:text-[17px] md:leading-7">
          고객을 놓치지 않으려고 미용 중 예약을 처리하면, 지금 하는 미용부터 다음 고객의 일정까지 함께 밀립니다.
        </p>

        <figure className="mt-12">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[22px] bg-[#f7f3ee] sm:aspect-[1040/460]">
            <Image
              src="/images/landing/section-booking-interruption-v2.png"
              alt="미용 가위를 든 채 걸려 온 전화를 확인하는 반려동물 미용사"
              fill
              className="object-cover object-[68%_center] sm:object-center"
              sizes="(min-width: 1040px) 1040px, 100vw"
            />
            <MissedCallPhoneMockup />
          </div>
          <figcaption className="mt-4 text-center text-[15px] text-[#8a7f74] md:text-[15px]">
            가위를 내려놓을 수 없는 순간에도, 전화는 울립니다.
          </figcaption>
        </figure>

        <div className="my-12 text-center">
          <p className="text-[18px] font-bold text-[#a89d92] line-through decoration-[#e5ddd3] md:text-[20px]">
            이 흐름, 매일 반복되고 있진 않나요
          </p>
          <p className="mt-2 break-keep text-[22px] font-extrabold text-[#1b1815] md:text-[26px]">
            가위를 내려놓지 않고도, <span className="text-[#c96a3f]">예약은 이어져야 합니다</span>
          </p>
        </div>

        <div className="overflow-hidden rounded-[18px] border border-[#e5ddd3] bg-white">
          <h3 className="border-b border-[#e5ddd3] bg-[#f7f3ee] px-4 py-4 text-center text-[15px] font-extrabold text-[#1b1815]">
            예약 응대 흐름 비교
          </h3>
          <div className="grid items-stretch gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_36px_minmax(0,1fr)] lg:gap-[18px]">
            <article className="flex h-full min-w-0 flex-col rounded-[16px] border border-[#e5ddd3] bg-[#f7f3ee] p-5 sm:p-[22px]">
              <p className="mb-4 text-center text-[15px] font-bold text-[#a89d92]">지금까지</p>
              <div className="flex flex-1 flex-col">
                <BookingMiniSteps steps={bookingDelaySteps} />
                <ArrowDown className="mx-auto my-1 h-4 w-4 text-[#a89d92]" aria-hidden="true" />
                <div className="space-y-1.5">
                  {bookingDelayConsequences.map((item) => (
                    <div key={item} className="flex items-center gap-2 rounded-[9px] border border-[#f0d9d0] bg-[#fdf1ee] px-3 py-2 text-[15px] font-semibold text-[#4a423b]">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#c9573f]" aria-hidden="true" />
                      {item}
                    </div>
                  ))}
                </div>
                <ArrowDown className="mx-auto my-1 h-4 w-4 text-[#a89d92]" aria-hidden="true" />
                <div className="mt-auto pt-1">
                  <p className="rounded-[9px] bg-[#b85635] px-3 py-2.5 text-center text-[15px] font-extrabold text-white">
                    고객 불만으로 이어짐
                  </p>
                  <p className="mt-3 text-center text-[15px] leading-5 text-[#8a7f74]">
                    미용과 응대를 오가며, 손과 신경이 계속 나뉩니다.
                  </p>
                </div>
              </div>
            </article>

            <div className="flex items-center justify-center" aria-hidden="true">
              <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-[#e5ddd3] bg-white text-[#a89d92]">
                <ArrowDown className="h-4 w-4 lg:hidden" />
                <ArrowRight className="hidden h-4 w-4 lg:block" />
              </span>
            </div>

            <article className="flex h-full min-w-0 flex-col rounded-[16px] border border-[#f0d9c8] bg-[#fbeee5] p-5 sm:p-[22px]">
              <p className="mb-4 text-center text-[15px] font-bold text-[#c96a3f]">넘친 Day 사용 시</p>
              <div className="flex flex-1 flex-col">
                <BookingMiniSteps steps={directBookingSteps} accent />
                <ArrowDown className="mx-auto my-1 h-4 w-4 text-[#a89d92]" aria-hidden="true" />
                <div className="flex min-h-[170px] flex-1 flex-col items-center justify-center gap-3 rounded-[14px] border border-[#f0d9c8] bg-white px-5 py-7 text-center">
                  <span className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-[#fbeee5] text-[#c96a3f]">
                    <Scissors className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <p className="text-[16px] font-extrabold text-[#1b1815]">오너는 미용에만 집중합니다</p>
                </div>
                <ArrowDown className="mx-auto my-1 h-4 w-4 text-[#a89d92]" aria-hidden="true" />
                <div className="mt-auto pt-1">
                  <p className="rounded-[9px] bg-[#c96a3f] px-3 py-2.5 text-center text-[15px] font-extrabold text-white">
                    빠른 예약으로 고객 만족도 상승
                  </p>
                  <p className="mt-3 text-center text-[15px] leading-5 text-[#8a7f74]">
                    고객이 예약하고, 오너는 확인만 하면 끝납니다.
                  </p>
                </div>
              </div>
            </article>
          </div>
        </div>

        <article className="mt-14 rounded-[22px] border border-[#e5ddd3] bg-white p-5 shadow-[0_1px_3px_rgba(27,24,21,0.04)] sm:p-8 md:p-10">
          <h3 className="text-[22px] font-extrabold text-[#1b1815]">
            <span className="text-[15px] font-bold text-[#c96a3f]">넘친 Day</span>가 대신 대응합니다
          </h3>
          <p className="mt-2 break-keep text-[15px] leading-6 text-[#4a423b]">
            고객이 직접 예약하는 동안, 오너는 지금 하던 미용에만 집중하면 됩니다.
          </p>

          <div className="mt-8 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <figure className="min-w-0">
              <figcaption className="mb-2.5 text-center text-[15px] font-semibold text-[#8a7f74]">고객 예약 화면</figcaption>
              <div className="relative aspect-[340/430] overflow-hidden rounded-[14px] border border-[#e5ddd3] bg-[#f7f3ee]">
                <Image
                  src="/images/landing/actual-customer-entry.png"
                  alt="고객이 간편 예약을 시작하는 실제 화면"
                  fill
                  className="object-cover object-top"
                  sizes="(min-width: 768px) 440px, 100vw"
                />
              </div>
            </figure>
            <figure className="min-w-0">
              <figcaption className="mb-2.5 text-center text-[15px] font-semibold text-[#8a7f74]">오너 확인 화면</figcaption>
              <div className="relative aspect-[390/430] overflow-hidden rounded-[14px] border border-[#e5ddd3] bg-[#f7f3ee]">
                <Image
                  src="/images/landing/actual-owner-web.png"
                  alt="오너가 예약 현황을 확인하는 실제 화면"
                  fill
                  className="object-cover object-top"
                  sizes="(min-width: 768px) 500px, 100vw"
                />
              </div>
            </figure>
          </div>

          <div className="mt-7 flex flex-col items-center justify-center gap-3 border-t border-[#efe9e3] pt-6 text-center md:flex-row md:gap-5">
            <p className="text-[17px] font-semibold text-[#a89d92] md:text-[19px]">고객은 기다리지 않고 예약하고,</p>
            <span className="text-[#c96a3f]" aria-hidden="true">
              <ArrowDown className="h-[18px] w-[18px] md:hidden" />
              <ArrowRight className="hidden h-[18px] w-[18px] md:block" />
            </span>
            <p className="text-[17px] font-extrabold text-[#1b1815] md:text-[19px]">오너는 미용의 흐름을 지킵니다.</p>
          </div>
        </article>
      </div>
    </section>
  );
}

function MissedCallPhoneMockup() {
  return (
    <div
      role="img"
      aria-label="부재중 전화 알림이 표시된 아이폰 잠금 화면"
      className="absolute left-[5%] top-1/2 z-10 w-[118px] -translate-y-1/2 sm:left-[14%] sm:w-[168px]"
    >
      <div
        aria-hidden="true"
        className="relative aspect-[9/19.5] overflow-hidden rounded-[24px] border-[3px] border-[#292a2b] bg-[#082f43] p-2 text-white shadow-[0_16px_32px_rgba(27,24,21,0.18)] sm:rounded-[32px] sm:border-[5px] sm:p-3"
      >
        <span className="absolute left-1/2 top-1.5 h-3 w-10 -translate-x-1/2 rounded-full bg-black sm:top-2 sm:h-4 sm:w-16" />

        <div className="flex items-center justify-between pt-1 text-[15px] font-semibold sm:pt-1.5">
          <span>9:27</span>
          <span className="flex items-center gap-1">
            <Signal className="h-3 w-3" />
            <Wifi className="hidden h-3 w-3 sm:block" />
            <BatteryFull className="h-3.5 w-3.5" />
          </span>
        </div>

        <div className="mt-4 text-center sm:mt-8">
          <p className="hidden text-[15px] font-medium text-white/90 sm:block">2월 4일 토요일</p>
          <p className="text-[28px] font-light leading-none tracking-[0] sm:mt-1 sm:text-[42px]">9:27</p>
        </div>

        <div className="absolute inset-x-2 bottom-8 rounded-[13px] bg-[#d8e7ee]/95 p-2 text-[#163447] sm:inset-x-3 sm:bottom-12 sm:rounded-[16px] sm:p-2.5">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#c96a3f] text-white motion-safe:animate-[landing-missed-call-focus_1.8s_ease-in-out_infinite] motion-reduce:animate-none sm:h-9 sm:w-9">
              <PhoneMissed className="h-4 w-4 sm:h-5 sm:w-5" />
            </span>
            <span className="min-w-0 text-left text-[15px] font-semibold leading-[1.15]">
              <span className="hidden sm:block">고객 전화</span>
              <span className="block text-[#365c70] sm:mt-0.5">부재중</span>
            </span>
          </div>
        </div>

        <div className="absolute inset-x-3 bottom-2 hidden items-center justify-between text-white/85 sm:flex">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/30">
            <Flashlight className="h-3.5 w-3.5" />
          </span>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/30">
            <Camera className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </div>
  );
}

function BookingMiniSteps({ steps, accent = false }: { steps: readonly string[]; accent?: boolean }) {
  return (
    <ol className="flex flex-col items-center gap-0.5">
      {steps.map((step, index) => (
        <li key={step} className="w-full">
          <div className={`flex items-center gap-2 rounded-[9px] border bg-white px-3 py-2 text-[15px] font-semibold text-[#4a423b] ${accent ? "border-[#f0d9c8]" : "border-[#e5ddd3]"}`}>
            <span className={`shrink-0 text-[15px] font-bold ${accent ? "text-[#c96a3f]" : "text-[#a89d92]"}`}>
              {String(index + 1).padStart(2, "0")}
            </span>
            {step}
          </div>
          {index < steps.length - 1 ? (
            <ArrowDown className="mx-auto my-0.5 h-3.5 w-3.5 text-[#a89d92]" aria-hidden="true" />
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function CustomerDataSection() {
  return (
    <section id="customer-data" className="scroll-mt-20 bg-white py-18 md:py-24">
      <div className="mx-auto w-full max-w-[1180px] px-5">
        <SectionHeading
          eyebrow="예약 후 반복 정리"
          title="예약은 들어왔는데, 정리는 또 오너의 몫인가요?"
          description="예약을 잡은 뒤에도 문자와 DM을 다시 찾아 캘린더에 옮기고, 고객정보를 기록해야 한다는 문제입니다."
        />

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            { icon: UserRoundPen, number: "01", title: "예약정보 한 번에 입력", body: "고객이 서비스, 시간, 보호자와 반려동물 정보를 직접 남깁니다." },
            { icon: CalendarCheck2, number: "02", title: "예약 일정 자동 반영", body: "입력한 예약이 오너 일정과 예약 현황에 바로 이어집니다." },
            { icon: Database, number: "03", title: "고객 DB 자동 연결", body: "보호자와 반려동물 정보가 고객관리 화면에 함께 쌓입니다." },
          ].map(({ icon: Icon, number, title, body }) => (
            <div key={number} className="border-t-2 border-[#cdd8d2] pt-4">
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-[#edf7f1] text-[#1f6b5b]">
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                <span className="text-[15px] font-semibold text-[#94a3b8]">{number}</span>
              </div>
              <h3 className="mt-4 text-[18px] font-semibold text-[#111827]">{title}</h3>
              <p className="mt-2 text-[15px] leading-6 text-[#64748b]">{body}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 grid items-center gap-8 lg:grid-cols-[0.72fr_1.28fr]">
          <div className="grid grid-cols-2 gap-4">
            <PhoneScreenshot src="/images/landing/actual-customer-entry.png" alt="고객 예약 첫 화면" label="예약 시작" />
            <PhoneScreenshot src="/images/landing/actual-customer-booking.png" alt="보호자와 반려동물 정보 입력 화면" label="예약정보 입력" />
          </div>
          <div>
            <ScreenshotFrame
              src="/images/landing/actual-customers.png"
              alt="오너 고객관리 화면"
              label="고객관리"
            />
            <p className="mt-5 text-[17px] font-medium leading-7 text-[#334155]">
              다음 예약부터는 고객과 반려동물 정보를 다시 묻지 않고, 저장된 기록에서 바로 확인합니다.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ScheduleProofSection() {
  return (
    <section id="screens" className="scroll-mt-20 border-y border-[#e2e8f0] bg-[#f5f7f9] py-18 md:py-24">
      <div className="mx-auto w-full max-w-[1180px] px-5">
        <SectionHeading
          eyebrow="실제 운영 화면"
          title="오늘 예약과 직원별 일정을 열자마자 확인하세요"
          description="예약 시간, 담당자, 진행 상태와 고객 상세가 한 화면에 연결됩니다. 월간 캘린더에서는 확정·취소·완료 일정을 날짜별로 확인합니다."
        />

        <div className="mt-10 grid items-start gap-5 lg:grid-cols-[1.36fr_.64fr]">
          <ScreenshotFrame src="/images/landing/actual-schedule.png" alt="직원별 오늘 예약관리 화면" label="오늘 예약" priority />
          <ScreenshotFrame src="/images/landing/actual-calendar.png" alt="월간 예약 캘린더 화면" label="월간 캘린더" compact />
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <ValueItem icon={<UsersRound className="h-[18px] w-[18px]" />} title="담당자별 예약" body="저장된 직원만 기준으로 예약 열과 담당 필터를 구성합니다." />
          <ValueItem icon={<Clock3 className="h-[18px] w-[18px]" />} title="시간과 상태" body="예약 시간과 확정·진행·완료 상태를 일정 위치에서 확인합니다." />
          <ValueItem icon={<Database className="h-[18px] w-[18px]" />} title="고객 상세" body="예약을 선택하면 보호자, 반려동물, 서비스 기록을 함께 봅니다." />
        </div>
      </div>
    </section>
  );
}

export function AutomationSection() {
  return (
    <section className="bg-[#111827] py-18 text-white md:py-24">
      <div className="mx-auto grid w-full max-w-[1180px] gap-12 px-5 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
        <div>
          <SectionHeading
            eyebrow="예약 이후까지 연결"
            title="안내 메시지도 매번 기억해서 보내지 마세요"
            description="예약을 받은 뒤 방문 안내와 미용 진행 상태까지 같은 예약을 기준으로 이어집니다. 발송 현황과 남은 알림톡도 오너 화면에서 확인합니다."
            inverse
          />
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {automationSteps.map(({ icon: Icon, title, body }) => (
              <ValueItem key={title} icon={<Icon className="h-[18px] w-[18px]" />} title={title} body={body} inverse />
            ))}
          </div>
        </div>

        <ScreenshotFrame
          src="/images/landing/actual-notifications.png"
          alt="오너 알림톡 설정과 발송 현황 화면"
          label="알림 설정"
        />
      </div>
    </section>
  );
}
