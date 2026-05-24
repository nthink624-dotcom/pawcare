"use client";

import { ChevronLeft, CheckCircle2, Plus } from "lucide-react";
import { useEffect } from "react";
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

import { formatServicePrice } from "@/lib/utils";
import type { Service } from "@/types/domain";

type DateOption = {
  value: string;
  label: string;
  weekday: string;
};

type ChoiceOption = {
  value: string;
  label: string;
};

const CUSTOM_SERVICE_OPTION = "__custom__";

const groomingPriceGuideRows = [
  { group: "소형견", weight: "~5kg", bath: "15,000원 / 40분", full: "30,000원 / 70분", scissor: "65,000원 / 140분" },
  { group: "소형견", weight: "5~8kg", bath: "20,000원 / 45분", full: "35,000원 / 80분", scissor: "70,000원 / 150분" },
  { group: "소형견", weight: "8~10kg", bath: "25,000원 / 50분", full: "40,000원 / 90분", scissor: "75,000원 / 160분" },
  { group: "중형견", weight: "~5kg", bath: "20,000원 / 45분", full: "35,000원 / 80분", scissor: "70,000원 / 150분" },
  { group: "중형견", weight: "5~8kg", bath: "25,000원 / 50분", full: "40,000원 / 90분", scissor: "75,000원 / 160분" },
  { group: "중형견", weight: "8~10kg", bath: "30,000원 / 60분", full: "45,000원 / 100분", scissor: "80,000원 / 170분" },
  { group: "특수견/대형견", weight: "상담", bath: "30,000원~ / 60분~", full: "50,000원~ / 100분~", scissor: "85,000원~ / 170분~" },
  { group: "고양이", weight: "상담", bath: "20,000원~ / 40분~", full: "50,000원~ / 80분~", scissor: "별도 상담" },
];

export function StepHeader({
  title,
  step,
  total,
  progress,
  onBack,
}: {
  title: string;
  step: number;
  total: number;
  progress: number;
  onBack: () => void;
}) {
  return (
    <div className="mb-3.5">
      <div className="relative flex min-h-8 items-center justify-center">
        <button
          type="button"
          onClick={onBack}
          className="absolute left-0 inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[var(--text)] transition hover:bg-[var(--selection-soft)] hover:text-[var(--accent)]"
          aria-label="?댁쟾"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={1.9} />
        </button>
        {title ? <h2 className="text-center text-[17px] font-semibold tracking-[-0.03em] text-[var(--text)]">{title}</h2> : null}
        <span className="absolute right-0 text-[13px] font-medium tracking-[-0.02em] text-[var(--muted)]">
          {step}/{total}
        </span>
      </div>
      <div className="mt-3.5 h-1.5 rounded-full bg-[var(--accent-soft)]">
        <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

export function StepSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      {title ? <h3 className="text-[17px] font-semibold tracking-[-0.03em] text-[var(--text)]">{title}</h3> : null}
      {children}
    </div>
  );
}

export function FlowHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <section className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-[var(--border)] bg-white text-[var(--text)] shadow-[0_3px_8px_rgba(139,106,85,0.06)] transition hover:bg-[var(--selection-soft)]"
          aria-label="泥섏쓬 ?붾㈃?쇰줈"
        >
          <ChevronLeft className="h-4.5 w-4.5" strokeWidth={1.9} />
        </button>
        <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-[var(--text)]">{title}</h2>
      </div>
    </section>
  );
}

export function BookingBottomSheet({
  children,
}: {
  children: ReactNode;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousPosition = document.body.style.position;
    const previousTop = document.body.style.top;
    const previousWidth = document.body.style.width;
    const scrollY = window.scrollY;

    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.position = previousPosition;
      document.body.style.top = previousTop;
      document.body.style.width = previousWidth;
      window.scrollTo(0, scrollY);
    };
  }, []);

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-[430px] rounded-t-[18px] border border-b-0 border-[var(--border)] bg-[var(--background)] px-5 pt-3 shadow-[0_-10px_30px_rgba(139,106,85,0.10)]">
      <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[var(--accent-soft)]" />
      <div className="max-h-[calc(100vh-28px)] overflow-y-auto overscroll-contain pb-28">{children}</div>
    </div>
  );
}

export function BookingStageCard({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-4 py-4 shadow-[0_18px_36px_rgba(139,106,85,0.10)]">
      {children}
    </section>
  );
}

