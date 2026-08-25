import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Database,
  UsersRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { BookingStructureComparison } from "@/components/landing/landing-booking-structure-comparison";
import { AutomaticNotificationPreview } from "@/components/landing/landing-automatic-notification-preview";
import { OwnerLaptopPreview } from "@/components/landing/landing-booking-flow-carousel";
import { BookingSystemStory } from "@/components/landing/landing-booking-system-story";
import { GalaxyPhoneMockup, SectionHeading } from "@/components/landing/landing-ui";

function LiveOwnerScreen({ view }: { view: "schedule" | "customers" }) {
  return (
    <figure className="min-w-0 w-full">
      <OwnerLaptopPreview view={view} large />
    </figure>
  );
}

function OwnerMobilePlaceholder() {
  return (
    <figure className="mx-auto flex w-full max-w-[190px] flex-col items-center">
      <GalaxyPhoneMockup className="w-full">
        <div
          className="flex h-full flex-col items-center justify-center bg-[linear-gradient(180deg,#f8fbff_0%,#eef5ff_100%)] px-5 text-center"
          aria-label="펫매니저 모바일 앱 화면 연결 예정"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#e0edff] text-[#2563eb]">
            <CalendarDays className="h-5 w-5" aria-hidden="true" />
          </span>
          <strong className="mt-4 break-keep text-[12px] font-semibold leading-5 text-[#172033]">모바일 운영 화면</strong>
          <span className="mt-1 break-keep text-[9px] leading-4 text-[#7b8ca1]">APP 화면 연결 예정</span>
        </div>
      </GalaxyPhoneMockup>
    </figure>
  );
}

function ScheduleFeature({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="relative flex min-w-0 gap-4 py-4 first:pt-0 last:pb-0">
      <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#dbe6f1] bg-white text-[var(--landing-accent)] shadow-[0_5px_16px_rgba(37,99,235,0.09)]">
        {icon}
      </div>
      <div className="min-w-0 pt-0.5">
        <h3 className="break-keep text-[17px] font-semibold leading-6 text-[#111827]">{title}</h3>
        <p className="mt-1.5 break-keep text-[14px] leading-[1.7] text-[#64748b]">{body}</p>
      </div>
    </div>
  );
}

