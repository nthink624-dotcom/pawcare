import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const MOBILE_APP_SHELL =
  "mx-auto w-full max-w-[430px]";

export const PAGE_FRAME =
  "mx-auto min-h-screen w-full max-w-[430px] px-5 pb-8 pt-5";

export const PAGE_STACK = "space-y-6";

export const PAGE_EYEBROW =
  "text-[13px] font-normal leading-5 text-[#5f665f]";

export const PAGE_TITLE =
  "text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[#101828]";

export const PAGE_DESCRIPTION =
  "text-[14px] leading-6 text-[#667085]";

export const SECTION_TITLE =
  "text-[20px] font-semibold leading-7 tracking-[-0.015em] text-[var(--text)]";

export const SECTION_DESCRIPTION =
  "text-[13px] leading-5 text-[var(--muted)]";

export const SURFACE_CARD =
  "rounded-[18px] border border-[var(--border)] bg-white shadow-[var(--shadow-soft)]";

export const SURFACE_CARD_COMPACT =
  "rounded-[16px] border border-[var(--border)] bg-white shadow-[var(--shadow-soft)]";

export const INPUT_LABEL =
  "mb-1.5 block text-[14px] font-medium leading-5 tracking-[-0.005em] text-[#6b7280]";

export const INPUT_BASE =
  "h-[48px] w-full rounded-[14px] border border-[#cfd4cd] bg-white px-4 text-[16px] font-normal leading-6 text-[#111827] outline-none transition placeholder:text-[#b0b7bf] focus:border-[#2563eb] focus:ring-3 focus:ring-[#2563eb]/10";

export const INPUT_TEXTAREA =
  "min-h-[96px] w-full rounded-[14px] border border-[#cfd4cd] bg-white px-4 py-3 text-[16px] font-normal leading-6 text-[#111827] outline-none transition placeholder:text-[#b0b7bf] focus:border-[#2563eb] focus:ring-3 focus:ring-[#2563eb]/10";

export const BUTTON_PRIMARY =
  "inline-flex h-[52px] w-full items-center justify-center rounded-[14px] bg-[var(--accent)] px-4 text-[16px] font-medium leading-6 text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-45";

export const BUTTON_SECONDARY =
  "inline-flex h-[52px] w-full items-center justify-center rounded-[14px] border border-[var(--border)] bg-white px-4 text-[16px] font-medium leading-6 text-[var(--text)] transition hover:bg-[#fcfaf7] disabled:cursor-not-allowed disabled:opacity-45";

export const BUTTON_DANGER =
  "inline-flex h-[52px] w-full items-center justify-center rounded-[14px] bg-[var(--danger)] px-4 text-[16px] font-medium leading-6 text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-45";

export const INLINE_ERROR =
  "text-[13px] font-medium leading-5 text-[#b42318]";

export const INLINE_HELP =
  "text-[13px] font-normal leading-5 text-[var(--muted)]";
