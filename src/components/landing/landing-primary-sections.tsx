import {
  ArrowDown,
  ArrowRight,
  BellRing,
  CalendarCheck2,
  Check,
  Clock3,
  Database,
  Link2,
  Scissors,
  UserRoundPen,
  UsersRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { BookingStructureComparison } from "@/components/landing/landing-booking-structure-comparison";
import { IPhoneMockup, PhoneScreenshot, ScreenshotFrame, SectionHeading, ValueItem } from "@/components/landing/landing-ui";

const automationSteps = [
  { icon: Link2, title: "예약 접수", body: "고객이 예약 링크에서 필요한 정보를 남깁니다." },
  { icon: CalendarCheck2, title: "방문 안내", body: "예약에 맞는 방문 안내 알림톡을 한 번 보냅니다." },
  { icon: Scissors, title: "미용 진행", body: "오너와 직원이 같은 예약 상태를 확인합니다." },
  { icon: BellRing, title: "완료 안내", body: "픽업 준비와 미용 완료 안내를 이어서 관리합니다." },
] as const;

export function HeroSection({ onViewProduct }: { onViewProduct: () => void }) {
  return (
    <section className="relative min-h-[760px] overflow-hidden border-b border-[#e2e8f0] bg-[#f6f8fb] md:h-[clamp(680px,calc(100vh-96px),808px)] md:min-h-0" aria-labelledby="landing-hero-title">
      <div className="absolute inset-x-0 bottom-0 h-[220px] md:inset-0 md:h-full md:w-full">
        <Image
          src="/images/landing/hero-groomer-missed-call-v3.png"
          alt=""
          fill
          aria-hidden="true"
          className="hidden scale-[1.015] object-cover object-center brightness-[0.98] blur-[6px] md:block"
          sizes="100vw"
        />
        <Image
          src="/images/landing/hero-groomer-missed-call-v3.png"
          alt="미용 중 울리는 휴대폰 옆에서 반려동물을 미용하는 미용사"
          fill
          priority
          className="object-cover object-center md:hidden"
          sizes="100vw"
        />
        <Image
          src="/images/landing/hero-groomer-missed-call-v3.png"
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
          <p className="text-[15px] font-semibold text-[var(--landing-accent)]">반려동물 미용샵 예약·고객관리</p>
          <h1 id="landing-hero-title" className="mt-4 break-keep text-[34px] font-semibold leading-[1.22] text-[#111827] md:text-[46px]">
            미용하다 놓친 연락,
            <br />고객까지 놓치고 있진 않나요?
          </h1>
          <p className="mt-5 break-keep text-[17px] leading-7 text-[#526071] md:text-[19px] md:leading-8">
            고객은 답을 기다릴 필요 없고,
            <br />오너는 미용하던 손을 멈출 필요 없습니다.
          </p>
          <p className="mt-5 text-[21px] font-semibold text-[var(--landing-accent)] md:text-[24px]">
            예약이 넘쳐도, 놓치지 않게.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex h-13 items-center justify-center gap-2 rounded-[8px] bg-[var(--landing-accent)] px-6 text-[16px] font-semibold text-white transition hover:bg-[var(--landing-accent-hover)]"
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
                <Check className="h-4 w-4 text-[var(--landing-accent)]" aria-hidden="true" />
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
    <section id="pain-points" aria-label="고객의 예약 경험" className="scroll-mt-20 bg-white">
      <div className="border-b border-[#e2e8f0] bg-white px-5 pb-28 pt-12 text-center md:pb-36 md:pt-14">
        <header className="mx-auto max-w-[1180px]">
          <div>
            <blockquote className="relative mr-auto w-[94%] max-w-[530px] rounded-[16px] border border-[#d8e0e9] bg-[#f6f8fa] px-6 py-7 text-left sm:px-8 sm:py-8 md:w-[48%]">
              <p className="text-[15px] font-semibold text-[#64748b]">예약하려는 고객</p>
              <p className="mt-3 break-keep text-[25px] font-semibold leading-[1.35] text-[#111827] md:text-[30px]">
                전화를 안 받는 매장에는
                <br />다시 걸고 싶지 않아요.
              </p>
              <span className="absolute -bottom-[9px] left-9 h-4 w-4 rotate-45 border-b border-r border-[#d8e0e9] bg-[#f6f8fa]" aria-hidden="true" />
            </blockquote>

            <blockquote className="relative ml-auto mt-10 w-[94%] max-w-[620px] rounded-[16px] border border-[#d8e0e9] bg-[#f6f8fa] px-6 py-7 text-left sm:px-8 sm:py-8 md:mt-16 md:w-[54%]">
              <p className="text-[15px] font-semibold text-[#64748b]">미용을 맡긴 고객</p>
              <p className="mt-3 break-keep text-[21px] font-semibold leading-[1.5] text-[#111827] md:text-[25px] md:leading-[1.45]">
                다른 손님 전화 받느라
                <br />우리 아이도, 저도 기다리게 하는 매장은 더 싫어요.
              </p>
              <span className="absolute -bottom-[9px] right-9 h-4 w-4 rotate-45 border-b border-r border-[#d8e0e9] bg-[#f6f8fa]" aria-hidden="true" />
            </blockquote>
          </div>
          <blockquote className="mx-auto mt-24 max-w-[940px] py-4 text-center md:mt-32 md:py-5">
            <span className="block text-[54px] font-semibold leading-[0.55] text-[var(--landing-accent)]" aria-hidden="true">“</span>
            <p className="mx-auto mt-5 max-w-[880px] break-keep text-[20px] font-medium leading-[1.65] text-[#334155] md:text-[25px] md:leading-[1.6]">
              전화를 못 받는 것도, 그 응대 때문에 다른 손님과 반려동물을 기다리게 하는 것도 고객 입장에선 똑같이 불편한 경험입니다.
              <strong className="font-semibold text-[#111827]">넘친데이 펫매니저</strong>는 그 지점에서 출발했어요.
              같은 예약 문의라도, 처리하는 방식이 완전히 다릅니다.
            </p>
            <span className="mt-4 block text-[54px] font-semibold leading-[0.55] text-[var(--landing-accent)]" aria-hidden="true">”</span>
          </blockquote>
        </header>
      </div>

      <BookingStructureComparison />

      <div className="mx-auto w-full max-w-[1180px] px-5 py-20 md:py-24">
        <header className="grid items-end gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] md:gap-12">
          <div>
            <p className="text-[15px] font-semibold text-[var(--landing-accent)]">넘친 Day의 해결 방식</p>
            <h3 className="mt-3 break-keep text-[31px] font-semibold leading-[1.25] text-[#111827] md:text-[42px]">
              전화 대신 고객이 직접 예약하면,
              <br />누구도 기다릴 필요가 없습니다.
            </h3>
          </div>
          <p className="break-keep text-[15px] leading-7 text-[#526071] md:text-[17px]">
            고객은 예약 링크에서 서비스와 시간을 직접 선택합니다. 오너는 지금 맡긴 아이에게 계속 집중하고, 들어온 예약만 확인하면 됩니다.
          </p>
        </header>

        <div className="mt-12 rounded-[8px] bg-[#eef1f5] px-5 py-10 sm:px-8 md:px-10 md:py-12">
          <div className="grid items-center gap-8 md:grid-cols-[minmax(230px,0.72fr)_72px_minmax(0,1.28fr)] md:gap-8">
            <figure className="min-w-0">
              <figcaption className="mb-5 flex items-center justify-center gap-2 text-[15px] font-semibold text-[#334155]">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--landing-accent)] text-[15px] text-white">1</span>
                고객이 직접 예약
              </figcaption>
              <div className="flex h-[460px] items-center justify-center md:h-[500px]">
                <IPhoneMockup
                  src="/images/landing/actual-customer-entry-v2.jpg"
                  alt="고객이 간편 예약을 시작하는 실제 화면"
                  className="h-full w-auto max-w-full drop-shadow-[0_20px_30px_rgba(15,23,42,0.16)]"
                  sizes="(min-width: 768px) 245px, 68vw"
                />
              </div>
            </figure>

            <div className="flex flex-col items-center justify-center gap-2 text-[var(--landing-accent)]" aria-hidden="true">
              <span className="text-[15px] font-semibold">자동 반영</span>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-[0_6px_18px_rgba(15,23,42,0.08)]">
                <ArrowDown className="h-5 w-5 md:hidden" />
                <ArrowRight className="hidden h-5 w-5 md:block" />
              </span>
            </div>

            <figure className="min-w-0">
              <figcaption className="mb-5 flex items-center justify-center gap-2 text-[15px] font-semibold text-[#334155]">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--landing-accent)] text-[15px] text-white">2</span>
                오너는 들어온 예약 확인
              </figcaption>
              <ScreenshotFrame
                src="/images/landing/actual-owner-web.png"
                alt="오너가 예약 현황을 확인하는 실제 화면"
                label="새 예약 확인"
                compact
              />
              <div className="mt-5 grid gap-2 sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3">
                {["미용 흐름 유지", "일정 자동 정리", "새 예약은 확인만"].map((item) => (
                  <span key={item} className="flex items-center gap-2 text-[15px] font-medium text-[#526071]">
                    <Check className="h-4 w-4 shrink-0 text-[var(--landing-accent)]" aria-hidden="true" />
                    {item}
                  </span>
                ))}
              </div>
            </figure>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 border-y border-[#dbe2ea] py-7 text-center md:flex-row md:gap-5">
          <p className="text-[18px] font-semibold text-[#64748b] md:text-[21px]">고객은 전화하지 않고 직접 예약하고,</p>
          <span className="text-[var(--landing-accent)]" aria-hidden="true">
            <ArrowDown className="h-[18px] w-[18px] md:hidden" />
            <ArrowRight className="hidden h-[18px] w-[18px] md:block" />
          </span>
          <p className="text-[18px] font-semibold text-[#111827] md:text-[21px]">오너는 지금 맡긴 아이에게 집중합니다.</p>
        </div>
      </div>
    </section>
  );
}

