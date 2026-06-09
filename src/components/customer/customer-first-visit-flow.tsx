"use client";

import {
  Bath,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  PawPrint,
  Phone,
  Scissors,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { CustomerServiceSourceOption } from "@/lib/customer-service-options";
import { getStaffChipTone } from "@/lib/staff-chip-colors";
import { getStaffCustomerName, getStaffCustomerTitle } from "@/lib/staff-display";
import { cn, formatServicePrice } from "@/lib/utils";
import type { Appointment, BootstrapStaffMember, Service, Shop } from "@/types/domain";

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
  staffId: string;
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

function formatDateChipLabel(date: DateOption) {
  if (date.label.includes("/")) return date.label.split("/").pop() || date.label;
  return date.label;
}

function formatDateChipTitle(date: DateOption, previousDate?: DateOption) {
  if (date.label === "오늘") return "오늘";
  if (previousDate?.label === "오늘") return "내일";
  return date.weekday;
}

function formatDateChipSubtitle(date: DateOption) {
  const parsed = new Date(`${date.value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return formatDateChipLabel(date);
  return `${parsed.getMonth() + 1}.${String(parsed.getDate()).padStart(2, "0")}`;
}

function timeSlotMinutes(slot: string) {
  const [hour, minute] = slot.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return Number.POSITIVE_INFINITY;
  return hour * 60 + minute;
}

function getOpenFallbackSlot(shop: Shop, date: string, availableSlots: string[]) {
  const parsed = new Date(`${date}T00:00:00`);
  const hours = Number.isNaN(parsed.getTime()) ? null : shop.business_hours?.[parsed.getDay()];
  const openMinutes = hours?.open ? timeSlotMinutes(hours.open.slice(0, 5)) : Number.POSITIVE_INFINITY;
  return availableSlots.find((slot) => timeSlotMinutes(slot) >= openMinutes) ?? availableSlots[0] ?? "";
}

function buildFallbackRecommendedSlots(shop: Shop, date: string, availableSlots: string[]) {
  const firstSlot = availableSlots[0] ?? "";
  const afterLunchSlot = availableSlots.find((slot) => timeSlotMinutes(slot) >= 14 * 60) ?? "";
  const openSlot = getOpenFallbackSlot(shop, date, availableSlots);
  const ordered = [firstSlot, afterLunchSlot, openSlot, ...availableSlots].filter(Boolean);
  return Array.from(new Set(ordered)).slice(0, 3);
}

function BookingShell({ children }: { children: ReactNode }) {
  return <div className="bg-white px-3 pb-[94px] pt-0 text-[#2b241f]">{children}</div>;
}

function TopStepChip({ step, label }: { step: number; label: string }) {
  return (
    <div className="mb-2 flex items-center justify-center gap-2 text-[16px] font-semibold tracking-[-0.02em] text-[#2b241f]">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#F5A623] text-[16px] text-white">{step}</span>
      {label}
    </div>
  );
}

function BookingStepHeader({ title, subtitle, step, onBack }: { title: string; subtitle: string; step: FirstVisitStep; onBack: () => void }) {
  return (
    <div className="rounded-[18px] border border-[#FFE1B0] bg-white px-4 py-3">
      <div className="relative flex min-h-10 items-center justify-center">
        <button
          type="button"
          onClick={onBack}
          className="absolute left-0 inline-flex h-8 w-8 items-center justify-center rounded-[10px] text-[#2b241f] transition hover:bg-[#FFF9EC]"
          aria-label="이전"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={1.9} />
        </button>
        <div className="min-w-0 px-10 text-center">
          <h2 className="truncate text-[18px] font-semibold tracking-[-0.03em]">{title}</h2>
          <p className="mt-0.5 text-[16px] font-medium text-[#8B6F4D]">{subtitle}</p>
        </div>
        <span className="absolute right-0 text-[16px] font-semibold text-[#8B6F4D]">{step}/4</span>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-[#FFE1B0]">
        <div className="h-full rounded-full bg-[#F5A623]" style={{ width: `${(step / 4) * 100}%` }} />
      </div>
    </div>
  );
}

function PlainStepHeader({ title, step, onBack }: { title: string; step: FirstVisitStep; onBack: () => void }) {
  return (
    <header className="sticky top-0 z-20 -mx-3 bg-white px-4 pb-2 pt-3">
      <div className="relative flex min-h-11 items-center justify-center">
        <button
          type="button"
          onClick={onBack}
          className="absolute left-0 inline-flex h-10 w-10 items-center justify-center rounded-[10px] text-[#2b241f] transition hover:bg-[#FFF9EC]"
          aria-label="이전"
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={1.9} />
        </button>
        <h2 className="text-[22px] font-normal tracking-[-0.03em] text-[#2b241f]">{title}</h2>
        <span className="absolute right-1 text-[16px] font-normal text-[#8B6F4D]">{step}/4</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-[#FFE1B0]">
        <div className="h-full rounded-full bg-[#F5A623]" style={{ width: `${(step / 4) * 100}%` }} />
      </div>
    </header>
  );
}

function StepBodyCard({ children }: { children: ReactNode }) {
  return <section>{children}</section>;
}

function StepSectionBlock({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("px-1", className)}>{children}</section>;
}

function ShopIntroBlock({ shop, onOpenShopInfo }: { shop: Shop; onOpenShopInfo: () => void }) {
  return (
    <section className="mt-2">
      <div className="h-[148px] overflow-hidden rounded-[16px] bg-[#FFE1B0]">
        <img src={getHeroImage(shop)} alt={`${getShopDisplayName(shop)} 매장 이미지`} className="h-full w-full object-cover" />
      </div>
      <div className="px-1 py-3">
        <h1 className="text-[21px] font-semibold tracking-[-0.04em] text-[#2b241f]">{getShopDisplayName(shop)}</h1>
        <p className="mt-1 text-[16px] leading-6 tracking-[-0.02em] text-[#8B6F4D]">{getShopTagline(shop)}</p>
        <button
          type="button"
          onClick={onOpenShopInfo}
          className="mt-3 flex w-full items-center justify-between rounded-[14px] border border-[#FFE1B0] bg-[#FFF9EC] px-3 py-2.5"
        >
          <span className="flex items-center gap-2 text-[16px] font-semibold text-[#2f7866]">
            <span className="h-2 w-2 rounded-full bg-[#2f7866]" />
            영업 정보
            <span className="font-medium text-[#2b241f]">{getTodayHours(shop)}</span>
          </span>
          <span className="flex items-center gap-1 text-[16px] font-semibold text-[#C46A00]">
            전체 보기
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </button>
      </div>
    </section>
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
  summaryTitle,
  summarySubtitle,
}: {
  primaryLabel: string;
  secondaryLabel?: string;
  primaryDisabled?: boolean;
  submitting?: boolean;
  onPrimary: () => void | Promise<void>;
  onSecondary?: () => void;
  single?: boolean;
  summaryTitle?: string;
  summarySubtitle?: string;
}) {
  const hasSummary = Boolean(summaryTitle || summarySubtitle);

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[430px] border-t border-[#FFE1B0] bg-white px-3 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3">
      <div className={cn("flex items-center gap-2", hasSummary ? "justify-between" : "")}>
        {hasSummary ? (
          <div className="min-w-0 w-[150px] shrink-0">
            {summaryTitle ? <p className="truncate text-[16px] font-normal tracking-[-0.03em] text-[#2b241f]">{summaryTitle}</p> : null}
            {summarySubtitle ? <p className="mt-0.5 truncate text-[16px] font-normal tracking-[-0.02em] text-[#C46A00]">{summarySubtitle}</p> : null}
          </div>
        ) : null}
        <div className={cn("grid gap-2", single ? "w-full grid-cols-1" : hasSummary ? "min-w-0 flex-1 grid-cols-2" : "w-full grid-cols-[0.78fr_1.22fr]")}>
          {!single && onSecondary ? (
            <button
              type="button"
              onClick={onSecondary}
              className="h-11 rounded-[10px] border border-[#FFE1B0] bg-white text-[16px] font-normal tracking-[-0.02em] text-[#2b241f]"
            >
              {secondaryLabel}
            </button>
          ) : null}
          <button
            type="button"
            disabled={primaryDisabled || submitting}
            onClick={() => void onPrimary()}
            className="h-11 rounded-[10px] bg-[#F5A623] text-[16px] font-normal tracking-[-0.02em] text-white transition hover:bg-[#E99718] disabled:cursor-not-allowed disabled:bg-[#F3D6A6]"
          >
            {submitting ? "예약 요청 중..." : primaryLabel}
          </button>
        </div>
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
        active ? "border-[#F5A623] bg-[#FFF6E6]" : "border-[#FFE1B0] bg-white hover:bg-[#FFF9EC]",
      )}
    >
      <div className="flex items-center gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#FFF6E6] text-[#D97706]">
          <Icon className="h-5 w-5" strokeWidth={1.9} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-semibold tracking-[-0.03em] text-[#2b241f]">{title}</span>
          <span className="mt-0.5 block truncate text-[16px] font-medium tracking-[-0.02em] text-[#8B6F4D]">{description}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-[16px] font-semibold text-[#C46A00]">{duration}</span>
          <span className="mt-0.5 block text-[16px] font-semibold text-[#C46A00]">{price}</span>
        </span>
      </div>
      {active ? (
        <span className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#F5A623] text-white">
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
    <label className="block rounded-[14px] border border-[#FFE1B0] bg-white px-3.5 py-3">
      <span className="mb-2 flex items-center gap-2 text-[16px] font-semibold text-[#2b241f]">
        <Icon className="h-4 w-4 text-[#D97706]" strokeWidth={1.9} />
        {label}
      </span>
      <input
        value={value}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-[10px] border border-[#FFE1B0] bg-white px-3 text-[16px] text-[#2b241f] outline-none placeholder:text-[#b8a79a] focus:border-[#F5A623]"
      />
    </label>
  );
}

function getStaffInitial(name: string) {
  return name.trim().slice(0, 1) || "직";
}

function StaffPicker({
  staffMembers,
  selectedStaffId,
  onStaffSelect,
}: {
  staffMembers: BootstrapStaffMember[];
  selectedStaffId: string;
  onStaffSelect: (staffId: string) => void;
}) {
  if (staffMembers.length === 0) return null;

  const selectedId = selectedStaffId;
  const options = [
    ...(staffMembers.length > 1 ? [{ id: "", name: "빠른 선택", initial: "?", profileImageUrl: "" }] : []),
    ...staffMembers.map((staff) => ({
      id: staff.id,
      name: getStaffCustomerName(staff),
      title: getStaffCustomerTitle(staff),
      initial: getStaffInitial(getStaffCustomerName(staff)),
      profileImageUrl: staff.profileImageUrl ?? "",
    })),
  ];

  return (
    <StepSectionBlock className="mt-3">
      <span className="block text-[18px] font-normal tracking-[-0.03em] text-[#2b241f]">디자이너</span>
      <div
        className={cn(
          "mt-3 flex gap-2.5 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          staffMembers.length === 1 ? "justify-center overflow-visible" : "overflow-x-auto",
        )}
      >
        {options.map((staff, staffIndex) => {
          const active = selectedId === staff.id;
          const staffTone = getStaffChipTone(staff.id, staff.id ? staffIndex : undefined);
          return (
            <button
              key={staff.id || "unknown-staff"}
              type="button"
              onClick={() => onStaffSelect(staff.id)}
              className={cn(
                "relative flex h-[126px] w-[112px] shrink-0 flex-col items-center justify-center rounded-[14px] border bg-white px-2.5 text-center text-[16px] font-normal tracking-[-0.02em] transition",
                "hover:brightness-[0.98]",
              )}
              style={{
                borderColor: staffTone.border,
                backgroundColor: active ? staffTone.selectedBackground : staffTone.background,
                color: active ? "#ffffff" : staffTone.text,
              }}
            >
              <span
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full border",
                )}
                style={{
                  borderColor: active ? "rgba(255,255,255,0.74)" : staffTone.border,
                  backgroundColor: active ? "rgba(255,255,255,0.18)" : "#ffffff",
                }}
              >
                {staff.profileImageUrl ? (
                  <img src={staff.profileImageUrl} alt={`${staff.name} 프로필`} className="h-full w-full rounded-full object-cover" />
                ) : staff.id ? (
                  <UserRound className="h-7 w-7 text-[#98a2b3]" strokeWidth={1.8} />
                ) : (
                  <span className="text-[20px] text-[#6b7280]">?</span>
                )}
              </span>
              <span className="mt-2 max-w-full overflow-hidden text-[16px] font-normal leading-[18px] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                {staff.name}
              </span>
              {"title" in staff && staff.title ? (
                <span className="mt-0.5 max-w-full truncate text-[14px] leading-[16px]" style={{ color: active ? "rgba(255,255,255,0.78)" : staffTone.mutedText }}>
                  {staff.title}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </StepSectionBlock>
  );
}

export default function CustomerFirstVisitFlow({
  shop,
  customerServiceOptions,
  dateOptions,
  staffMembers,
  firstVisit,
  step,
  selectedService,
  selectedServiceOption,
  availableSlots,
  recommendedSlots: recommendedSlotCandidates = [],
  loadingSlots,
  submitting,
  completedBooking,
  onBackToEntry,
  onStepBack,
  onNext,
  onSubmit,
  onOpenShopInfo,
  onServiceSelect,
  onStaffSelect,
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
  staffMembers: BootstrapStaffMember[];
  firstVisit: FirstVisitForm;
  step: FirstVisitStep;
  selectedService?: Service;
  selectedServiceOption?: CustomerServiceSourceOption;
  availableSlots: string[];
  recommendedSlots?: string[];
  loadingSlots: boolean;
  submitting: boolean;
  completedBooking: BookingCompletion | null;
  onBackToEntry: () => void;
  onStepBack: () => void;
  onNext: () => void;
  onSubmit: () => Promise<void>;
  onOpenShopInfo: () => void;
  onServiceSelect: (serviceOptionId: string) => void;
  onStaffSelect: (staffId: string) => void;
  onDateSelect: (date: string) => void;
  onTimeSelect: (time: string) => void;
  onOwnerNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onPetNameChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onGoManage: () => void;
}) {
  const dateScrollerRef = useRef<HTMLDivElement | null>(null);
  const [allTimesExpanded, setAllTimesExpanded] = useState(false);
  const recommendedSlots = useMemo(() => {
    const selectedSlot = firstVisit.timeSlot && availableSlots.includes(firstVisit.timeSlot) ? firstVisit.timeSlot : "";
    const availableSlotSet = new Set(availableSlots);
    const prioritySlots = recommendedSlotCandidates.filter((slot, index) => availableSlotSet.has(slot) && recommendedSlotCandidates.indexOf(slot) === index);
    const baseSlots = prioritySlots.length > 0 ? prioritySlots : buildFallbackRecommendedSlots(shop, firstVisit.date, availableSlots);
    if (!selectedSlot || !baseSlots.includes(selectedSlot)) return baseSlots.slice(0, 2);
    return [selectedSlot, ...baseSlots.filter((slot) => slot !== selectedSlot)].slice(0, 2);
  }, [availableSlots, firstVisit.date, firstVisit.timeSlot, recommendedSlotCandidates, shop]);
  const regularSlots = useMemo(() => {
    const recommendedSlotSet = new Set(recommendedSlots);
    return availableSlots.filter((slot) => !recommendedSlotSet.has(slot));
  }, [availableSlots, recommendedSlots]);
  const visibleRegularSlots = allTimesExpanded ? regularSlots : regularSlots.slice(0, 3);
  const selectedDateIndex = dateOptions.findIndex((date) => date.value === firstVisit.date);
  const currentDateIndex = selectedDateIndex >= 0 ? selectedDateIndex : 0;
  const moveSelectedDate = (offset: -1 | 1) => {
    if (!dateOptions.length) return;
    const nextIndex = Math.min(dateOptions.length - 1, Math.max(0, currentDateIndex + offset));
    const nextDate = dateOptions[nextIndex];
    if (nextDate) onDateSelect(nextDate.value);
  };
  const defaultDateValue = useMemo(
    () => dateOptions.find((date) => date.label === "오늘")?.value ?? dateOptions[0]?.value ?? "",
    [dateOptions],
  );
  const serviceSummaryName = firstVisit.serviceId === CUSTOM_SERVICE_ID ? "상담 후 결정" : selectedServiceOption?.name || selectedService?.name || "서비스 선택";
  const serviceSummaryDuration =
    firstVisit.serviceId === CUSTOM_SERVICE_ID ? "90분~120분" : formatDurationRange(selectedServiceOption?.durationMinutes ?? selectedService?.duration_minutes ?? 90);

  useEffect(() => {
    if (step !== 3 || firstVisit.date || !defaultDateValue) return;
    onDateSelect(defaultDateValue);
  }, [defaultDateValue, firstVisit.date, onDateSelect, step]);

  useEffect(() => {
    setAllTimesExpanded(false);
  }, [firstVisit.date, firstVisit.serviceId, firstVisit.staffId]);

  useEffect(() => {
    if (!firstVisit.date) return;
    const scroller = dateScrollerRef.current;
    if (!scroller) return;
    const selectedButton = Array.from(scroller.querySelectorAll<HTMLButtonElement>("button[data-date-value]")).find(
      (button) => button.dataset.dateValue === firstVisit.date,
    );
    selectedButton?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [firstVisit.date]);

  if (step === 4) {
    const appointment = completedBooking?.appointment;
    const summaryDate = appointment?.appointment_date || firstVisit.date;
    const summaryTime = appointment?.appointment_time?.slice(0, 5) || firstVisit.timeSlot;

    return (
      <BookingShell>
        <PlainStepHeader title="최종 확인" step={4} onBack={onStepBack} />
        <section className="mt-1 px-1 py-4 text-center">
          <div className="relative mx-auto h-28 w-36">
            {["left-2 top-4 bg-[#F5A623]", "right-3 top-6 bg-[#FFD28A]", "left-8 bottom-5 bg-[#D97706]", "right-8 bottom-4 bg-[#FFE1B0]"].map((className) => (
              <span key={className} className={cn("absolute h-2 w-1.5 rotate-45 rounded-sm", className)} />
            ))}
            <div className="absolute left-1/2 top-0 z-10 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-[#F5A623] text-white">
              <Check className="h-8 w-8" strokeWidth={2.2} />
            </div>
            <div className="absolute bottom-0 left-1/2 h-16 w-24 -translate-x-1/2 overflow-hidden rounded-t-full">
              <img src="/images/default-pet-profile.png" alt="" className="h-24 w-24 object-cover object-top" />
            </div>
          </div>
          <h3 className="mt-2 text-[22px] font-semibold leading-8 tracking-[-0.04em] text-[#2b241f]">예약 요청이 접수되었습니다!</h3>
          <p className="mt-2 text-[16px] leading-6 tracking-[-0.02em] text-[#8B6F4D]">
            매장에서 확인 후 문자 또는 전화로 안내드릴게요.
          </p>

          <div className="mt-5 border-y border-[#FFE1B0] py-1">
            <SummaryLine label="예약 번호" value={buildReservationNumber(appointment)} />
            <SummaryLine label="예약 날짜" value={formatDateForSummary(summaryDate)} />
            <SummaryLine label="예약 시간" value={formatTimeForSummary(summaryTime)} />
            <SummaryLine label="서비스" value={serviceSummaryName} />
          </div>

          <div className="mt-4 grid gap-2">
            <button
              type="button"
              onClick={onGoManage}
              className="h-12 rounded-[10px] bg-[#F5A623] text-[16px] font-semibold text-white"
            >
              예약 내역 보기
            </button>
            <button
              type="button"
              onClick={onBackToEntry}
              className="h-12 rounded-[10px] border border-[#F5A623] bg-white text-[16px] font-semibold text-[#C46A00]"
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
      {step === 2 ? (
        <>
          <TopStepChip step={2} label="원하는 서비스 선택" />
          <section className="mt-3">
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
          <FooterActions
            primaryLabel="다음"
            primaryDisabled={!firstVisit.serviceId}
            onPrimary={onNext}
            onSecondary={onStepBack}
          />
        </>
      ) : null}

      {step === 3 ? (
        <>
          <StepBodyCard>
            <PlainStepHeader title="디자이너/날짜 선택" step={3} onBack={onStepBack} />
            <StaffPicker staffMembers={staffMembers} selectedStaffId={firstVisit.staffId} onStaffSelect={onStaffSelect} />

            <StepSectionBlock className="mt-4">
              <span className="block text-[18px] font-normal tracking-[-0.03em] text-[#2b241f]">날짜 선택</span>
              <div className="mt-2 grid grid-cols-[24px_minmax(0,1fr)_24px] items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveSelectedDate(-1)}
                  disabled={currentDateIndex <= 0}
                  className="flex h-8 w-6 items-center justify-center rounded-full text-[#111111] transition hover:bg-[#f3f4f6] disabled:text-[#cbd5e1]"
                  aria-label="이전 날짜"
                >
                  <ChevronLeft className="h-4 w-4" strokeWidth={2.4} />
                </button>
                <div
                  ref={dateScrollerRef}
                  className="flex min-w-0 flex-1 touch-pan-x snap-x gap-2 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {dateOptions.map((date, index) => {
                    const active = firstVisit.date === date.value;
                    return (
                      <button
                        key={date.value}
                        type="button"
                        data-date-value={date.value}
                        onClick={() => onDateSelect(date.value)}
                        aria-pressed={active}
                        className={cn(
                          "flex h-[74px] w-[58px] shrink-0 snap-start flex-col items-center justify-center rounded-[11px] border px-1 text-center font-medium transition",
                          active
                            ? "border-[#F5A623] bg-[#FFF6E6] text-[#C46A00]"
                            : "border-[#e5e7eb] bg-white text-[#111111] hover:border-[#cfd6df]",
                        )}
                      >
                        <span className={cn("text-[14px] font-medium leading-[16px]", active ? "text-[#C46A00]" : "text-[#111111]")}>
                          {formatDateChipTitle(date, dateOptions[index - 1])}
                        </span>
                        <span className="mt-1 text-[18px] font-medium leading-[20px]">{formatDateChipSubtitle(date)}</span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => moveSelectedDate(1)}
                  disabled={currentDateIndex >= dateOptions.length - 1}
                  className="flex h-8 w-6 items-center justify-center rounded-full text-[#111111] transition hover:bg-[#f3f4f6] disabled:text-[#cbd5e1]"
                  aria-label="다음 날짜"
                >
                  <ChevronRight className="h-4 w-4" strokeWidth={2.4} />
                </button>
              </div>
            </StepSectionBlock>

            <StepSectionBlock className="mt-4">
              <div>
                {loadingSlots ? (
                  <div className="rounded-[12px] border border-[#FFE1B0] bg-[#FFF9EC] px-4 py-7 text-center text-[16px] leading-6 text-[#8B6F4D]">가능한 시간을 확인하고 있어요.</div>
                ) : availableSlots.length === 0 ? (
                  <div className="rounded-[12px] border border-[#FFE1B0] bg-[#FFF9EC] px-4 py-7 text-center text-[16px] leading-6 text-[#8B6F4D]">선택한 날짜에 가능한 시간이 없어요.</div>
                ) : (
                  <div>
                    <div className="text-[18px] font-normal tracking-[-0.02em] text-[#2b241f]">
                      추천시간
                    </div>
                    {recommendedSlots.length === 0 ? (
                      <div className="mt-2 rounded-[10px] border border-[#FFE1B0] bg-[#FFF9EC] px-3 py-3 text-[16px] leading-6 text-[#8B6F4D]">바로 이어지는 추천 시간이 없어요.</div>
                    ) : (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {recommendedSlots.map((slot) => {
                          const active = firstVisit.timeSlot === slot;
                          return (
                            <button
                              key={`recommended-${slot}`}
                              type="button"
                              onClick={() => onTimeSelect(slot)}
                              className={cn(
                                "flex h-11 items-center justify-center gap-1 rounded-[8px] border px-2 text-[16px] font-normal tracking-[-0.02em] transition",
                                active
                                  ? "border-[#F5A623] bg-[#FFF6E6] text-[#C46A00]"
                                  : "border-[#e5e7eb] bg-white text-[#111111] hover:border-[#cfd6df]",
                              )}
                            >
                              <span>{slot}</span>
                              <span className={cn("text-[16px]", active ? "text-[#C46A00]" : "text-[#D97706]")}>추천</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div className="text-[18px] font-normal tracking-[-0.02em] text-[#2b241f]">전체시간</div>
                      {regularSlots.length > 3 ? (
                        <button
                          type="button"
                          onClick={() => setAllTimesExpanded((current) => !current)}
                          className="h-8 rounded-[8px] px-2 text-[16px] font-normal tracking-[-0.02em] text-[#C46A00]"
                        >
                          {allTimesExpanded ? "접기" : "전체 보기"}
                        </button>
                      ) : null}
                    </div>
                    {regularSlots.length === 0 ? (
                      <div className="mt-2 rounded-[10px] border border-[#FFE1B0] bg-[#FFF9EC] px-3 py-3 text-[16px] leading-6 text-[#8B6F4D]">추천 시간 외 선택 가능한 시간이 없어요.</div>
                    ) : (
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {visibleRegularSlots.map((slot) => {
                          const active = firstVisit.timeSlot === slot;
                          return (
                            <button
                              key={`all-${slot}`}
                              type="button"
                              onClick={() => onTimeSelect(slot)}
                              className={cn(
                                "flex h-11 items-center justify-center rounded-[8px] border px-2 text-[16px] font-normal tracking-[-0.02em] transition",
                                active
                                  ? "border-[#F5A623] bg-[#FFF6E6] text-[#C46A00]"
                                  : "border-[#e5e7eb] bg-white text-[#111111] hover:border-[#cfd6df]",
                              )}
                            >
                              {slot}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </StepSectionBlock>
          </StepBodyCard>
          <FooterActions
            primaryLabel="예약 요청"
            primaryDisabled={!firstVisit.date || !firstVisit.timeSlot}
            submitting={submitting}
            onPrimary={onSubmit}
            onSecondary={onStepBack}
            summaryTitle={serviceSummaryName}
            summarySubtitle={`예상 ${serviceSummaryDuration}`}
          />
        </>
      ) : null}

      {step === 1 ? (
        <>
          <StepBodyCard>
            <PlainStepHeader title="예약자 정보" step={1} onBack={onStepBack} />
            <ShopIntroBlock shop={shop} onOpenShopInfo={onOpenShopInfo} />
            <p className="text-[16px] leading-6 tracking-[-0.02em] text-[#8B6F4D]">
              예약 확인 및 안내를 위해 필요한 정보만 입력해주세요.
            </p>

            <div className="mt-4 divide-y divide-[#FFE1B0] border-y border-[#FFE1B0]">
              <label className="block py-4">
                <span className="flex items-center gap-2 text-[16px] font-semibold text-[#2b241f]">
                  <UserRound className="h-5 w-5 text-[#D97706]" strokeWidth={1.9} />
                  보호자 이름
                </span>
                <input
                  value={firstVisit.ownerName}
                  onChange={(event) => onOwnerNameChange(event.target.value)}
                  placeholder="이름을 입력해주세요"
                  className="mt-3 h-12 w-full rounded-[12px] border border-[#FFE1B0] bg-white px-3 text-[16px] text-[#2b241f] outline-none placeholder:text-[#b8a79a] focus:border-[#F5A623]"
                />
              </label>

              <label className="block py-4">
                <span className="flex items-center gap-2 text-[16px] font-semibold text-[#2b241f]">
                  <Phone className="h-5 w-5 text-[#D97706]" strokeWidth={1.9} />
                  연락처
                </span>
                <input
                  value={firstVisit.phone}
                  inputMode="tel"
                  onChange={(event) => onPhoneChange(event.target.value)}
                  placeholder="010-1234-5678"
                  className="mt-3 h-12 w-full rounded-[12px] border border-[#FFE1B0] bg-white px-3 text-[16px] text-[#2b241f] outline-none placeholder:text-[#b8a79a] focus:border-[#F5A623]"
                />
              </label>

              <label className="block py-4">
                <span className="flex items-center gap-2 text-[16px] font-semibold text-[#2b241f]">
                  <PawPrint className="h-5 w-5 text-[#D97706]" strokeWidth={1.9} />
                  반려동물 이름
                </span>
                <input
                  value={firstVisit.petName}
                  onChange={(event) => onPetNameChange(event.target.value)}
                  placeholder="반려동물 이름을 입력해주세요"
                  className="mt-3 h-12 w-full rounded-[12px] border border-[#FFE1B0] bg-white px-3 text-[16px] text-[#2b241f] outline-none placeholder:text-[#b8a79a] focus:border-[#F5A623]"
                />
              </label>
            </div>

            <div className="pt-4">
              <span className="block text-[16px] font-semibold text-[#2b241f]">선택사항</span>
              <span className="mt-1 block text-[16px] text-[#8B6F4D]">필요 시 요청사항을 남겨주세요.</span>
              <textarea
                value={firstVisit.note}
                onChange={(event) => onNoteChange(event.target.value.slice(0, 200))}
                placeholder="예: 털이 많이 엉켜 있어요, 겁이 많아요, 얼굴은 짧게 해주세요."
                className="mt-3 min-h-[112px] w-full resize-none rounded-[12px] border border-[#FFE1B0] bg-white px-3 py-3 text-[16px] leading-6 text-[#2b241f] outline-none placeholder:text-[#b8a79a] focus:border-[#F5A623]"
              />
              <p className="mt-1 text-right text-[16px] text-[#a8988a]">{firstVisit.note.length}/200</p>
            </div>
          </StepBodyCard>
          <FooterActions
            primaryLabel="다음"
            primaryDisabled={!firstVisit.ownerName.trim() || !firstVisit.phone.trim() || !firstVisit.petName.trim()}
            onPrimary={onNext}
            single
          />
        </>
      ) : null}
    </BookingShell>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#FFE1B0] py-2.5 last:border-b-0">
      <span className="text-[16px] font-semibold text-[#8B6F4D]">{label}</span>
      <span className="text-right text-[16px] font-semibold text-[#2b241f]">{value}</span>
    </div>
  );
}
