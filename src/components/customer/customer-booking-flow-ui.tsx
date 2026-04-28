"use client";

import { ChevronLeft, CheckCircle2, Plus } from "lucide-react";
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
          className="absolute left-0 inline-flex h-8 w-8 items-center justify-center text-[var(--text)] transition hover:text-[var(--accent)]"
          aria-label="이전"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={1.9} />
        </button>
        {title ? <h2 className="text-center text-[17px] font-semibold tracking-[-0.03em] text-[var(--text)]">{title}</h2> : null}
        <span className="absolute right-0 text-[13px] font-medium tracking-[-0.02em] text-[#7f756b]">
          {step}/{total}
        </span>
      </div>
      <div className="mt-3.5 h-1.5 rounded-full bg-[#ece7df]">
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
    <section className="rounded-[18px] border border-[#e6dfd5] bg-white px-3.5 py-3.5 shadow-[0_10px_22px_rgba(25,28,24,0.05)]">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] border border-[#e4ddd3] bg-white text-[var(--text)] shadow-[0_3px_8px_rgba(30,34,29,0.04)] transition hover:bg-[#fbfaf7]"
          aria-label="처음 화면으로"
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
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-[430px] rounded-t-[28px] border border-b-0 border-[#e6dfd5] bg-[var(--background)] px-4 pt-3 shadow-[0_-10px_30px_rgba(25,28,24,0.08)]">
      <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[#d8d0c5]" />
      <div className="max-h-[calc(100vh-28px)] overflow-y-auto pb-28">{children}</div>
    </div>
  );
}

export function BookingStageCard({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-[18px] border border-[#e6dfd5] bg-white px-3.5 py-3.5 shadow-[0_10px_22px_rgba(25,28,24,0.05)]">
      {children}
    </section>
  );
}

export function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[18px] border border-[#e6dfd5] bg-white px-3.5 py-3.5 shadow-[0_10px_22px_rgba(25,28,24,0.05)]">
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
    <fieldset className={`rounded-[12px] border border-[#ddd5ca] bg-white px-3.5 pb-1.5 pt-0.5 ${className}`}>
      <legend className="px-2 text-[15px] font-medium tracking-[-0.01em] text-[#8a8074]">{label}</legend>
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
      className="mt-1.5 flex h-[46px] w-full items-center justify-center gap-1.5 rounded-[12px] border border-[#cfded8] bg-white px-4 text-[15px] font-medium tracking-[-0.02em] text-[var(--accent)] shadow-[0_4px_12px_rgba(31,107,91,0.05)] transition hover:bg-[#fcfaf7] disabled:cursor-not-allowed disabled:border-[#e6e0d7] disabled:bg-[#f7f3ed] disabled:text-[#b0a79b] disabled:shadow-none disabled:opacity-100"
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
            className={`rounded-[12px] border px-3 py-2.5 text-[14px] font-medium tracking-[-0.02em] transition ${
              active
                ? "border-[var(--accent)] bg-[var(--accent)] text-white shadow-[0_8px_16px_rgba(31,107,91,0.14)]"
                : "border-[#ddd5ca] bg-[#fcfaf6] text-[var(--text)]"
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
            className={`rounded-[12px] border px-2 py-2.5 text-center transition ${
              active
                ? "border-[var(--accent)] bg-[var(--accent)] text-white shadow-[0_10px_20px_rgba(31,107,91,0.14)]"
                : "border-[#dfd8cd] bg-[#fdfbf7] text-[var(--text)] hover:bg-[#faf7f0]"
            }`}
          >
            <span className={`block text-[12px] ${active ? "text-white/80" : "text-[#91887b]"}`}>{option.weekday}</span>
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
    return <div className="rounded-[18px] border border-[#ebe4db] bg-[#fcfaf6] px-4 py-4 text-[14px] text-[#8f8578]">가능한 시간을 확인하고 있어요.</div>;
  }
  if (availableSlots.length === 0) {
    return <div className="rounded-[18px] border border-[#ebe4db] bg-[#fcfaf6] px-4 py-4 text-[14px] text-[#8f8578]">선택한 날짜에 가능한 시간이 없어요.</div>;
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
            className={`rounded-[12px] border px-2 py-2.5 text-[15px] font-medium tracking-[-0.02em] transition ${
              active
                ? "border-[var(--accent)] bg-[var(--accent)] text-white shadow-[0_10px_20px_rgba(31,107,91,0.14)]"
                : "border-[#dfd8cd] bg-[#fdfbf7] text-[var(--text)] hover:bg-[#faf7f0]"
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
            className={`w-full rounded-[12px] border px-3.5 py-3 text-left transition ${
              active
                ? "border-[var(--accent)] bg-[#f4faf7]"
                : "border-[#ddd5ca] bg-white hover:bg-[#fcfaf7]"
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
            className={`w-full rounded-[12px] border px-3.5 py-3 text-left transition ${
            selectedServiceId === CUSTOM_SERVICE_OPTION
              ? "border-[var(--accent)] bg-[#f4faf7]"
              : "border-[#ddd5ca] bg-white hover:bg-[#fcfaf7]"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-[15px] font-medium tracking-[-0.02em] text-[var(--text)]">기타 요청 서비스</p>
            <span className="text-[13px] font-medium text-[#847b6e]">직접 입력</span>
          </div>
        </button>
      ) : null}
    </div>
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
        <p className="text-[13px] font-medium text-[#8a8074]">날짜 선택</p>
        <DateGrid dateOptions={dateOptions} selectedDate={date} onSelect={onDateChange} />
      </div>
      <div className="space-y-2">
        <p className="text-[13px] font-medium text-[#8a8074]">시간 선택</p>
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
    <div className="flex items-start justify-between gap-4 rounded-[12px] border border-[#e4ddd3] bg-[#fcfaf6] px-3.5 py-2.5">
      <span className="text-[13px] font-medium text-[#8a8074]">{label}</span>
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
    <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-[430px] -translate-x-1/2 border-t border-[#e8e1d7] bg-[rgba(248,246,242,0.96)] px-4 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-2.5 backdrop-blur">
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
      className="w-full rounded-[12px] bg-[var(--accent)] px-4 py-3.5 text-[17px] font-semibold tracking-[-0.02em] text-white shadow-[0_12px_22px_rgba(31,107,91,0.16)] transition disabled:cursor-not-allowed disabled:opacity-45"
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
      className="shrink-0 rounded-[12px] border border-[#ddd5ca] bg-white px-4.5 py-3.5 text-[15px] font-medium tracking-[-0.02em] text-[var(--text)] transition disabled:cursor-not-allowed disabled:opacity-40"
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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-5" onClick={onConfirm}>
      <div
        className="w-full max-w-[360px] rounded-[18px] bg-white p-5 shadow-[0_22px_48px_rgba(17,24,39,0.16)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-medium ${tone === "success" ? "bg-[#eef8f1] text-[#25613a]" : "bg-[#fff1f1] text-[#b42318]"}`}>
          <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.1} />
          {tone === "success" ? "예약 접수 완료" : "예약 접수 실패"}
        </div>
        <h3 className="mt-4 text-[22px] font-semibold leading-8 tracking-[-0.03em] text-[var(--text)]">{title}</h3>
        <p className="mt-3 text-[14px] leading-6 text-[var(--muted)]">{message}</p>
        <button
          type="button"
          onClick={onConfirm}
          className="mt-5 w-full rounded-[12px] bg-[var(--accent)] px-4 py-3.5 text-[16px] font-semibold tracking-[-0.02em] text-white"
        >
          확인
        </button>
      </div>
    </div>
  );
}
