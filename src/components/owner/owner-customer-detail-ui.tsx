"use client";

import type React from "react";
import { ChevronRight } from "lucide-react";

import { EmptyState as AppEmptyState } from "@/components/ui/empty-state";
import { Switch } from "@/components/ui/switch";
import { phoneNormalize } from "@/lib/utils";
import type { BootstrapPayload, Pet } from "@/types/domain";

function buildTelHref(phone: string) {
  return `tel:${phoneNormalize(phone)}`;
}

function buildSmsHref(phone: string) {
  return `sms:${phoneNormalize(phone)}`;
}

export function PetDetailInputField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[14px] font-medium tracking-[-0.01em] text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}

export function QuickContactRow({
  phone,
  sending = false,
  reminderSent = false,
  onSendReminder,
}: {
  phone: string;
  sending?: boolean;
  reminderSent?: boolean;
  onSendReminder?: () => Promise<void>;
}) {
  return (
    <div className="mt-2.5 grid grid-cols-2 gap-2">
      <a
        href={buildTelHref(phone)}
        className="flex items-center justify-center rounded-[12px] border border-[#e8e0d2] bg-[#fcfaf7] px-4 py-3 text-[14px] font-medium text-[var(--text)]"
      >
        전화하기
      </a>
      <a
        href={buildSmsHref(phone)}
        className="flex items-center justify-center rounded-[12px] border border-[#e8e0d2] bg-[#fcfaf7] px-4 py-3 text-[14px] font-medium text-[var(--text)]"
      >
        문자 보내기
      </a>
      {onSendReminder ? (
        <button
          type="button"
          onClick={() => void onSendReminder()}
          disabled={sending || reminderSent}
          className="col-span-2 flex items-center justify-center rounded-[12px] border border-[#dfe8e2] bg-[#fcfaf7] px-4 py-3 text-[14px] font-medium text-[#2f7266] disabled:opacity-60"
        >
          {reminderSent ? "예약 10분 전 알림톡 발송됨" : "예약 10분 전 알림톡 발송"}
        </button>
      ) : null}
    </div>
  );
}

export function CustomerDetailFieldCard({
  label,
  children,
  onClick,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const sharedClassName = `isolate min-w-0 overflow-visible rounded-[12px] border border-[var(--border)] bg-white px-2.5 pb-0.5 pt-0 text-left ${onClick ? "transition hover:border-[#d9d2c9] hover:bg-[#fffdfa]" : ""} ${className}`.trim();
  const labelNode = (
    <legend className="ml-0.5 px-1.5 text-[14px] font-normal tracking-[-0.01em] text-[#9d978e]">
      {label}
    </legend>
  );

  if (onClick) {
    return (
      <fieldset className={sharedClassName}>
        {labelNode}
        <button type="button" className="block w-full text-left" onClick={onClick}>
          {children}
        </button>
      </fieldset>
    );
  }

  return (
    <fieldset className={sharedClassName}>
      {labelNode}
      {children}
    </fieldset>
  );
}

export function CustomerDetailInfoRow({
  label,
  value,
  onClick,
  muted = false,
  multiline = false,
}: {
  label: string;
  value: string;
  onClick?: () => void;
  muted?: boolean;
  multiline?: boolean;
}) {
  const rowClassName = `relative -top-[2px] z-[1] flex w-full justify-between gap-3 px-3 ${multiline ? "items-start py-1.5" : "min-h-[52px] items-center py-1.5"} text-left ${onClick ? "transition hover:bg-[#fffdfa]" : ""}`.trim();
  const valueClassName = multiline
    ? `text-[15px] leading-5 tracking-[-0.02em] ${muted ? "font-normal text-[var(--muted)]" : "font-normal text-[var(--text)]"}`
    : `text-[16px] leading-6 tracking-[-0.02em] ${muted ? "font-normal text-[var(--muted)]" : "font-normal text-[var(--text)]"}`;
  const body = (
    <>
      <div className={`relative min-w-0 flex-1 ${multiline ? "-top-[1px]" : "-top-[1px]"}`}>
        <p className={valueClassName}>{value}</p>
        <p className={`${multiline ? "mt-0.5" : "mt-0.5"} text-[12px] leading-4 text-[#a39d94]`}>{label}</p>
      </div>
      {onClick ? (
        <span className="flex h-5 items-center justify-center self-center">
          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--muted)]" strokeWidth={1.8} />
        </span>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={rowClassName} onClick={onClick}>
        {body}
      </button>
    );
  }

  return <div className={rowClassName}>{body}</div>;
}

