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

export const statusIndicatorColor: Record<StatusIndicatorTone, string> = {
  pending: "#b98121",
  confirmed: "#1f9d55",
  active: "#2563eb",
  pickupReady: "#7c3aed",
  completed: "#64748b",
  changed: "#b98121",
  cancelled: "#a04455",
  rejected: "#a04455",
  noshow: "#a04455",
  missed: "#b98121",
  neutral: "#b9c3cf",
  teal: "#1f9d55",
  amber: "#b98121",
  burgundy: "#a04455",
  slate: "#64748b",
};

/**
 * Low-saturation surfaces let schedule cards communicate their appointment
 * status without competing with the staff identity marker or the selected
 * staff lane. The left edge remains the canonical status indicator.
 */
export const statusIndicatorSurface: Record<StatusIndicatorTone, { background: string; border: string }> = {
  pending: { background: "#f9f5ed", border: "#e5c57e" },
  confirmed: { background: "#edf7f1", border: "#9dcfb1" },
  active: { background: "#edf4fd", border: "#a9c7f7" },
  pickupReady: { background: "#f4effd", border: "#c8b6f1" },
  completed: { background: "#f2f4f6", border: "#c5d0d9" },
  changed: { background: "#fcf5e9", border: "#e6c882" },
  cancelled: { background: "#faeef0", border: "#dfb6c0" },
  rejected: { background: "#faeef0", border: "#dfb6c0" },
  noshow: { background: "#faeef0", border: "#dfb6c0" },
  missed: { background: "#fcf5e9", border: "#e6c882" },
  neutral: { background: "#f7f9fb", border: "#cbd5e1" },
  teal: { background: "#edf7f1", border: "#9dcfb1" },
  amber: { background: "#f9f5ed", border: "#e5c57e" },
  burgundy: { background: "#faeef0", border: "#dfb6c0" },
  slate: { background: "#f2f4f6", border: "#c5d0d9" },
};

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
