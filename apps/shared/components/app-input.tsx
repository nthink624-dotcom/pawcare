import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "../lib/cn";

export type AppInputProps = InputHTMLAttributes<HTMLInputElement>;

function createAppInput(inputClassName: string) {
  return forwardRef<HTMLInputElement, AppInputProps>(function AppInput(
    { className, type = "text", ...props },
    ref,
  ) {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(inputClassName, className)}
        {...props}
      />
    );
  });
}

export const WebAppInput = createAppInput("h-12 w-full rounded-xl border border-[var(--border)] bg-white px-4 text-[14px] font-medium leading-[22px] tracking-[-0.02em] text-[var(--text)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10 placeholder:text-[#b0b7bf] disabled:cursor-not-allowed disabled:bg-[#faf7f4] disabled:text-[var(--muted)]");
export const MobileAppInput = createAppInput("h-12 w-full rounded-xl border border-[var(--border)] bg-white px-4 text-[16px] font-normal leading-6 tracking-normal text-[var(--text)] outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10 placeholder:text-[16px] placeholder:font-normal placeholder:text-[#b0b7bf] disabled:cursor-not-allowed disabled:bg-[#faf7f4] disabled:text-[var(--muted)]");
