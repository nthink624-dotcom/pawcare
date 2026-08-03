import { ArrowDown, ArrowRight, Check, Scissors } from "lucide-react";
import type { ReactNode } from "react";

const manualBookingSteps = [
  "전화·문자·DM 문의 확인",
  "원하는 미용 서비스 확인",
  "반려동물·보호자 정보 확인",
  "예약 가능한 시간 확인",
  "고객과 서비스·시간 조율",
  "예약 내용을 일정에 직접 입력",
  "고객 정보를 장부에 따로 기록",
] as const;

const customerBookingSteps = [
  "원하는 미용 서비스 선택",
  "예약 가능한 날짜·시간 선택",
  "보호자·반려동물 정보 입력",
] as const;

const connectedBookingResults = [
  "서비스·시간 조율 완료",
  "예약 일정 자동 반영",
  "고객정보 자동 저장",
  "예약 현황에서 바로 확인",
] as const;

export function BookingStructureComparison() {
  return (
    <section className="border-b border-[#e2e8f0] bg-[#f6f8fa]" aria-labelledby="booking-structure-title">
      <div className="mx-auto w-full max-w-[1180px] px-5 py-16 md:py-20">
        <header className="text-center">
          <p className="text-[15px] font-semibold text-[var(--landing-accent)]">예약 구조 비교</p>
          <h3 id="booking-structure-title" className="mt-3 break-keep text-[28px] font-semibold leading-[1.3] text-[#111827] md:text-[36px]">
            같은 예약 문의도, 처리 구조는 완전히 다릅니다.
          </h3>
        </header>

        <div className="mt-12 space-y-8">
          <article className="rounded-[8px] border border-[#d8e0e9] bg-white p-5 sm:p-7 md:p-9" aria-labelledby="manual-booking-title">
            <header>
              <p className="text-[15px] font-semibold text-[#64748b]">일반 예약의 구조</p>
              <h4 id="manual-booking-title" className="mt-2 break-keep text-[24px] font-semibold leading-[1.35] text-[#111827] md:text-[30px]">
                예약 한 건을 직접 처리하는 동안, 두 가지 문제가 동시에 생깁니다.
              </h4>
              <p className="mt-3 break-keep text-[15px] leading-7 text-[#64748b] md:text-[17px]">
                7단계가 끝난 뒤가 아니라, 이 과정을 진행하는 내내 현재 미용과 다음 일정이 영향을 받습니다.
              </p>
            </header>

            <div className="mt-8 grid items-stretch gap-5 lg:grid-cols-[410px_170px_minmax(0,1fr)]">
              <ProcessPanel eyebrow="오너가 직접 처리" title="예약 응대 7단계" steps={manualBookingSteps} />
              <DuringConnector label={<>이 모든 과정을<br />진행하는 내내</>} />
              <ManualOutcomePanel />
            </div>
          </article>

          <div className="flex items-center justify-center gap-3 text-[#64748b]" aria-hidden="true">
            <span className="h-px w-16 bg-[#cbd5e1]" />
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#cbd5e1] bg-white">
              <ArrowDown className="h-5 w-5" />
            </span>
            <span className="h-px w-16 bg-[#cbd5e1]" />
          </div>

          <article className="rounded-[8px] border border-[#b8c4d3] bg-white p-5 sm:p-7 md:p-9" aria-labelledby="petmanager-booking-title">
            <header>
              <p className="text-[15px] font-semibold text-[var(--landing-accent)]">넘친 Day 예약 구조</p>
              <h4 id="petmanager-booking-title" className="mt-2 break-keep text-[24px] font-semibold leading-[1.35] text-[#111827] md:text-[30px]">
                고객이 직접 예약하면, 필요한 정보가 한 번에 연결됩니다.
              </h4>
              <p className="mt-3 break-keep text-[15px] leading-7 text-[#64748b] md:text-[17px]">
                고객이 선택하고 입력하는 동안 오너는 지금 하던 미용을 계속하고, 들어온 예약만 확인합니다.
              </p>
            </header>

            <div className="mt-8 grid items-stretch gap-5 lg:grid-cols-[410px_170px_minmax(0,1fr)]">
              <ProcessPanel eyebrow="고객이 직접 진행" title="예약 신청 3단계" steps={customerBookingSteps} accent />
              <DuringConnector label={<>고객이 입력하면<br />즉시 자동 연결</>} accent />
              <ConnectedOutcomePanel />
            </div>
          </article>
        </div>

        <p className="mx-auto mt-10 max-w-[840px] border-t border-[#d8e0e9] pt-7 text-center text-[18px] font-semibold leading-8 text-[#334155] md:text-[21px]">
          일반 예약은 오너가 일곱 번 움직이고, 넘친 Day에서는 고객이 입력하면 오너는 확인만 합니다.
        </p>
      </div>
    </section>
  );
}

