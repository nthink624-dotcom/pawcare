import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export type AppInputProps = InputHTMLAttributes<HTMLInputElement>;

export const AppInput = forwardRef<HTMLInputElement, AppInputProps>(function AppInput(
  { className, type = "text", ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        "h-12 w-full rounded-xl border border-[var(--border)] bg-white px-4 text-[16px] font-normal leading-6 tracking-normal text-[var(--text)] outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10 placeholder:text-[16px] placeholder:font-normal placeholder:text-[#b0b7bf] disabled:cursor-not-allowed disabled:bg-[#faf7f4] disabled:text-[var(--muted)]",
        className,
      )}
      {...props}
    />
  );
});

export default AppInput;
