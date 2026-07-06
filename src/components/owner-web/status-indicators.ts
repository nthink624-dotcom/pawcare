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
  pending: "bg-[#b98121]",
  confirmed: "bg-[#1f9d55]",
  active: "bg-[#2563eb]",
  pickupReady: "bg-[#7c3aed]",
  completed: "bg-[#64748b]",
  changed: "bg-[#b98121]",
  cancelled: "bg-[#a04455]",
  rejected: "bg-[#a04455]",
  noshow: "bg-[#a04455]",
  missed: "bg-[#b98121]",
  neutral: "bg-[#b9c3cf]",
  teal: "bg-[#1f9d55]",
  amber: "bg-[#b98121]",
  burgundy: "bg-[#a04455]",
  slate: "bg-[#64748b]",
};

export const wrapIndicatorClass: Record<StatusIndicatorTone, string> = {
  pending: "pm-wrap-indicator [--pm-wrap-indicator-color:#b98121]",
  confirmed: "pm-wrap-indicator [--pm-wrap-indicator-color:#1f9d55]",
  active: "pm-wrap-indicator [--pm-wrap-indicator-color:#2563eb]",
  pickupReady: "pm-wrap-indicator [--pm-wrap-indicator-color:#7c3aed]",
  completed: "pm-wrap-indicator [--pm-wrap-indicator-color:#64748b]",
  changed: "pm-wrap-indicator [--pm-wrap-indicator-color:#b98121]",
  cancelled: "pm-wrap-indicator [--pm-wrap-indicator-color:#a04455]",
  rejected: "pm-wrap-indicator [--pm-wrap-indicator-color:#a04455]",
  noshow: "pm-wrap-indicator [--pm-wrap-indicator-color:#a04455]",
  missed: "pm-wrap-indicator [--pm-wrap-indicator-color:#b98121]",
  neutral: "pm-wrap-indicator [--pm-wrap-indicator-color:#b9c3cf]",
  teal: "pm-wrap-indicator [--pm-wrap-indicator-color:#1f9d55]",
  amber: "pm-wrap-indicator [--pm-wrap-indicator-color:#b98121]",
  burgundy: "pm-wrap-indicator [--pm-wrap-indicator-color:#a04455]",
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
