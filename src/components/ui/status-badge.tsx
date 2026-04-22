import { cn } from "@/lib/utils";

type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

export type StatusBadgeStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "rescheduled"
  | "noshow"
  | "payment-complete"
  | "payment-failed"
  | "subscription-active"
  | "subscription-expired"
  | "admin-suspended"
  | "admin-restored";

export type StatusBadgeProps = {
  status?: StatusBadgeStatus;
  label?: string;
  tone?: StatusTone;
  className?: string;
};

const STATUS_MAP: Record<StatusBadgeStatus, { label: string; tone: StatusTone }> = {
  pending: { label: "예약 대기", tone: "warning" },
  confirmed: { label: "예약 확정", tone: "success" },
  completed: { label: "예약 완료", tone: "neutral" },
  cancelled: { label: "예약 취소", tone: "danger" },
  rescheduled: { label: "예약 변경", tone: "info" },
  noshow: { label: "노쇼", tone: "warning" },
  "payment-complete": { label: "결제 완료", tone: "success" },
  "payment-failed": { label: "결제 실패", tone: "danger" },
  "subscription-active": { label: "이용 중", tone: "success" },
  "subscription-expired": { label: "만료", tone: "danger" },
  "admin-suspended": { label: "계정 정지", tone: "danger" },
  "admin-restored": { label: "이용 복구", tone: "info" },
};

const TONE_CLASS_MAP: Record<StatusTone, string> = {
  neutral: "border-[var(--border)] bg-[#faf7f4] text-[var(--text)]",
  success: "border-[var(--success)]/15 bg-[var(--accent-soft)] text-[var(--success)]",
  warning: "border-[var(--warning)]/15 bg-[#f6eee3] text-[var(--warning)]",
  danger: "border-[var(--danger)]/15 bg-[#f8ece8] text-[var(--danger)]",
  info: "border-[var(--border)] bg-[var(--accent-soft)] text-[var(--accent)]",
};

export function StatusBadge({ className, label, status, tone }: StatusBadgeProps) {
  const resolved = status ? STATUS_MAP[status] : null;
  const resolvedLabel = label ?? resolved?.label ?? "상태";
  const resolvedTone = tone ?? resolved?.tone ?? "neutral";

  return (
    <span
      className={cn(
        "inline-flex h-6 items-center justify-center rounded-full border px-2.5 text-[12px] font-semibold leading-4 tracking-[-0.01em]",
        TONE_CLASS_MAP[resolvedTone],
        className,
      )}
    >
      {resolvedLabel}
    </span>
  );
}

export default StatusBadge;