export function CustomerDetailToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={`flex min-h-[52px] items-center justify-between gap-3 px-3 py-1.5 ${disabled ? "opacity-50" : ""}`}>
      <div className="relative -top-0.5 min-w-0 flex-1">
        <p className="text-[16px] font-normal tracking-[-0.02em] text-[var(--text)]">{label}</p>
        <p className="mt-0.5 text-[12px] leading-4 text-[#a39d94]">{description}</p>
      </div>
      <Switch checked={checked} disabled={disabled} size="md" aria-label={label} onCheckedChange={onChange} />
    </label>
  );
}

export function CustomerDetailNotificationItemRow({
  label,
  description,
  active,
  disabled = false,
  onChange,
}: {
  label: string;
  description: string;
  active: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange?.(!active)}
      className={`flex min-h-[74px] w-full items-center justify-between gap-3 rounded-[14px] border px-4 py-3.5 text-left transition ${
        active ? "border-[#d8e7e0] bg-[#fbfdfc]" : "border-[#e9e2d8] bg-white"
      } ${disabled ? "cursor-not-allowed opacity-55" : "hover:border-[#d8d1c8] hover:bg-[#fffdfa]"}`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium tracking-[-0.02em] text-[var(--text)]">{label}</p>
        <p className="mt-1 text-[13px] leading-[18px] tracking-[-0.01em] text-[#938c83]">{description}</p>
      </div>
      <Switch
        checked={active}
        disabled={disabled}
        size="md"
        aria-label={label}
        onClick={(event) => event.stopPropagation()}
        onCheckedChange={(checked) => onChange?.(checked)}
      />
    </button>
  );
}

export function CustomerMetricCard({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={`rounded-[16px] border border-[var(--border)] bg-white px-3.5 ${compact ? "py-3" : "py-3.5"}`}>
      <p className="text-[12px] font-medium leading-4 text-[var(--muted)]">{label}</p>
      <p className={`mt-1 font-semibold tracking-[-0.02em] text-[var(--text)] ${compact ? "line-clamp-2 text-[14px] leading-5" : "text-[15px] leading-5"}`}>{value}</p>
    </div>
  );
}

export function CustomerEmptyState({ title, description, action = null }: { title: string; description: string; action?: React.ReactNode }) {
  return <AppEmptyState title={title} description={description} action={action} className="rounded-[18px] bg-[#fcfaf7] px-4 py-5" />;
}

export function CustomerDetailHistoryPagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (nextPage: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-1 pt-0.5">
      {Array.from({ length: totalPages }, (_, index) => {
        const nextPage = index + 1;
        const active = nextPage === page;
        return (
          <button
            key={nextPage}
            type="button"
            onClick={() => onChange(nextPage)}
            className={`inline-flex h-[24px] min-w-[40px] items-center justify-center rounded-[999px] border px-2 text-[11px] font-medium leading-none transition ${
              active ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--border)] bg-white text-[var(--muted)]"
            }`}
          >
            {nextPage}
          </button>
        );
      })}
    </div>
  );
}

function getShopInitials(name: string) {
  const compact = name.replace(/\s+/g, "");
  return compact.slice(0, 2) || "펫";
}

export function ShopAvatar({ name, imageUrl }: { name: string; imageUrl?: string | null }) {
  if (imageUrl) {
    return <img src={imageUrl} alt={`${name} 대표 이미지`} className="h-9 w-9 shrink-0 rounded-full border border-[#dfeae5] object-cover shadow-[0_2px_8px_rgba(31,107,91,0.05)]" />;
  }

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#dfeae5] bg-[#eef7f4] text-[11px] font-semibold tracking-[-0.03em] text-[#1f6b5b] shadow-[0_2px_8px_rgba(31,107,91,0.05)]">
      {getShopInitials(name)}
    </div>
  );
}

export function Avatar({ seed }: { seed: string }) {
  return <div className="flex size-11 items-center justify-center rounded-full border border-[#dfeae5] bg-[#f6fbf9] text-lg shadow-[0_2px_8px_rgba(31,107,91,0.05)]">{seed}</div>;
}

