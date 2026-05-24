import { cn } from "@/lib/utils";

export type StatusIndicatorTone = "teal" | "amber" | "burgundy" | "slate" | "neutral";

export const miniWrapIndicatorBaseClass = "inline-block h-4 w-1 rounded-full";

export const dotIndicatorBaseClass = "inline-block h-2 w-2 rounded-full";

export const statusIndicatorBgClass: Record<StatusIndicatorTone, string> = {
  teal: "bg-[#2f9b8a]",
  amber: "bg-[#d99a2b]",
  burgundy: "bg-[#8f2438]",
  slate: "bg-[#64748b]",
  neutral: "bg-[#b9c3cf]",
};

export const wrapIndicatorClass: Record<StatusIndicatorTone, string> = {
  teal: "pm-wrap-indicator [--pm-wrap-indicator-color:#2f7866]",
  amber: "pm-wrap-indicator [--pm-wrap-indicator-color:#b98121]",
  burgundy: "pm-wrap-indicator [--pm-wrap-indicator-color:#a04455]",
  slate: "pm-wrap-indicator [--pm-wrap-indicator-color:#64748b]",
  neutral: "pm-wrap-indicator [--pm-wrap-indicator-color:#b9c3cf]",
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