function ProcessPanel({
  eyebrow,
  title,
  steps,
  accent = false,
}: {
  eyebrow: string;
  title: string;
  steps: readonly string[];
  accent?: boolean;
}) {
  return (
    <div className="rounded-[8px] border border-[#d8e0e9] bg-[#fbfcfd] p-5 sm:p-6">
      <p className={`text-[15px] font-semibold ${accent ? "text-[var(--landing-accent)]" : "text-[#64748b]"}`}>{eyebrow}</p>
      <p className="mt-1 text-[21px] font-semibold text-[#111827]">{title}</p>
      <ol className="mt-5">
        {steps.map((step, index) => (
          <li key={step}>
            <div className="flex min-h-12 items-center gap-3 rounded-[8px] border border-[#dde4ec] bg-white px-4 py-3 text-[15px] font-medium text-[#334155]">
              <span className={`text-[15px] font-semibold ${accent ? "text-[var(--landing-accent)]" : "text-[#94a3b8]"}`}>
                {String(index + 1).padStart(2, "0")}
              </span>
              {step}
            </div>
            {index < steps.length - 1 ? <ArrowDown className="mx-auto my-1 h-4 w-4 text-[#94a3b8]" aria-hidden="true" /> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

function DuringConnector({ label, accent = false }: { label: ReactNode; accent?: boolean }) {
  return (
    <div className="flex items-center justify-center py-2 lg:relative lg:py-0" aria-hidden="true">
      <span className={`hidden lg:absolute lg:inset-y-8 lg:left-3 lg:w-7 lg:border-y lg:border-r ${accent ? "border-[#64748b]" : "border-[#94a3b8]"}`} />
      <span className="relative z-10 flex items-center gap-2 rounded-[8px] border border-[#cbd5e1] bg-white px-4 py-3 text-center text-[15px] font-semibold leading-6 text-[#475569]">
        <span className="whitespace-nowrap">{label}</span>
        <ArrowDown className="h-5 w-5 shrink-0 lg:hidden" />
        <ArrowRight className="hidden h-5 w-5 shrink-0 lg:block" />
      </span>
    </div>
  );
}

function ManualOutcomePanel() {
  return (
    <div className="flex flex-col rounded-[8px] border border-[#d8e0e9] bg-[#fbfcfd] p-5 sm:p-6">
      <p className="text-center text-[15px] font-semibold text-[#475569]">두 가지 문제가 동시에 발생</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <OutcomeItem number="1" title="현재 미용 중단" body="지금 맡긴 아이와 보호자가 기다립니다." />
        <OutcomeItem number="2" title="다음 예약 지연" body="밀린 시간이 다음 고객에게 그대로 이어집니다." />
      </div>
      <MergeConnector />
      <div className="mt-auto rounded-[8px] bg-[#475569] px-5 py-5 text-center text-white">
        <p className="break-keep text-[17px] font-semibold md:text-[19px]">현재 고객과 다음 고객 모두 기다립니다</p>
        <p className="mt-2 text-[15px] text-[#e2e8f0]">고객 불만과 매장 일정 차질로 이어집니다.</p>
      </div>
    </div>
  );
}

function OutcomeItem({ number, title, body }: { number: string; title: string; body: string }) {
  return (
    <div className="rounded-[8px] border border-[#d8e0e9] bg-[#f1f4f7] p-4">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#64748b] text-[15px] font-semibold text-white">{number}</span>
      <p className="mt-3 text-[17px] font-semibold text-[#334155]">{title}</p>
      <p className="mt-2 break-keep text-[15px] leading-6 text-[#64748b]">{body}</p>
    </div>
  );
}

function ConnectedOutcomePanel() {
  return (
    <div className="flex flex-col rounded-[8px] border border-[#cbd5e1] bg-[#fbfcfd] p-5 sm:p-6">
      <p className="text-center text-[15px] font-semibold text-[#334155]">예약과 고객정보가 자동으로 연결</p>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {connectedBookingResults.map((item) => (
          <li key={item} className="flex min-h-12 items-center gap-3 rounded-[8px] border border-[#d8e0e9] bg-white px-4 py-3 text-[15px] font-medium text-[#334155]">
            <Check className="h-4 w-4 shrink-0 text-[var(--landing-accent)]" aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
      <div className="my-6 flex items-center justify-center text-[var(--landing-accent)]" aria-hidden="true">
        <ArrowDown className="h-5 w-5" />
      </div>
      <div className="mt-auto rounded-[8px] bg-[var(--landing-accent)] px-5 py-5 text-center text-white">
        <Scissors className="mx-auto h-5 w-5" aria-hidden="true" />
        <p className="mt-3 break-keep text-[17px] font-semibold md:text-[19px]">오너는 들어온 예약만 확인합니다</p>
        <p className="mt-2 text-[15px] text-[#e2e8f0]">고객은 기다리지 않고, 오너의 미용은 멈추지 않습니다.</p>
      </div>
    </div>
  );
}

function MergeConnector() {
  return (
    <div className="relative my-2 hidden h-14 sm:block" aria-hidden="true">
      <span className="absolute left-1/4 top-0 h-5 w-px bg-[#94a3b8]" />
      <span className="absolute right-1/4 top-0 h-5 w-px bg-[#94a3b8]" />
      <span className="absolute left-1/4 right-1/4 top-5 h-px bg-[#94a3b8]" />
      <span className="absolute left-1/2 top-5 h-7 w-px bg-[#94a3b8]" />
      <ArrowDown className="absolute bottom-0 left-1/2 h-4 w-4 -translate-x-1/2 text-[#94a3b8]" />
    </div>
  );
}
