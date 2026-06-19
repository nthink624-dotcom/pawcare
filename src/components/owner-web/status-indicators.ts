import { cn } from "@/lib/utils";

export type StatusIndicatorTone =
  | "pending"
  | "confirmed"
  | "active"
  | "pickupReady"
  | "completed"
  | "changed"
  | "cancelled"
  | "rejected"
  | "noshow"
  | "missed"
  | "neutral"
  | "teal"
  | "amber"
  | "burgundy"
  | "slate";

export const miniWrapIndicatorBaseClass = "inline-block h-4 w-1 rounded-full";

export const dotIndicatorBaseClass = "inline-block h-2 w-2 rounded-full";

export const statusIndicatorBgClass: Record<StatusIndicatorTone, string> = {
  pending: "bg-[#f59e0b]",
  confirmed: "bg-[#2563eb]",
  active: "bg-[#16a34a]",
  pickupReady: "bg-[#0891b2]",
  completed: "bg-[#64748b]",
  changed: "bg-[#7c3aed]",
  cancelled: "bg-[#e11d48]",
  rejected: "bg-[#b91c1c]",
  noshow: "bg-[#ea580c]",
  missed: "bg-[#db2777]",
  neutral: "bg-[#94a3b8]",
  teal: "bg-[#2563eb]",
  amber: "bg-[#f59e0b]",
  burgundy: "bg-[#e11d48]",
  slate: "bg-[#64748b]",
};

export const wrapIndicatorClass: Record<StatusIndicatorTone, string> = {
  pending: "pm-wrap-indicator [--pm-wrap-indicator-color:#f59e0b]",
  confirmed: "pm-wrap-indicator [--pm-wrap-indicator-color:#2563eb]",
  active: "pm-wrap-indicator [--pm-wrap-indicator-color:#16a34a]",
  pickupReady: "pm-wrap-indicator [--pm-wrap-indicator-color:#0891b2]",
  completed: "pm-wrap-indicator [--pm-wrap-indicator-color:#64748b]",
  changed: "pm-wrap-indicator [--pm-wrap-indicator-color:#7c3aed]",
  cancelled: "pm-wrap-indicator [--pm-wrap-indicator-color:#e11d48]",
  rejected: "pm-wrap-indicator [--pm-wrap-indicator-color:#b91c1c]",
  noshow: "pm-wrap-indicator [--pm-wrap-indicator-color:#ea580c]",
  missed: "pm-wrap-indicator [--pm-wrap-indicator-color:#db2777]",
  neutral: "pm-wrap-indicator [--pm-wrap-indicator-color:#94a3b8]",
  teal: "pm-wrap-indicator [--pm-wrap-indicator-color:#2563eb]",
  amber: "pm-wrap-indicator [--pm-wrap-indicator-color:#f59e0b]",
  burgundy: "pm-wrap-indicator [--pm-wrap-indicator-color:#e11d48]",
  slate: "pm-wrap-indicator [--pm-wrap-indicator-color:#64748b]",
};

export function getWrapIndicatorClass(tone: StatusIndicatorTone) {
  return wrapIndicatorClass[tone];
}

export function getMiniWrapIndicatorClass(tone: StatusIndicatorTone) {
  return cn(miniWrapIndicatorBaseClass, statusIndicatorBgClass[tone]);
}

export function getDotIndicatorClass(tone: StatusIndicatorTone) {
  return cn(dotIndicatorBaseClass, statusIndicatorBgClass[tone]);
}