export function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-4 py-4 shadow-[var(--shadow-soft)]">
      <h2 className="text-[17px] font-semibold tracking-[-0.03em] text-[var(--text)]">{title}</h2>
      <div className="mt-3 space-y-2.5">{children}</div>
    </section>
  );
}

export function BookingFieldCard({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={`rounded-[10px] border border-[var(--border)] bg-white px-3.5 pb-1.5 pt-0.5 ${className}`}>
      <legend className="px-2 text-[15px] font-medium tracking-[-0.01em] text-[var(--muted)]">{label}</legend>
      <div className="flex min-h-[28px] items-center">{children}</div>
    </fieldset>
  );
}

export function BookingTextInput({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`relative -top-[2px] h-7 w-full border-0 bg-transparent px-0 pt-0 pb-[3px] text-[19px] font-medium leading-7 tracking-[-0.02em] text-[var(--text)] outline-none placeholder:font-normal placeholder:text-[#b1a79b] ${className}`}
    />
  );
}

export function BookingTextArea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full resize-none border-0 bg-transparent px-0 py-0.5 text-[15px] leading-6 tracking-[-0.02em] text-[var(--text)] outline-none placeholder:text-[#b1a79b] ${className}`}
    />
  );
}

export function AddPetButton({ onClick, disabled = false }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mt-1.5 flex h-[46px] w-full items-center justify-center gap-1.5 rounded-[8px] border border-[var(--border)] bg-white px-4 text-[15px] font-medium tracking-[-0.02em] text-[var(--accent)] shadow-[0_4px_12px_rgba(139,106,85,0.06)] transition hover:bg-[var(--selection-soft)] disabled:cursor-not-allowed disabled:border-[#e6e0d7] disabled:bg-[#f7f3ed] disabled:text-[#b0a79b] disabled:shadow-none disabled:opacity-100"
    >
      <Plus className="h-4 w-4" strokeWidth={2.1} />
      아기 추가하기
    </button>
  );
}

