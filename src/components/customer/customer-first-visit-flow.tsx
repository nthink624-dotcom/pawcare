"use client";

import {
  Bath,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ClipboardList,
  PawPrint,
  Phone,
  Scissors,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import type { CustomerServiceSourceOption } from "@/lib/customer-service-options";
import { cn, formatServicePrice } from "@/lib/utils";
import type { Appointment, Service, Shop } from "@/types/domain";

type FirstVisitStep = 1 | 2 | 3 | 4;

type DateOption = {
  value: string;
  label: string;
  weekday: string;
};

type FirstVisitForm = {
  ownerName: string;
  phone: string;
  petName: string;
  date: string;
  timeSlot: string;
  serviceId: string;
  customerServiceOptionId: string;
  customServiceName: string;
  note: string;
};

type BookingCompletion = {
  appointment: Appointment;
  bookingManageUrl: string;
};

const CUSTOM_SERVICE_ID = "__custom__";
const brown = "#8B5E3C";

function getHeroImage(shop: Shop) {
  return shop.customer_page_settings?.hero_image_url || "/images/customer-booking-hero-retriever-bath.jpg";
}

function getShopDisplayName(shop: Shop) {
  return shop.name;
}

function getShopTagline(shop: Shop) {
  return shop.customer_page_settings?.tagline?.trim() || shop.description || "아이 성향에 맞춘 차분한 그루밍을 도와드려요.";
}

function getTodayHours(shop: Shop) {
  const today = new Date().getDay();
  const hours = shop.business_hours?.[today];
  if (!hours?.enabled) return "휴무";
  return `${hours.open.slice(0, 5)} - ${hours.close.slice(0, 5)}`;
}

function formatDurationRange(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return "상담 후 안내";
  if (minutes <= 30) return "30분~60분";
  if (minutes <= 60) return "60분~90분";
  if (minutes <= 90) return "90분~120분";
  return `${minutes}분~${minutes + 30}분`;
}

function getServiceMeta(serviceName: string) {
  const name = serviceName.replace(/\s/g, "");
  if (name.includes("목욕")) return { icon: Bath, description: "목욕 + 드라이" };
  if (name.includes("부분")) return { icon: Scissors, description: "발, 엉덩이 등 부분 관리" };
  if (name.includes("위생")) return { icon: Sparkles, description: "발톱, 귀, 항문 등 위생 관리" };
  if (name.includes("상담")) return { icon: ClipboardList, description: "원하는 스타일 상담 후 결정" };
  return { icon: Scissors, description: "목욕 + 컷 전체 관리" };
}

function buildReservationNumber(appointment?: Appointment | null) {
  if (!appointment) return "접수 후 발급";
  const datePart = appointment.appointment_date.replace(/-/g, "").slice(2);
  const rawSuffix = appointment.id.replace(/\D/g, "").slice(-3) || appointment.id.replace(/-/g, "").slice(-3).toUpperCase();
  return `PM${datePart}-${rawSuffix.padStart(3, "0")}`;
}

function formatTimeForSummary(value: string) {
  if (!value) return "-";
  const [hour, minute] = value.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
  return `${hour < 12 ? "오전" : "오후"} ${String(hour % 12 || 12).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatDateForSummary(value: string) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${weekdays[date.getDay()]})`;
}

function BookingShell({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-[#fffaf3] px-3 pb-28 pt-3 text-[#2b241f]">{children}</div>;
}

function TopStepChip({ step, label }: { step: number; label: string }) {
  return (
    <div className="mb-2 flex items-center justify-center gap-2 text-[14px] font-semibold tracking-[-0.02em] text-[#2b241f]">
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#8B5E3C] text-[12px] text-white">{step}</span>
      {label}
    </div>
  );
}

function BookingStepHeader({ title, subtitle, step, onBack }: { title: string; subtitle: string; step: FirstVisitStep; onBack: () => void }) {
  return (
    <div className="rounded-[18px] border border-[#eadbc9] bg-white px-4 py-3 shadow-[0_14px_32px_rgba(139,94,60,0.08)]">
      <div className="relative flex min-h-10 items-center justify-center">
        <button
          type="button"
          onClick={onBack}
          className="absolute left-0 inline-flex h-8 w-8 items-center justify-center rounded-[10px] text-[#2b241f] transition hover:bg-[#f7eee3]"
          aria-label="이전"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={1.9} />
        </button>
        <div className="min-w-0 px-10 text-center">
          <h2 className="truncate text-[16px] font-semibold tracking-[-0.03em]">{title}</h2>
          <p className="mt-0.5 text-[12px] font-medium text-[#8b7767]">{subtitle}</p>
        </div>
        <span className="absolute right-0 text-[12px] font-semibold text-[#8b7767]">{step}/4</span>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-[#eadbc9]">
        <div className="h-full rounded-full bg-[#8B5E3C]" style={{ width: `${(step / 4) * 100}%` }} />
      </div>
    </div>
  );
}

function FooterActions({
  primaryLabel,
  secondaryLabel = "이전",
  primaryDisabled,
  submitting,
  onPrimary,
  onSecondary,
  single = false,
}: {
  primaryLabel: string;
  secondaryLabel?: string;
  primaryDisabled?: boolean;
  submitting?: boolean;
  onPrimary: () => void | Promise<void>;
  onSecondary?: () => void;
  single?: boolean;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[430px] border-t border-[#eadbc9] bg-[#fffaf3]/95 px-4 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3 backdrop-blur">
      <div className={cn("grid gap-2", single ? "grid-cols-1" : "grid-cols-[0.78fr_1.22fr]")}>
        {!single && onSecondary ? (
          <button
            type="button"
            onClick={onSecondary}
            className="h-12 rounded-[10px] border border-[#eadbc9] bg-white text-[16px] font-semibold tracking-[-0.02em] text-[#2b241f]"
          >
            {secondaryLabel}
          </button>
        ) : null}
        <button
          type="button"
          disabled={primaryDisabled || submitting}
          onClick={() => void onPrimary()}
          className="h-12 rounded-[10px] bg-[#8B5E3C] text-[16px] font-semibold tracking-[-0.02em] text-white shadow-[0_14px_24px_rgba(139,94,60,0.22)] transition hover:bg-[#744a2f] disabled:cursor-not-allowed disabled:bg-[#b9a99a] disabled:shadow-none"
        >
          {submitting ? "예약 요청 중..." : primaryLabel}
        </button>
      </div>
    </div>
  );
}

function ServiceOptionCard({
  title,
  description,
  duration,
  price,
  active,
  onClick,
}: {
  title: string;
  description: string;
  duration: string;
  price: string;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = getServiceMeta(title).icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative w-full rounded-[14px] border px-3 py-2.5 text-left transition",
        active ? "border-[#8B5E3C] bg-[#f6eadc] shadow-[0_10px_22px_rgba(139,94,60,0.10)]" : "border-[#eadbc9] bg-white hover:bg-[#fff9f1]",
      )}
    >
      <div className="flex items-center gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#fff7ef] text-[#8B5E3C]">
          <Icon className="h-5 w-5" strokeWidth={1.9} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold tracking-[-0.03em] text-[#2b241f]">{title}</span>
          <span className="mt-0.5 block truncate text-[12px] font-medium tracking-[-0.02em] text-[#8b7767]">{description}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-[12px] font-semibold text-[#8B5E3C]">{duration}</span>
          <span className="mt-0.5 block text-[12px] font-semibold text-[#8B5E3C]">{price}</span>
        </span>
      </div>
      {active ? (
        <span className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#8B5E3C] text-white">
          <Check className="h-3.5 w-3.5" strokeWidth={2.2} />
        </span>
      ) : null}
    </button>
  );
}

function CustomerInput({
  icon: Icon,
  label,
  value,
  placeholder,
  onChange,
  inputMode,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  inputMode?: "text" | "tel";
}) {
  return (
    <label className="block rounded-[14px] border border-[#eadbc9] bg-white px-3.5 py-3 shadow-[0_10px_20px_rgba(139,94,60,0.05)]">
      <span className="mb-2 flex items-center gap-2 text-[14px] font-semibold text-[#5f4734]">
        <Icon className="h-4 w-4 text-[#8B5E3C]" strokeWidth={1.9} />
        {label}
      </span>
      <input
        value={value}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-[10px] border border-[#eadbc9] bg-white px-3 text-[16px] text-[#2b241f] outline-none placeholder:text-[#b8a79a] focus:border-[#8B5E3C]"
      />
    </label>
  );
}

export default function CustomerFirstVisitFlow({
  shop,
  customerServiceOptions,
  dateOptions,
  firstVisit,
  step,
  selectedService,
  selectedServiceOption,
  availableSlots,
  loadingSlots,
  submitting,
  completedBooking,
  onBackToEntry,
  onStepBack,
  onNext,
  onSubmit,
  onOpenShopInfo,
  onServiceSelect,
  onDateSelect,
  onTimeSelect,
  onOwnerNameChange,
  onPhoneChange,
  onPetNameChange,
  onNoteChange,
  onGoManage,
}: {
  shop: Shop;
  customerServiceOptions: CustomerServiceSourceOption[];
  dateOptions: DateOption[];
  firstVisit: FirstVisitForm;
  step: FirstVisitStep;
  selectedService?: Service;
  selectedServiceOption?: CustomerServiceSourceOption;
  availableSlots: string[];
  loadingSlots: boolean;
  submitting: boolean;
  completedBooking: BookingCompletion | null;
  onBackToEntry: () => void;
  onStepBack: () => void;
  onNext: () => void;
  onSubmit: () => Promise<void>;
  onOpenShopInfo: () => void;
  onServiceSelect: (serviceOptionId: string) => void;
  onDateSelect: (date: string) => void;
  onTimeSelect: (time: string) => void;
  onOwnerNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onPetNameChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onGoManage: () => void;
}) {
  const [showAllTimes, setShowAllTimes] = useState(false);
  const visibleDates = dateOptions.slice(0, 7);
  const visibleSlots = useMemo(() => {
    if (showAllTimes) return availableSlots;
    const firstSlots = availableSlots.slice(0, 9);
    return firstVisit.timeSlot && !firstSlots.includes(firstVisit.timeSlot)
      ? [firstVisit.timeSlot, ...firstSlots].slice(0, 9)
      : firstSlots;
  }, [availableSlots, firstVisit.timeSlot, showAllTimes]);
  const serviceSummaryName = firstVisit.serviceId === CUSTOM_SERVICE_ID ? "상담 후 결정" : selectedServiceOption?.name || selectedService?.name || "서비스 선택";
  const serviceSummaryDuration =
    firstVisit.serviceId === CUSTOM_SERVICE_ID ? "90분~120분" : formatDurationRange(selectedServiceOption?.durationMinutes ?? selectedService?.duration_minutes ?? 90);

  if (step === 4) {
    const appointment = completedBooking?.appointment;
    const summaryDate = appointment?.appointment_date || firstVisit.date;
    const summaryTime = appointment?.appointment_time?.slice(0, 5) || firstVisit.timeSlot;

    return (
      <BookingShell>
        <BookingStepHeader title={getShopDisplayName(shop)} subtitle="최종 확인" step={4} onBack={onStepBack} />
        <section className="mt-3 rounded-[22px] border border-[#eadbc9] bg-white px-4 py-5 text-center shadow-[0_18px_38px_rgba(139,94,60,0.10)]">
          <div className="relative mx-auto h-28 w-36">
            {["left-2 top-4 bg-[#ef7c9b]", "right-3 top-6 bg-[#a78bfa]", "left-8 bottom-5 bg-[#f2b84b]", "right-8 bottom-4 bg-[#6dcfc3]"].map((className) => (
              <span key={className} className={cn("absolute h-2 w-1.5 rotate-45 rounded-sm", className)} />
            ))}
            <div className="absolute left-1/2 top-0 z-10 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-[#9A6B45] text-white shadow-[0_12px_22px_rgba(139,94,60,0.20)]">
              <Check className="h-8 w-8" strokeWidth={2.2} />
            </div>
            <div className="absolute bottom-0 left-1/2 h-16 w-24 -translate-x-1/2 overflow-hidden rounded-t-full">
              <img src="/images/default-pet-profile.png" alt="" className="h-24 w-24 object-cover object-top" />
            </div>
          </div>
          <h3 className="mt-2 text-[22px] font-semibold leading-8 tracking-[-0.04em] text-[#2b241f]">예약 요청이 접수되었습니다!</h3>
          <p className="mt-2 text-[14px] leading-6 tracking-[-0.02em] text-[#6f6258]">
            매장에서 확인 후 문자 또는 전화로 안내드릴게요.
          </p>

          <div className="mt-4 rounded-[16px] border border-[#eadbc9] bg-[#fffdf9] px-4 py-3">
            <SummaryLine label="예약 번호" value={buildReservationNumber(appointment)} />
            <SummaryLine label="예약 날짜" value={formatDateForSummary(summaryDate)} />
            <SummaryLine label="예약 시간" value={formatTimeForSummary(summaryTime)} />
            <SummaryLine label="서비스" value={serviceSummaryName} />
          </div>

          <div className="mt-4 grid gap-2">
            <button
              type="button"
              onClick={onGoManage}
              className="h-12 rounded-[10px] bg-[#8B5E3C] text-[16px] font-semibold text-white shadow-[0_14px_24px_rgba(139,94,60,0.20)]"
            >
              예약 내역 보기
            </button>
            <button
              type="button"
              onClick={onBackToEntry}
              className="h-12 rounded-[10px] border border-[#8B5E3C] bg-white text-[16px] font-semibold text-[#8B5E3C]"
            >
              메인으로
            </button>
          </div>
        </section>
      </BookingShell>
    );
  }

  return (
    <BookingShell>
      {step === 1 ? (
        <>
          <TopStepChip step={1} label="서비스 선택" />
          <section className="overflow-hidden rounded-[22px] border border-[#eadbc9] bg-white shadow-[0_18px_38px_rgba(139,94,60,0.10)]">
            <div className="h-[168px] bg-[#eadbc9]">
              <img src={getHeroImage(shop)} alt={`${getShopDisplayName(shop)} 대표 이미지`} className="h-full w-full object-cover" />
            </div>
            <div className="px-4 py-3">
              <h1 className="text-[21px] font-semibold tracking-[-0.04em] text-[#2b241f]">{getShopDisplayName(shop)}</h1>
              <p className="mt-1 text-[13px] leading-5 tracking-[-0.02em] text-[#6f6258]">{getShopTagline(shop)}</p>
              <button
                type="button"
                onClick={onOpenShopInfo}
                className="mt-3 flex w-full items-center justify-between rounded-[14px] border border-[#eadbc9] bg-[#fffdf9] px-3 py-2.5"
              >
                <span className="flex items-center gap-2 text-[13px] font-semibold text-[#2f7866]">
                  <span className="h-2 w-2 rounded-full bg-[#2f7866]" />
                  영업 중
                  <span className="font-medium text-[#2b241f]">{getTodayHours(shop)}</span>
                </span>
                <span className="flex items-center gap-1 text-[12px] font-semibold text-[#8B5E3C]">
                  전체 보기
                  <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </button>
            </div>
          </section>

          <section className="mt-4">
            <h2 className="text-[17px] font-semibold tracking-[-0.03em] text-[#2b241f]">어떤 서비스를 원하시나요?</h2>
            <div className="mt-2 grid gap-2">
              {customerServiceOptions.map((service) => {
                const meta = service.description ? { description: service.description } : getServiceMeta(service.name);
                return (
                  <ServiceOptionCard
                    key={service.id}
                    title={service.name}
                    description={meta.description}
                    duration={formatDurationRange(service.durationMinutes)}
                    price={formatServicePrice(service.price, service.priceType)}
                    active={firstVisit.customerServiceOptionId === service.id}
                    onClick={() => onServiceSelect(service.id)}
                  />
                );
              })}
              <ServiceOptionCard
                title="상담 후 결정"
                description="원하는 스타일 상담 후 결정"
                duration="90분~120분"
                price="가격 미정"
                active={firstVisit.serviceId === CUSTOM_SERVICE_ID}
                onClick={() => onServiceSelect(CUSTOM_SERVICE_ID)}
              />
            </div>
          </section>
          <FooterActions single primaryLabel="다음 단계로" primaryDisabled={!firstVisit.serviceId} onPrimary={onNext} />
        </>
      ) : null}

      {step === 2 ? (
        <>
          <BookingStepHeader title={getShopDisplayName(shop)} subtitle="추천 가능한 시간" step={2} onBack={onStepBack} />
          <section className="mt-3 rounded-[14px] border border-[#eadbc9] bg-white px-3.5 py-3 shadow-[0_10px_24px_rgba(139,94,60,0.06)]">
            <div className="flex min-w-0 items-center gap-2 text-[15px] tracking-[-0.02em]">
              <span className="truncate font-semibold text-[#2b241f]">{serviceSummaryName}</span>
              <span className="h-3.5 w-px shrink-0 bg-[#eadbc9]" aria-hidden="true" />
              <span className="shrink-0 font-medium text-[#8B5E3C]">예상 소요시간 {serviceSummaryDuration}</span>
            </div>
          </section>

          <div className="mt-3 flex gap-1.5 overflow-x-auto rounded-[16px] border border-[#eadbc9] bg-white p-2 shadow-[0_10px_24px_rgba(139,94,60,0.06)]">
            {visibleDates.map((date) => {
              const active = firstVisit.date === date.value;
              return (
                <button
                  key={date.value}
                  type="button"
                  onClick={() => onDateSelect(date.value)}
                  className={cn(
                    "min-w-[48px] rounded-[12px] px-2 py-2 text-center transition",
                    active ? "bg-[#8B5E3C] text-white" : "bg-white text-[#2b241f] hover:bg-[#fff7ef]",
                  )}
                >
                  <span className={cn("block text-[11px]", active ? "text-white/80" : "text-[#8b7767]")}>{date.weekday}</span>
                  <span className="mt-0.5 block text-[13px] font-semibold">{date.label}</span>
                </button>
              );
            })}
          </div>

          <section className="mt-4">
            <h2 className="text-[17px] font-semibold tracking-[-0.03em] text-[#2b241f]">추천 시간</h2>
            <div className="mt-2">
              {loadingSlots ? (
                <div className="rounded-[14px] border border-[#eadbc9] bg-white px-4 py-5 text-center text-[14px] text-[#8b7767]">가능한 시간을 확인하고 있어요.</div>
              ) : visibleSlots.length === 0 ? (
                <div className="rounded-[14px] border border-[#eadbc9] bg-white px-4 py-5 text-center text-[14px] text-[#8b7767]">선택한 날짜에 가능한 시간이 없어요.</div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {visibleSlots.map((slot, index) => {
                    const active = firstVisit.timeSlot === slot;
                    const recommended = index < 2;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => onTimeSelect(slot)}
                        className={cn(
                          "relative h-12 rounded-[10px] border text-[15px] font-semibold tracking-[-0.02em] transition",
                          active ? "border-[#8B5E3C] bg-[#8B5E3C] text-white" : "border-[#eadbc9] bg-white text-[#2b241f] hover:bg-[#fff7ef]",
                        )}
                      >
                        {slot}
                        {recommended ? (
                          <span className={cn("absolute -right-1 -top-1 rounded-full px-1.5 py-0.5 text-[10px]", active ? "bg-white text-[#8B5E3C]" : "bg-[#8B5E3C] text-white")}>
                            추천
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowAllTimes((current) => !current)}
              className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-[12px] border border-[#eadbc9] bg-white text-[14px] font-semibold text-[#8B5E3C]"
            >
              <CalendarDays className="h-4 w-4" />
              전체 시간 보기
              <ChevronRight className={cn("h-4 w-4 transition", showAllTimes ? "rotate-90" : "")} />
            </button>
            <div className="mt-3 rounded-[14px] border border-[#eadbc9] bg-[#fff8ef] px-3 py-3">
              <p className="flex gap-2 text-[13px] leading-5 text-[#6f6258]">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-[#8B5E3C]" />
                추천 시간은 매장 운영 상황에 따라 실시간으로 변경될 수 있어요. 예약 요청 후 매장에서 확인해드려요.
              </p>
            </div>
          </section>
          <FooterActions
            primaryLabel="다음"
            primaryDisabled={!firstVisit.date || !firstVisit.timeSlot}
            onPrimary={onNext}
            onSecondary={onStepBack}
          />
        </>
      ) : null}

      {step === 3 ? (
        <>
          <BookingStepHeader title={getShopDisplayName(shop)} subtitle="예약자 정보" step={3} onBack={onStepBack} />
          <section className="mt-4">
            <p className="text-[15px] leading-6 tracking-[-0.02em] text-[#5f4734]">
              예약 확인 및 안내를 위해 필요한 정보만 입력해주세요.
            </p>
            <div className="mt-3 grid gap-2">
              <CustomerInput icon={UserRound} label="보호자 이름" value={firstVisit.ownerName} placeholder="이름을 입력해주세요" onChange={onOwnerNameChange} />
              <CustomerInput icon={Phone} label="연락처" value={firstVisit.phone} placeholder="010-1234-5678" inputMode="tel" onChange={onPhoneChange} />
              <CustomerInput icon={PawPrint} label="반려동물 이름" value={firstVisit.petName} placeholder="반려동물 이름을 입력해주세요" onChange={onPetNameChange} />
            </div>

            <div className="mt-3 rounded-[16px] border border-[#eadbc9] bg-white px-3.5 py-3 shadow-[0_10px_24px_rgba(139,94,60,0.06)]">
              <div>
                <span className="block text-[15px] font-semibold text-[#2b241f]">선택사항</span>
                <span className="mt-0.5 block text-[12px] text-[#8b7767]">필요 시 요청사항을 남겨주세요.</span>
              </div>
              <textarea
                value={firstVisit.note}
                onChange={(event) => onNoteChange(event.target.value.slice(0, 200))}
                placeholder="예: 털이 많이 엉켜 있어요, 겁이 많아요, 얼굴은 짧게 해주세요."
                className="mt-3 min-h-[98px] w-full resize-none rounded-[12px] border border-[#eadbc9] bg-white px-3 py-2.5 text-[15px] leading-6 text-[#2b241f] outline-none placeholder:text-[#b8a79a] focus:border-[#8B5E3C]"
              />
              <p className="mt-1 text-right text-[11px] text-[#a8988a]">{firstVisit.note.length}/200</p>
            </div>
          </section>
          <FooterActions
            primaryLabel="다음"
            submitting={submitting}
            primaryDisabled={!firstVisit.ownerName.trim() || !firstVisit.phone.trim() || !firstVisit.petName.trim()}
            onPrimary={onSubmit}
            onSecondary={onStepBack}
          />
        </>
      ) : null}
    </BookingShell>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#f1e4d8] py-2.5 last:border-b-0">
      <span className="text-[13px] font-semibold text-[#8b7767]">{label}</span>
      <span className="text-right text-[14px] font-semibold text-[#2b241f]">{value}</span>
    </div>
  );
}