export function CustomerDataSection() {
  return (
    <section id="customer-data" className="scroll-mt-20 border-t border-[#e2e8f0] bg-[#f7f8fa] py-20 md:py-24">
      <div className="mx-auto w-full max-w-[1180px] px-5">
        <SectionHeading
          eyebrow="예약 후 반복 정리"
          title="예약은 들어왔는데, 정리는 또 오너의 몫인가요?"
          description="예약을 잡은 뒤에도 문자와 DM을 다시 찾아 캘린더에 옮기고, 고객정보를 기록해야 한다는 문제입니다."
        />

        <div className="mt-12 grid items-center gap-8 lg:grid-cols-[0.76fr_1.24fr] lg:gap-12">
          <div className="rounded-[8px] bg-[#e9edf3] px-4 pb-6 pt-5 sm:px-6">
            <p className="mb-5 text-center text-[15px] font-semibold text-[#334155]">고객이 예약할 때 직접 입력</p>
            <div className="grid grid-cols-2 gap-3 sm:gap-5">
              <PhoneScreenshot src="/images/landing/actual-customer-entry-v2.jpg" alt="고객 예약 첫 화면" label="서비스 선택" />
              <PhoneScreenshot src="/images/landing/actual-customer-booking.png" alt="보호자와 반려동물 정보 입력 화면" label="예약정보 입력" />
            </div>
          </div>
          <div>
            <p className="mb-4 inline-flex items-center gap-2 text-[15px] font-semibold text-[var(--landing-accent)]">
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
              입력과 동시에 고객관리로 연결
            </p>
            <ScreenshotFrame
              src="/images/landing/actual-customers.png"
              alt="오너 고객관리 화면"
              label="고객관리"
            />
            <p className="mt-6 border-l-[3px] border-[var(--landing-accent)] pl-4 text-[17px] font-medium leading-7 text-[#334155]">
              다음 예약부터는 고객과 반려동물 정보를 다시 묻지 않고, 저장된 기록에서 바로 확인합니다.
            </p>
          </div>
        </div>

        <ol className="mt-12 grid border-y border-[#d5dde6] md:grid-cols-3 md:divide-x md:divide-[#d5dde6]">
          {[
            { icon: UserRoundPen, number: "01", title: "예약정보 한 번에 입력", body: "서비스, 시간, 보호자와 반려동물 정보를 고객이 직접 남깁니다." },
            { icon: CalendarCheck2, number: "02", title: "예약 일정 자동 반영", body: "신청한 예약이 오너 일정과 예약 현황에 바로 이어집니다." },
            { icon: Database, number: "03", title: "고객 DB 자동 연결", body: "보호자와 반려동물 정보가 고객관리 화면에 함께 쌓입니다." },
          ].map(({ icon: Icon, number, title, body }) => (
            <li key={number} className="flex gap-4 border-b border-[#d5dde6] py-6 last:border-b-0 md:border-b-0 md:px-6 md:first:pl-0 md:last:pr-0">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-white text-[var(--landing-accent)] shadow-[0_5px_14px_rgba(15,23,42,0.06)]">
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
              <div>
                <span className="text-[15px] font-semibold text-[#94a3b8]">{number}</span>
                <h3 className="mt-1 text-[17px] font-semibold text-[#111827]">{title}</h3>
                <p className="mt-2 text-[15px] leading-6 text-[#64748b]">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function ScheduleProofSection() {
  return (
    <section id="screens" className="scroll-mt-20 border-y border-[#e2e8f0] bg-white py-20 md:py-24">
      <div className="mx-auto w-full max-w-[1180px] px-5">
        <SectionHeading
          eyebrow="실제 운영 화면"
          title="오늘 예약과 직원별 일정을 열자마자 확인하세요"
          description="예약 시간, 담당자, 진행 상태와 고객 상세가 한 화면에 연결됩니다. 월간 캘린더에서는 확정·취소·완료 일정을 날짜별로 확인합니다."
        />

        <div className="mt-12">
          <ScreenshotFrame src="/images/landing/actual-schedule.png" alt="직원별 오늘 예약관리 화면" label="오늘 예약과 담당자별 일정" priority />
        </div>

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-12">
          <ScreenshotFrame src="/images/landing/actual-calendar.png" alt="월간 예약 캘린더 화면" label="월간 캘린더" compact />
          <div className="grid gap-6 sm:grid-cols-3 lg:pt-4">
            <ValueItem icon={<UsersRound className="h-[18px] w-[18px]" />} title="담당자별 예약" body="저장된 직원을 기준으로 예약 열과 담당 필터를 구성합니다." />
            <ValueItem icon={<Clock3 className="h-[18px] w-[18px]" />} title="시간과 상태" body="예약 시간과 확정·진행·완료 상태를 일정 위치에서 확인합니다." />
            <ValueItem icon={<Database className="h-[18px] w-[18px]" />} title="고객 상세" body="예약을 선택하면 보호자, 반려동물, 서비스 기록을 함께 봅니다." />
          </div>
        </div>
      </div>
    </section>
  );
}

export function AutomationSection() {
  return (
    <section className="border-y border-[#e2e8f0] bg-[#f7f8fa] py-20 text-[#111827] md:py-24">
      <div className="mx-auto grid w-full max-w-[1180px] gap-12 px-5 lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:gap-16">
        <div>
          <SectionHeading
            eyebrow="예약 이후까지 연결"
            title="안내 메시지도 매번 기억해서 보내지 마세요"
            description="예약을 받은 뒤 방문 안내와 미용 진행 상태까지 같은 예약을 기준으로 이어집니다. 발송 현황과 남은 알림톡도 오너 화면에서 확인합니다."
          />
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {automationSteps.map(({ icon: Icon, title, body }) => (
              <ValueItem key={title} icon={<Icon className="h-[18px] w-[18px]" />} title={title} body={body} />
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