export function ChoiceGrid({
  options,
  value,
  onChange,
}: {
  options: ChoiceOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-[8px] border px-3 py-2.5 text-[14px] font-medium tracking-[-0.02em] transition ${
              active
                ? "border-[var(--accent)] bg-[var(--accent)] text-white shadow-[0_8px_16px_rgba(139,106,85,0.16)]"
                : "border-[var(--border)] bg-white text-[var(--text)] hover:bg-[var(--selection-soft)]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function DateGrid({
  dateOptions,
  selectedDate,
  onSelect,
}: {
  dateOptions: DateOption[];
  selectedDate: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {dateOptions.map((option) => {
        const active = selectedDate === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelect(option.value)}
            className={`rounded-[8px] border px-2 py-2.5 text-center transition ${
              active
                ? "border-[var(--accent)] bg-[var(--accent)] text-white shadow-[0_10px_20px_rgba(139,106,85,0.16)]"
                : "border-[var(--border)] bg-white text-[var(--text)] hover:bg-[var(--selection-soft)]"
            }`}
          >
            <span className={`block text-[12px] ${active ? "text-white/80" : "text-[var(--muted)]"}`}>{option.weekday}</span>
            <span className="mt-1 block text-[16px] font-semibold tracking-[-0.03em]">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function TimeGrid({
  timeSlot,
  availableSlots,
  loading,
  onSelect,
}: {
  timeSlot: string;
  availableSlots: string[];
  loading: boolean;
  onSelect: (value: string) => void;
}) {
  if (loading) {
    return <div className="rounded-[8px] border border-[var(--border)] bg-white px-4 py-4 text-[14px] text-[var(--muted)]">가능한 시간을 확인하고 있어요.</div>;
  }
  if (availableSlots.length === 0) {
    return <div className="rounded-[8px] border border-[var(--border)] bg-white px-4 py-4 text-[14px] text-[var(--muted)]">선택한 날짜에 가능한 시간이 없어요.</div>;
  }
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {availableSlots.map((slot) => {
        const active = timeSlot === slot;
        return (
          <button
            key={slot}
            type="button"
            onClick={() => onSelect(slot)}
            className={`rounded-[8px] border px-2 py-2.5 text-[15px] font-medium tracking-[-0.02em] transition ${
              active
                ? "border-[var(--accent)] bg-[var(--accent)] text-white shadow-[0_10px_20px_rgba(139,106,85,0.16)]"
                : "border-[var(--border)] bg-white text-[var(--text)] hover:bg-[var(--selection-soft)]"
            }`}
          >
            {slot}
          </button>
        );
      })}
    </div>
  );
}

export function ServiceCards({
  services,
  selectedServiceId,
  onSelect,
  allowCustom = false,
}: {
  services: Service[];
  selectedServiceId: string;
  onSelect: (value: string) => void;
  allowCustom?: boolean;
}) {
  return (
    <div className="space-y-2.5">
      {services.map((service) => {
        const active = selectedServiceId === service.id;
        return (
          <button
            key={service.id}
            type="button"
            onClick={() => onSelect(service.id)}
            className={`w-full rounded-[8px] border px-3.5 py-3 text-left transition ${
              active
                ? "border-[var(--accent)] bg-[var(--selection-soft)]"
                : "border-[var(--border)] bg-white hover:bg-[var(--selection-soft)]"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[16px] font-medium tracking-[-0.02em] text-[var(--text)]">{service.name}</p>
              </div>
              <span className={`shrink-0 text-[14px] font-medium ${active ? "text-[var(--accent)]" : "text-[#847b6e]"}`}>
                {formatServicePrice(service.price, service.price_type ?? "starting")}
              </span>
            </div>
          </button>
        );
      })}
      {allowCustom ? (
        <button
          type="button"
          onClick={() => onSelect(CUSTOM_SERVICE_OPTION)}
            className={`w-full rounded-[8px] border px-3.5 py-3 text-left transition ${
            selectedServiceId === CUSTOM_SERVICE_OPTION
              ? "border-[var(--accent)] bg-[var(--selection-soft)]"
              : "border-[var(--border)] bg-white hover:bg-[var(--selection-soft)]"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-[15px] font-medium tracking-[-0.02em] text-[var(--text)]">기타 요청 서비스</p>
            <span className="text-[13px] font-medium text-[var(--muted)]">직접 입력</span>
          </div>
        </button>
      ) : null}
    </div>
  );
}

export function CustomerGroomingPriceGuide() {
  return (
    <details className="mt-3 rounded-[10px] border border-[var(--border)] bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3">
        <span>
          <span className="block text-[15px] font-semibold tracking-[-0.02em] text-[var(--text)]">미용요금표 참고</span>
          <span className="mt-0.5 block text-[12px] font-medium text-[var(--muted)]">금액 / 예상시간을 미리 확인할 수 있어요.</span>
        </span>
        <span className="shrink-0 rounded-full border border-[var(--border)] bg-white px-2.5 py-1 text-[12px] font-semibold text-[var(--accent)]">
          보기
        </span>
      </summary>
      <div className="border-t border-[var(--border)] px-3.5 py-3">
        <div className="max-h-[238px] overflow-auto rounded-[8px] border border-[var(--border)]">
          <table className="min-w-[620px] w-full border-collapse bg-white text-[12px]">
            <thead>
              <tr className="bg-[#fbf7f2] text-[#6f6258]">
                <th className="border-b border-r border-[var(--border)] px-2 py-2 text-left font-semibold">구분</th>
                <th className="border-b border-r border-[var(--border)] px-2 py-2 text-left font-semibold">무게</th>
                <th className="border-b border-r border-[var(--border)] px-2 py-2 text-left font-semibold">목욕</th>
                <th className="border-b border-r border-[var(--border)] px-2 py-2 text-left font-semibold">전체미용</th>
                <th className="border-b border-[var(--border)] px-2 py-2 text-left font-semibold">전체가위컷</th>
              </tr>
            </thead>
            <tbody>
              {groomingPriceGuideRows.map((row, index) => (
                <tr key={`${row.group}-${row.weight}-${index}`} className="text-[#2b241f]">
                  <td className="border-b border-r border-[var(--border)] px-2 py-2 font-semibold">{row.group}</td>
                  <td className="border-b border-r border-[var(--border)] px-2 py-2 font-medium">{row.weight}</td>
                  <td className="border-b border-r border-[var(--border)] px-2 py-2">{row.bath}</td>
                  <td className="border-b border-r border-[var(--border)] px-2 py-2">{row.full}</td>
                  <td className="border-b border-[var(--border)] px-2 py-2">{row.scissor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2.5 text-[12px] leading-5 text-[var(--muted)]">
          실제 요금은 아이의 상태, 털엉킴, 기장, 성격, 피부 상태를 매장에서 확인한 뒤 최종 안내드려요.
        </p>
      </div>
    </details>
  );
}

export function ReservationSlotPicker({
  date,
  timeSlot,
  dateOptions,
  availableSlots,
  loading,
  onDateChange,
  onTimeChange,
}: {
  date: string;
  timeSlot: string;
  dateOptions: DateOption[];
  availableSlots: string[];
  loading: boolean;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2.5">
      <div className="space-y-2">
        <p className="text-[13px] font-medium text-[var(--muted)]">날짜 선택</p>
        <DateGrid dateOptions={dateOptions} selectedDate={date} onSelect={onDateChange} />
      </div>
      <div className="space-y-2">
        <p className="text-[13px] font-medium text-[var(--muted)]">시간 선택</p>
        <TimeGrid timeSlot={timeSlot} availableSlots={availableSlots} loading={loading} onSelect={onTimeChange} />
      </div>
    </div>
  );
}

export function ServiceSelect({
  services,
  value,
  onChange,
  allowCustom = false,
}: {
  services: Service[];
  value: string;
  onChange: (value: string) => void;
  allowCustom?: boolean;
}) {
  return (
    <BookingFieldCard label="서비스 선택">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-transparent px-0 py-0.5 text-[16px] font-medium tracking-[-0.02em] text-[var(--text)] outline-none"
      >
        {services.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
        {allowCustom ? <option value={CUSTOM_SERVICE_OPTION}>기타 요청 서비스</option> : null}
      </select>
    </BookingFieldCard>
  );
}

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-[8px] border border-[var(--border)] bg-white px-3.5 py-2.5">
      <span className="text-[13px] font-medium text-[var(--muted)]">{label}</span>
      <span className="text-right text-[15px] font-medium tracking-[-0.02em] text-[var(--text)]">{value}</span>
    </div>
  );
}

export function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <BookingFieldCard label={label}>
      <p className="relative -top-[2px] pb-[3px] text-[16px] font-medium leading-6 tracking-[-0.02em] text-[var(--text)]">{value}</p>
    </BookingFieldCard>
  );
}

export function BottomBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-[430px] -translate-x-1/2 border-t border-[#e7d8c9] bg-[rgba(255,250,245,0.96)] px-5 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-2.5 backdrop-blur">
      {children}
    </div>
  );
}

export function ActionButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void | Promise<void>;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => void onClick()}
      className={`w-full rounded-[8px] px-4 py-3.5 text-[17px] font-semibold tracking-[-0.02em] text-white transition ${
        disabled
          ? "cursor-not-allowed bg-[#b9ab9e] shadow-none"
          : "bg-[#9A6B45] shadow-[0_12px_22px_rgba(154,107,69,0.22)] hover:bg-[#83583a]"
      }`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="shrink-0 rounded-[8px] border border-[#e7d8c9] bg-white px-4.5 py-3.5 text-[15px] font-medium tracking-[-0.02em] text-[#2b241f] transition hover:bg-[rgba(139,106,85,0.10)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function FeedbackDialog({
  title,
  message,
  tone,
  onConfirm,
}: {
  title: string;
  message: string;
  tone: "success" | "error";
  onConfirm: () => void;
}) {
  const isSuccess = tone === "success";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-5" onClick={onConfirm}>
      <div
        className="w-full max-w-[360px] rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_22px_48px_rgba(139,106,85,0.16)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] font-medium ${
            isSuccess
              ? "border-[rgba(139,106,85,0.18)] bg-[var(--selection-soft)] text-[var(--accent)]"
              : "border-[#f1c9c6] bg-[#fff4f2] text-[#9f3a32]"
          }`}
        >
          <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.1} />
          {isSuccess ? "예약 안내" : "예약 확인 필요"}
        </div>
        <h3 className="mt-4 text-[22px] font-semibold leading-8 tracking-[-0.03em] text-[var(--text)]">{title}</h3>
        <p className="mt-3 text-[15px] leading-7 tracking-[-0.02em] text-[#6f6258]">{message}</p>
        <button
          type="button"
          onClick={onConfirm}
          className="mt-5 w-full rounded-[8px] bg-[var(--cta)] px-4 py-3.5 text-[16px] font-semibold tracking-[-0.02em] text-white"
        >
          확인
        </button>
      </div>
    </div>
  );
}

