import {
  ArrowDown,
  ArrowRight,
  BellRing,
  CalendarCheck2,
  Check,
  ChevronDown,
  Clock3,
  Database,
  Link2,
  MessageSquareText,
  PhoneMissed,
  Scissors,
  UserRoundPen,
  UsersRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { PhoneScreenshot, ScreenshotFrame, SectionHeading, ValueItem } from "@/components/landing/landing-ui";

const bookingDelaySteps = [
  {
    icon: PhoneMissed,
    title: "연락 확인",
    body: "미용하던 손을 멈추고 연락을 확인합니다.",
  },
  {
    icon: MessageSquareText,
    title: "서비스·시간 조율",
    body: "가능한 시간과 서비스를 여러 번 주고받습니다.",
  },
  {
    icon: Scissors,
    title: "현재 미용 지연",
    body: "응대가 길어질수록 미용 시간이 밀립니다.",
  },
  {
    icon: Clock3,
    title: "다음 고객 대기",
    body: "늦어진 일정이 다음 예약까지 이어집니다.",
  },
] as const;

const customerBookingSteps = [
  { icon: Scissors, title: "서비스 선택" },
  { icon: CalendarCheck2, title: "가능한 시간 선택" },
  { icon: Check, title: "예약 신청 완료" },
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
          className="hidden scale-[1.03] object-cover object-center brightness-[0.96] blur-[12px] md:block"
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
            WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 7%, black 100%)",
            maskImage: "linear-gradient(to right, transparent 0%, black 7%, black 100%)",
          }}
        />
      </div>

      <div className="relative mx-auto flex min-h-[760px] w-full max-w-[1180px] items-start px-5 pb-[250px] pt-10 md:h-full md:min-h-0 md:items-center md:pb-16 md:pt-16">
        <div className="max-w-[650px] md:w-[57%] md:pr-10">
          <p className="text-[14px] font-semibold text-[#1f6b5b]">반려동물 미용샵 예약·고객관리</p>
          <h1 id="landing-hero-title" className="mt-4 break-keep text-[34px] font-semibold leading-[1.22] text-[#111827] md:text-[46px]">
            미용하다 놓친 연락,
            <br />고객까지 놓치고 있진 않나요?
          </h1>
          <p className="mt-5 break-keep text-[17px] leading-7 text-[#526071] md:text-[19px] md:leading-8">
            고객은 답을 기다릴 필요 없고,
            <br />오너는 미용하던 손을 멈출 필요 없습니다.
          </p>
          <p className="mt-5 text-[21px] font-semibold text-[#1f6b5b] md:text-[24px]">예약이 넘치는 Day.</p>

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

          <div className="mt-7 hidden flex-wrap gap-x-5 gap-y-2 text-[13px] font-medium text-[#64748b] md:flex">
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
    <section id="pain-points" className="scroll-mt-20 bg-[#f5f7f9] py-18 md:py-24">
      <div className="mx-auto w-full max-w-[1180px] px-5">
        <SectionHeading
          eyebrow="예약 응대의 연쇄 지연"
          title="예약 하나 받느라, 다음 고객까지 기다리게 하고 있진 않나요?"
          description="고객을 놓치지 않으려고 미용 중 예약을 처리하면, 지금 하는 미용부터 다음 고객의 일정까지 함께 밀립니다."
        />

        <div className="mt-10 grid items-stretch gap-4 lg:grid-cols-[minmax(0,0.86fr)_52px_minmax(0,1.14fr)] lg:gap-0">
          <article className="min-w-0 rounded-[8px] border border-[#eadbd6] bg-[#faf6f4] px-5 py-6 md:px-7 md:py-7 lg:flex lg:flex-col">
            <p className="text-[12px] font-semibold text-[#9b5a63]">기존 방식</p>
            <h3 className="mt-2 text-[22px] font-semibold text-[#111827]">지금의 예약 방식</h3>

            <ol className="mt-6 lg:flex lg:flex-1 lg:flex-col lg:justify-around" aria-label="기존 예약 방식의 연쇄 지연 과정">
              {bookingDelaySteps.map(({ icon: Icon, title, body }, index) => (
                <li key={title} className="grid grid-cols-[42px_minmax(0,1fr)] gap-x-3">
                  <span className="flex h-[42px] w-[42px] items-center justify-center rounded-[8px] border border-[#ead5d0] bg-white text-[#a04455]">
                    <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-[#a98288]">0{index + 1}</span>
                      <h4 className="text-[16px] font-semibold text-[#1f2937]">{title}</h4>
                    </div>
                    <p className="mt-1 break-keep text-[13px] leading-5 text-[#705f62] md:text-[14px] md:leading-6">{body}</p>
                  </div>
                  {index < bookingDelaySteps.length - 1 ? (
                    <span className="col-start-1 flex h-8 items-center justify-center text-[#ba9297]" aria-hidden="true">
                      <ArrowDown className="h-4 w-4" />
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          </article>

          <div className="flex h-10 items-center justify-center lg:h-auto" aria-hidden="true">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d4dde5] bg-white text-[#708090] shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
              <ArrowDown className="h-5 w-5 lg:hidden" />
              <ArrowRight className="hidden h-5 w-5 lg:block" />
            </span>
          </div>

          <article className="min-w-0 rounded-[8px] border border-[#cfe0d7] bg-white px-5 py-6 md:px-7 md:py-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[12px] font-semibold text-[#1f6b5b]">넘친 Day</p>
                <h3 className="mt-2 text-[22px] font-semibold text-[#111827]">넘친 Day를 사용하면</h3>
              </div>
              <span className="text-[12px] font-medium text-[#5d756d]">고객 직접 예약</span>
            </div>

            <p className="mt-5 border-l-2 border-[#1f9d55] pl-4 break-keep text-[20px] font-semibold leading-[1.45] text-[#174f42] md:text-[22px]">
              고객이 직접 예약하는 동안,
              <br className="hidden sm:block" /> 오너의 미용은 멈추지 않습니다.
            </p>

            <ol className="mt-6 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center" aria-label="고객 예약 흐름">
              {customerBookingSteps.map(({ icon: Icon, title }, index) => (
                <li key={title} className="contents">
                  <div className="flex min-h-11 items-center gap-2 border-t border-[#d7e7df] bg-[#f7fbf9] px-3 py-2.5 sm:flex-col sm:justify-center sm:text-center">
                    <Icon className="h-4 w-4 shrink-0 text-[#1f6b5b]" aria-hidden="true" />
                    <span className="break-keep text-[12px] font-semibold text-[#334155]">{title}</span>
                  </div>
                  {index < customerBookingSteps.length - 1 ? (
                    <span className="flex h-4 items-center justify-center text-[#8aa99d]" aria-hidden="true">
                      <ArrowDown className="h-4 w-4 sm:hidden" />
                      <ArrowRight className="hidden h-4 w-4 sm:block" />
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>

            <div className="mt-6 grid items-center gap-5 md:grid-cols-[0.88fr_1.12fr]">
              <CustomerBookingMockup />
              <OwnerBookingMockup />
            </div>

            <div className="mt-6 flex items-start gap-3 border-t border-[#dce8e2] pt-5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-[#edf7f1] text-[#1f6b5b]">
                <Scissors className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
              <p className="break-keep text-[15px] font-medium leading-6 text-[#365d52]">
                오너는 미용하던 손을 멈추지 않고, 현재 고객에게 계속 집중합니다.
              </p>
            </div>
          </article>
        </div>

        <div className="mt-9 grid border-y border-[#d8e0e7] bg-white md:grid-cols-[minmax(0,1fr)_56px_minmax(0,1fr)] md:items-center">
          <p className="px-5 py-5 text-center text-[18px] font-medium text-[#475569] md:text-[20px]">고객은 기다리지 않고 예약하고,</p>
          <span className="flex h-8 items-center justify-center text-[#8aa99d] md:h-auto" aria-hidden="true">
            <ArrowDown className="h-5 w-5 md:hidden" />
            <ArrowRight className="hidden h-5 w-5 md:block" />
          </span>
          <p className="px-5 py-5 text-center text-[18px] font-semibold text-[#1f6b5b] md:text-[20px]">오너는 미용의 흐름을 지킵니다.</p>
        </div>
      </div>
    </section>
  );
}

function CustomerBookingMockup() {
  return (
    <div className="mx-auto w-full max-w-[230px]" role="img" aria-label="고객이 서비스와 날짜, 시간을 선택해 예약을 신청하는 모바일 화면 목업">
      <p className="mb-2 text-center text-[12px] font-semibold text-[#64748b]">고객 예약 화면</p>
      <div className="overflow-hidden rounded-[22px] border-[5px] border-[#26343c] bg-white shadow-[0_14px_30px_rgba(15,23,42,0.10)]">
        <div className="flex h-6 items-center justify-center bg-[#26343c]" aria-hidden="true">
          <span className="h-1.5 w-12 rounded-full bg-white/30" />
        </div>
        <div className="px-3 pb-3 pt-3">
          <p className="text-[13px] font-semibold text-[#111827]">간편 예약</p>
          <div className="mt-3">
            <p className="text-[10px] font-medium text-[#64748b]">서비스 선택</p>
            <div className="mt-1 flex h-8 items-center justify-between rounded-[6px] border border-[#dbe4e0] px-2.5 text-[11px] font-medium text-[#334155]">
              전체 미용
              <ChevronDown className="h-3.5 w-3.5 text-[#64748b]" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-[10px] font-medium text-[#64748b]">날짜 및 시간 선택</p>
            <div className="mt-1 grid grid-cols-2 gap-1.5 text-center text-[10px]">
              <span className="rounded-[5px] border border-[#b9d8ca] bg-[#edf7f1] px-1 py-1.5 font-semibold text-[#1f6b5b]">7월 25일</span>
              <span className="rounded-[5px] border border-[#dbe4e0] px-1 py-1.5 text-[#64748b]">7월 26일</span>
              <span className="rounded-[5px] border border-[#b9d8ca] bg-[#edf7f1] px-1 py-1.5 font-semibold text-[#1f6b5b]">13:30</span>
              <span className="rounded-[5px] border border-[#dbe4e0] px-1 py-1.5 text-[#64748b]">15:00</span>
            </div>
          </div>
          <div className="mt-3 flex h-9 items-center justify-center rounded-[7px] bg-[#1f6b5b] text-[11px] font-semibold text-white">예약 신청</div>
        </div>
      </div>
    </div>
  );
}

function OwnerBookingMockup() {
  return (
    <div className="min-w-0" role="img" aria-label="오너가 새 예약 신청의 고객명과 날짜, 시간을 확인하는 화면 목업">
      <p className="mb-2 text-center text-[12px] font-semibold text-[#64748b]">오너 확인 화면</p>
      <div className="overflow-hidden rounded-[8px] border border-[#d8e3dd] bg-[#fbfdfc] shadow-[0_14px_30px_rgba(15,23,42,0.08)]">
        <div className="flex h-8 items-center justify-between border-b border-[#e0e9e4] bg-white px-3">
          <span className="flex gap-1" aria-hidden="true">
            <span className="h-1.5 w-1.5 rounded-full bg-[#d1d9df]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#d1d9df]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#d1d9df]" />
          </span>
          <span className="text-[9px] font-medium text-[#64748b]">예약 관리</span>
        </div>
        <div className="p-3.5">
          <div className="flex items-start gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[#e9f5ef] text-[#1f6b5b]">
              <BellRing className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-[#1f6b5b]">새 예약 신청</p>
              <p className="mt-1 text-[14px] font-semibold text-[#111827]">몽이 · 김지은</p>
            </div>
          </div>
          <dl className="mt-4 space-y-2 border-y border-[#e2ebe6] py-3 text-[11px]">
            <div className="flex justify-between gap-3">
              <dt className="text-[#64748b]">날짜와 시간</dt>
              <dd className="text-right font-semibold text-[#334155]">7월 25일 13:30</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[#64748b]">서비스</dt>
              <dd className="text-right font-semibold text-[#334155]">전체 미용</dd>
            </div>
          </dl>
          <div className="mt-3 flex h-9 items-center justify-center rounded-[7px] border border-[#9fc8b6] bg-white text-[11px] font-semibold text-[#1f6b5b]">예약 확인</div>
        </div>
      </div>
    </div>
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
                <span className="text-[12px] font-semibold text-[#94a3b8]">{number}</span>
              </div>
              <h3 className="mt-4 text-[18px] font-semibold text-[#111827]">{title}</h3>
              <p className="mt-2 text-[14px] leading-6 text-[#64748b]">{body}</p>
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