export function HeroSection({ onViewProduct }: { onViewProduct: () => void }) {
  return (
    <section className="relative min-h-[700px] overflow-hidden border-b border-[#e2e8f0] bg-[#f6f8fb] md:h-[clamp(640px,calc(100vh-96px),740px)] md:min-h-0" aria-labelledby="landing-hero-title">
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
          quality={90}
        />
        <Image
          src="/images/landing/hero-groomer-missed-call-v3.png"
          alt="미용 중 울리는 휴대폰 옆에서 반려동물을 미용하는 미용사"
          fill
          priority
          className="hidden object-contain object-[right_top] md:block"
          sizes="100vw"
          quality={90}
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
            {["카드 등록 없이 시작", "설치비 없음", "보호자 화면 광고 없음", "기존 데이터 이전 지원"].map((item) => (
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
      <div className="bg-white px-5 pb-10 pt-8 text-center md:pb-12 md:pt-10">
        <header className="mx-auto max-w-[1180px]">
          <div>
            <blockquote className="relative mr-auto w-[94%] max-w-[500px] rounded-[16px] border border-[#d8e0e9] bg-[#f6f8fa] px-5 py-6 text-left md:w-[42%]">
              <p className="text-[15px] font-semibold text-[#64748b]">예약하려는 고객</p>
              <p className="hidden" aria-hidden="true">
                전화를 안 받는 매장에는
                <br />다시 걸고 싶지 않아요.
              </p>
              <p className="mt-3 break-keep text-[25px] font-semibold leading-[1.35] text-[#111827] md:text-[30px]">
                연락을 늦게 받거나 안 받는 매장은<br />다시 안 찾게 돼요.
              </p>
              <span className="absolute -bottom-[9px] left-9 h-4 w-4 rotate-45 border-b border-r border-[#d8e0e9] bg-[#f6f8fa]" aria-hidden="true" />
            </blockquote>

            <blockquote className="relative ml-auto mt-6 w-[94%] max-w-[670px] rounded-[16px] border border-[#d8e0e9] bg-[#f6f8fa] px-6 py-6 text-right sm:px-8 md:mt-8 md:w-[57%]">
              <p className="text-[15px] font-semibold text-[#64748b]">미용을 맡긴 고객</p>
              <p className="hidden" aria-hidden="true">
                다른 손님 전화 받느라
                <br />우리 아이도, 저도 기다리게 하는 매장은 더 싫어요.
              </p>
              <p className="mt-3 break-keep text-[25px] font-semibold leading-[1.35] text-[#111827] md:text-[30px]">
                예약 시간 맞춰 갔는데,<br />다른 아이 미용이 안 끝나서 한참 기다렸어요.
              </p>
              <span className="absolute -bottom-[9px] right-9 h-4 w-4 rotate-45 border-b border-r border-[#d8e0e9] bg-[#f6f8fa]" aria-hidden="true" />
            </blockquote>

            <blockquote className="relative mr-auto mt-6 w-[94%] max-w-[500px] rounded-[16px] border border-[#d8e0e9] bg-[#f6f8fa] px-6 py-6 text-left sm:px-8 md:mt-8 md:w-[43%]">
              <p className="text-[15px] font-semibold text-[#64748b]">미용 중인 대표님</p>
              <p className="mt-3 break-keep text-[25px] font-semibold leading-[1.35] text-[#111827] md:text-[30px]">
                미용 중엔 손이 멈출 수 없는데,<br />전화는 계속 울려요.
              </p>
              <span className="absolute -bottom-[9px] left-9 h-4 w-4 rotate-45 border-b border-r border-[#d8e0e9] bg-[#f6f8fa]" aria-hidden="true" />
            </blockquote>
          </div>
          <blockquote className="hidden" aria-hidden="true">
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

    </section>
  );
}

export function BookingSystemSection() {
  return (
    <div id="booking-system" className="scroll-mt-16">
      <BookingSystemStory />
    </div>
  );
}

export function ScheduleProofSection() {
  return (
    <section id="screens" className="scroll-mt-20 border-y border-[#e2e8f0] bg-white py-12 md:py-14">
      <div className="mx-auto w-full max-w-[1180px] px-5">
        <header className="max-w-[760px]">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#d7e0eb] bg-white px-1.5 py-1 text-[13px] font-semibold shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
            <span className="rounded-full bg-[#111b32] px-2 py-0.5 tracking-[0.04em] text-white">STEP 05</span>
            <span className="pr-1 text-[#526071]">실시간 운영 관리</span>
          </div>
          <h2 className="mt-4 break-keep text-[34px] font-semibold leading-[1.2] text-[#111827] [text-wrap:balance] md:text-[44px]">오늘 운영, 한 화면이면 충분합니다</h2>
          <p className="mt-5 max-w-[720px] break-keep text-[16px] leading-7 text-[#526071] md:text-[17px] md:leading-8">담당자별 예약과 빈 시간, 서비스, 요청사항을 한 화면에서 확인하고 바로 관리하세요.</p>
        </header>

        <div className="mt-8 grid items-start gap-10 lg:grid-cols-[292px_minmax(0,1fr)] lg:gap-7">
          <div className="relative grid gap-1 before:absolute before:bottom-5 before:left-5 before:top-5 before:w-px before:bg-[#dbe6f1] sm:grid-cols-3 sm:gap-6 sm:before:hidden lg:grid-cols-1 lg:gap-1 lg:before:block">
            <ScheduleFeature icon={<Clock3 className="h-[18px] w-[18px]" />} title="빈 시간까지 바로 확인" body="예약 사이의 빈 시간과 오늘 남은 시간을 한눈에 파악합니다." />
            <ScheduleFeature icon={<UsersRound className="h-[18px] w-[18px]" />} title="담당별 일정 한눈에" body="고객·반려동물·서비스·담당자를 한 화면에서 확인합니다." />
            <ScheduleFeature icon={<Database className="h-[18px] w-[18px]" />} title="클릭하면 상세 정보까지" body="예약을 누르면 요청사항과 코멘트가 바로 이어집니다." />
          </div>

          <div className="grid min-w-0 items-center gap-5 sm:relative sm:block sm:pb-3 sm:pr-[32px]">
            <div className="relative z-0 min-w-0">
              <LiveOwnerScreen view="schedule" />
            </div>
            <div className="relative z-10 sm:absolute sm:bottom-0 sm:right-0 sm:w-[190px]">
              <OwnerMobilePlaceholder />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function AutomaticNotificationSection() {
  return (
      <section id="solution-automatic-notifications" className="scroll-mt-20 border-b border-[#e2e8f0] bg-white py-14 md:py-16">
        <div className="mx-auto w-full max-w-[1180px] px-5">
          <header className="max-w-[800px]">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d7e0eb] bg-white px-1.5 py-1 text-[13px] font-semibold shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
              <span className="rounded-full bg-[#111b32] px-2 py-0.5 tracking-[0.04em] text-white">STEP 06</span>
              <span className="pr-1 text-[#526071]">자동 예약 안내</span>
            </div>
            <h2 className="mt-4 break-keep text-[34px] font-semibold leading-[1.2] text-[#111827] [text-wrap:balance] md:text-[48px]">보내야 할 메시지,<br />손이 갈 일이 없습니다</h2>
            <p className="mt-5 max-w-[720px] break-keep text-[16px] leading-7 text-[#526071] md:text-[17px] md:leading-8">전화와 메시지를 일일이 확인하지 않아도, 필요한 순간에 딱 한 번 전달돼요.<br /><strong className="font-semibold text-[#172033]">누르는 건 한 번뿐, 놓치는 고객은 없습니다.</strong></p>
          </header>

          <AutomaticNotificationPreview />
      </div>
    </section>
  );
}
