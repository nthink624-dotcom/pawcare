import {
  ArrowRight,
  BellRing,
  CalendarCheck2,
  Camera,
  Check,
  Clock3,
  Database,
  Link2,
  Sparkles,
  UsersRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { BookingStructureComparison } from "@/components/landing/landing-booking-structure-comparison";
import { OwnerLaptopPreview } from "@/components/landing/landing-booking-flow-carousel";
import { BookingSystemStory } from "@/components/landing/landing-booking-system-story";
import { SectionHeading, ValueItem } from "@/components/landing/landing-ui";

const automationSteps = [
  { icon: Link2, title: "예약 접수", body: "고객이 예약 링크에서 필요한 정보를 남깁니다." },
  { icon: CalendarCheck2, title: "방문 안내", body: "예약에 맞는 방문 안내 알림톡을 한 번 보냅니다." },
  { icon: Camera, title: "미용 전후 사진", body: "미용 전·후 사진을 기록하고 보호자에게 함께 전송합니다." },
  { icon: BellRing, title: "AI 알림장 초안", body: "미용 기록과 전후 사진을 바탕으로 보호자에게 보낼 문구를 먼저 작성합니다." },
] as const;

function LiveOwnerScreen({ label, view }: { label: string; view: "schedule" | "customers" }) {
  return (
    <figure className="overflow-hidden rounded-[8px] border border-[#d8e0e9] bg-white shadow-[0_14px_38px_rgba(15,23,42,0.08)]">
      <figcaption className="flex h-11 items-center justify-between border-b border-[#e7edf3] bg-[#fbfcfe] px-4 text-[15px] font-medium text-[#64748b]">
        <span>{label}</span>
        <span className="text-[13px] text-[var(--landing-accent)]">실제 제품 화면</span>
      </figcaption>
      <div className="bg-[#f4f6f9] px-3 pb-3 pt-4 sm:px-6 sm:pb-5 sm:pt-6">
        <OwnerLaptopPreview view={view} large />
      </div>
    </figure>
  );
}

function NotificationFlowCard() {
  return (
    <aside className="rounded-[8px] border border-[#d8e0e9] bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.08)] sm:p-6" aria-label="예약 안내 발송 흐름">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-[var(--landing-accent)]">예약 안내 자동 발송</p>
          <h3 className="mt-1 text-[20px] font-semibold text-[#172033]">필요한 시점에 한 번만 안내합니다</h3>
        </div>
        <span className="rounded-full bg-[var(--landing-accent-soft)] px-2.5 py-1 text-[12px] font-semibold text-[var(--landing-accent)]">발송 현황 확인</span>
      </div>
      <div className="mt-5 grid gap-3">
        {[
          ["예약 접수", "고객이 예약 링크에서 필요한 정보를 직접 입력"],
          ["방문 전 안내", "내일·오늘·직전 중 가장 알맞은 안내 한 번 발송"],
          ["발송 뒤 확인", "발송 상태와 매장 알림톡 잔여 건수를 함께 확인"],
        ].map(([title, body], index) => (
          <div key={title} className="flex gap-3 rounded-[8px] bg-[#f7f9fb] p-3.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[12px] font-semibold text-[var(--landing-accent)] shadow-sm">0{index + 1}</span>
            <div>
              <p className="text-[14px] font-semibold text-[#172033]">{title}</p>
              <p className="mt-1 text-[13px] leading-5 text-[#64748b]">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

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
      <div className="bg-white px-5 pb-14 pt-12 text-center md:pb-16 md:pt-14">
        <header className="mx-auto max-w-[1180px]">
          <div>
            <blockquote className="relative mr-auto w-[94%] max-w-[500px] rounded-[16px] border border-[#d8e0e9] bg-[#f6f8fa] px-5 py-7 text-left sm:px-5 sm:py-8 md:w-[42%]">
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

            <blockquote className="relative ml-auto mt-10 w-[94%] max-w-[670px] rounded-[16px] border border-[#d8e0e9] bg-[#f6f8fa] px-6 py-7 text-right sm:px-8 sm:py-8 md:mt-16 md:w-[57%]">
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

            <blockquote className="relative mr-auto mt-10 w-[94%] max-w-[500px] rounded-[16px] border border-[#d8e0e9] bg-[#f6f8fa] px-6 py-7 text-left sm:px-8 sm:py-8 md:mt-16 md:w-[43%]">
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
    <section id="screens" className="scroll-mt-20 border-y border-[#e2e8f0] bg-white py-20 md:py-24">
      <div className="mx-auto w-full max-w-[1180px] px-5">
        <SectionHeading
          eyebrow="실제 운영 화면"
          title="오늘 예약, 누가 언제 맡는지 한 화면에서"
          description="예약 시간, 담당자, 진행 상태를 먼저 확인하고, 예약에 남긴 정보는 고객관리 화면에서 바로 이어서 봅니다."
        />

        <div className="mt-12">
          <LiveOwnerScreen label="오늘 예약과 담당자별 일정" view="schedule" />
        </div>

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-12">
          <LiveOwnerScreen label="예약과 함께 쌓이는 고객 정보" view="customers" />
          <div className="grid gap-6 sm:grid-cols-3 lg:pt-4">
            <ValueItem icon={<UsersRound className="h-[18px] w-[18px]" />} title="담당자별 예약" body="저장된 직원을 기준으로 예약 열과 담당 필터를 구성합니다." />
            <ValueItem icon={<Clock3 className="h-[18px] w-[18px]" />} title="시간과 상태" body="예약 시간과 확정·진행·완료 상태를 일정 위치에서 확인합니다." />
            <ValueItem icon={<Database className="h-[18px] w-[18px]" />} title="고객 정보 연결" body="예약을 선택하면 보호자, 반려동물, 서비스 기록을 함께 봅니다." />
          </div>
        </div>
      </div>
    </section>
  );
}

export function AutomationSection() {
  return (
    <section id="automation" className="scroll-mt-20 border-y border-[#e2e8f0] bg-[#f7f8fa] py-20 text-[#111827] md:py-24">
      <div className="mx-auto grid w-full max-w-[1180px] gap-12 px-5 lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:gap-16">
        <div>
          <SectionHeading
            eyebrow="예약 이후까지 연결"
            title="미용 기록을 바탕으로, 알림장 초안을 먼저 준비합니다."
            description="예약 안내는 놓치지 않게 관리하고, 미용이 끝난 뒤에는 기록과 사진을 바탕으로 보호자에게 보낼 알림장 초안을 준비합니다. 오너가 확인하고 고쳐서 발송합니다."
          />
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {automationSteps.map(({ icon: Icon, title, body }) => (
              <ValueItem key={title} icon={<Icon className="h-[18px] w-[18px]" />} title={title} body={body} />
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <NotificationFlowCard />

          <aside className="rounded-[8px] border border-[#c9e2da] bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.08)] sm:p-6" aria-label="출시 예정 AI 알림장 초안 예시">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-[#e8f6ef] text-[var(--landing-accent)]">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[18px] font-semibold text-[#173f37]">AI 알림장 초안</h3>
                  <span className="rounded-full border border-[#b7d8cb] bg-[#f0faf5] px-2 py-0.5 text-[12px] font-semibold text-[#247a53]">출시 예정</span>
                </div>
                <p className="mt-1 text-[14px] leading-6 text-[#58736c]">사진과 미용 기록을 바탕으로, 보호자에게 보낼 문구를 먼저 작성합니다.</p>
              </div>
            </div>

            <div className="mt-5 rounded-[8px] border border-[#dce8e2] bg-[#f8fcfa] p-4 text-[14px] leading-6 text-[#355a4d]">
              <p className="font-semibold text-[#173f37]">보리 보호자님, 오늘 미용이 완료되었어요.</p>
              <p className="mt-2">목욕과 부분정리를 마쳤고, 발 주변과 귀 상태도 함께 살펴보았습니다. 사진으로 오늘 모습을 확인해 주세요.</p>
            </div>

            <div className="mt-4 rounded-[8px] border border-[#dce8e2] bg-white p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[14px] font-semibold text-[#173f37]"><Camera className="h-4 w-4 text-[var(--landing-accent)]" aria-hidden="true" />미용 전후 사진도 함께 전송</div>
                <span className="text-[12px] font-medium text-[#58736c]">보호자 알림장 첨부</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="flex min-h-16 items-center gap-2 rounded-[6px] border border-dashed border-[#bfd8ca] bg-[#f6fbf8] px-3 text-[13px] font-semibold text-[#3f6c5a]"><span className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-white text-[#26704b]"><Camera className="h-4 w-4" aria-hidden="true" /></span>미용 전 사진</div>
                <div className="flex min-h-16 items-center gap-2 rounded-[6px] border border-[#b7d8cb] bg-[#edf8f1] px-3 text-[13px] font-semibold text-[#1f714a]"><span className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-white text-[#26704b]"><Camera className="h-4 w-4" aria-hidden="true" /></span>미용 후 사진</div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e3eee8] pt-4">
              <div className="flex flex-wrap gap-2 text-[12px] font-medium text-[#58736c]">
                <span className="rounded-full bg-[#edf5f1] px-2.5 py-1">미용 기록 반영</span>
                <span className="rounded-full bg-[#edf5f1] px-2.5 py-1">사진 3장 반영</span>
              </div>
              <span className="text-[13px] font-semibold text-[var(--landing-accent)]">오너 확인 후 발송</span>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
