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
  "text-[13px] font-semibold tracking-[0.02em] text-[#5f665f]";

export const PAGE_TITLE =
  "text-[28px] font-extrabold leading-[1.08] tracking-[-0.05em] text-[#101828]";

export const PAGE_DESCRIPTION =
  "text-[14px] leading-6 text-[#667085]";

export const SECTION_TITLE =
  "text-[16px] font-semibold tracking-[-0.02em] text-[var(--text)]";

export const SECTION_DESCRIPTION =
  "text-[13px] leading-5 text-[var(--muted)]";

export const SURFACE_CARD =
  "rounded-[18px] border border-[var(--border)] bg-white shadow-[var(--shadow-soft)]";

export const SURFACE_CARD_COMPACT =
  "rounded-[16px] border border-[var(--border)] bg-white shadow-[var(--shadow-soft)]";

export const INPUT_LABEL =
  "mb-1.5 block text-[12px] font-medium tracking-[-0.01em] text-[#6b7280]";

export const INPUT_BASE =
  "h-[48px] w-full rounded-[14px] border border-[#cfd4cd] bg-white px-4 text-[15px] font-medium tracking-[-0.02em] text-[#111827] outline-none transition placeholder:text-[#b0b7bf] focus:border-[#2f786b] focus:ring-3 focus:ring-[#2f786b]/10";

export const INPUT_TEXTAREA =
  "min-h-[96px] w-full rounded-[14px] border border-[#cfd4cd] bg-white px-4 py-3 text-[15px] font-medium tracking-[-0.02em] text-[#111827] outline-none transition placeholder:text-[#b0b7bf] focus:border-[#2f786b] focus:ring-3 focus:ring-[#2f786b]/10";

export const BUTTON_PRIMARY =
  "inline-flex h-[52px] w-full items-center justify-center rounded-[14px] bg-[var(--accent)] px-4 text-[15px] font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-45";

export const BUTTON_SECONDARY =
  "inline-flex h-[52px] w-full items-center justify-center rounded-[14px] border border-[var(--border)] bg-white px-4 text-[15px] font-semibold text-[var(--text)] transition hover:bg-[#fcfaf7] disabled:cursor-not-allowed disabled:opacity-45";

export const BUTTON_DANGER =
  "inline-flex h-[52px] w-full items-center justify-center rounded-[14px] bg-[var(--danger)] px-4 text-[15px] font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-45";

export const INLINE_ERROR =
  "text-[13px] font-medium leading-5 text-[#b42318]";

export const INLINE_HELP =
  "text-[12px] font-medium leading-5 text-[var(--muted)]";