export function UrgencyPill({ status, days }: { status: "overdue" | "soon" | "ok" | "unknown"; days: number | null }) {
  const text = status === "overdue" ? `${Math.abs(days || 0)}일 초과` : status === "soon" ? `${days}일 남음` : status === "ok" ? `${days}일 여유` : "미산정";
  const cls = status === "overdue" ? "bg-red-50 text-red-700" : status === "soon" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700";
  return <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${cls}`}>{text}</span>;
}

export function InfoItem({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={`rounded-[16px] border border-[var(--border)] bg-white px-4 py-2 ${className}`.trim()}>
      <p className="text-[12px] font-medium leading-4 text-[var(--muted)]">{label}</p>
      <p className="mt-1 flex min-h-[20px] items-center text-[15px] font-semibold leading-5 tracking-[-0.02em] text-[var(--text)]">{value}</p>
    </div>
  );
}

function stripNotificationLinks(message: string) {
  return message
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^https?:\/\//i.test(line))
    .filter((line) => !/^예약 링크\b/i.test(line))
    .filter((line) => !/^예약 확인 링크\b/i.test(line))
    .filter((line) => !/^취소.?변경 내역 조회 링크\b/i.test(line))
    .join("\n");
}

function extractNotificationManageUrl(notification: BootstrapPayload["notifications"][number]) {
  const fromMetadata = typeof notification.metadata?.bookingManageUrl === "string" ? notification.metadata.bookingManageUrl : null;
  if (fromMetadata) return fromMetadata;

  const matches = notification.message.match(/https?:\/\/[^\s]+/gi) ?? [];
  return matches.find((item) => /\/manage(?:[/?]|$)/i.test(item)) ?? null;
}

function getNotificationActionLabel(type: BootstrapPayload["notifications"][number]["type"]) {
  switch (type) {
    case "booking_cancelled":
    case "booking_rejected":
    case "booking_rescheduled_confirmed":
      return "취소·변경 내역 조회";
    case "booking_received":
    case "booking_confirmed":
    case "appointment_reminder_10m":
    case "grooming_almost_done":
    case "grooming_completed":
      return "예약 확인";
    default:
      return null;
  }
}

export function NotificationHistoryRow({ notification, pet }: { notification: BootstrapPayload["notifications"][number]; pet: Pet | null }) {
  const typeLabel = (() => {
    switch (notification.type) {
      case "booking_received":
        return "예약 접수";
      case "booking_confirmed":
        return "예약 완료";
      case "owner_booking_requested":
        return "새 예약 접수";
      case "booking_rejected":
        return "예약 거절";
      case "booking_cancelled":
        return "예약 취소";
      case "booking_rescheduled_confirmed":
        return "예약 변경";
      case "appointment_reminder_10m":
        return "방문 전 안내";
      case "grooming_started":
        return "미용 시작";
      case "grooming_almost_done":
        return "픽업 준비";
      case "grooming_completed":
        return "미용 완료";
      case "revisit_notice":
        return "재방문 안내";
      case "birthday_greeting":
        return "생일 축하";
      default:
        return "알림 발송";
    }
  })();
  const statusLabel =
    notification.status === "sent" || notification.status === "mocked"
      ? "발송 완료"
      : notification.status === "failed"
        ? "발송 실패"
        : notification.status === "queued"
          ? "발송 대기"
          : "건너뜀";
  const statusTone =
    notification.status === "sent" || notification.status === "mocked"
      ? "bg-[#eef8f3] text-[var(--accent)]"
      : notification.status === "failed"
        ? "bg-[#fdf0ec] text-[#b85c47]"
        : "bg-[#f4f0ea] text-[var(--muted)]";
  const timestamp = notification.sent_at ?? notification.created_at;
  const parsed = new Date(timestamp);
  const timeLabel = Number.isNaN(parsed.getTime())
    ? timestamp
    : `${String(parsed.getFullYear()).slice(-2)}.${String(parsed.getMonth() + 1).padStart(2, "0")}.${String(parsed.getDate()).padStart(2, "0")} ${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`;
  const displayMessage = stripNotificationLinks(notification.message);
  const actionLabel = getNotificationActionLabel(notification.type);
  const actionUrl = extractNotificationManageUrl(notification);

  return (
    <div className="px-3.5 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[16px] font-medium tracking-[-0.01em] text-[var(--text)]">{typeLabel}</p>
            {pet ? <span className="text-[14px] font-medium text-[var(--muted)]">{pet.name}</span> : null}
          </div>
          <p className="mt-1 text-[14px] leading-5 text-[var(--muted)]">{timeLabel}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[14px] font-normal ${statusTone}`}>{statusLabel}</span>
      </div>
      {displayMessage ? (
        <p className="mt-1.5 whitespace-pre-line break-words text-[14px] leading-5 text-[var(--text)]">{displayMessage}</p>
      ) : null}
      {actionLabel && actionUrl ? (
        <div className="mt-2.5">
          <a
            href={actionUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-[34px] items-center justify-center rounded-[10px] border border-[var(--border)] bg-white px-3 text-[13px] font-medium text-[var(--text)] transition hover:bg-[#fcfaf7]"
          >
            {actionLabel}
          </a>
        </div>
      ) : null}
    </div>
  );
}
