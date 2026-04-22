import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type AppButtonVariant = "primary" | "secondary" | "text" | "danger" | "inline";
type AppButtonSize = "default" | "sm";

export type AppButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: AppButtonVariant;
  size?: AppButtonSize;
  fullWidth?: boolean;
};

const VARIANT_CLASS_MAP: Record<AppButtonVariant, string> = {
  primary:
    "bg-[var(--accent)] text-white shadow-sm hover:opacity-95 disabled:bg-[var(--accent)]/45 disabled:text-white",
  secondary:
    "border border-[var(--border)] bg-white text-[var(--text)] hover:bg-[#faf7f4] disabled:bg-white disabled:text-[var(--muted)]",
  text: "bg-transparent text-[var(--accent)] hover:bg-transparent hover:opacity-80 disabled:text-[var(--muted)]",
  danger:
    "border border-[var(--danger)]/20 bg-[#f8ece8] text-[var(--danger)] hover:bg-[#f4e5e0] disabled:border-[var(--danger)]/10 disabled:bg-[#fbf2ef] disabled:text-[var(--danger)]/50",
  inline:
    "border border-[var(--border)] bg-white text-[var(--text)] hover:bg-[#faf7f4] disabled:bg-white disabled:text-[var(--muted)]",
};

const SIZE_CLASS_MAP: Record<AppButtonSize, string> = {
  default: "h-12 rounded-[14px] px-4 text-[14px] font-semibold leading-5",
  sm: "h-8 rounded-[10px] px-2.5 text-[12px] font-semibold leading-4",
};

export const AppButton = forwardRef<HTMLButtonElement, AppButtonProps>(function AppButton(
  { children, className, disabled, fullWidth = false, size = "default", type = "button", variant = "primary", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 focus-visible:ring-offset-2 disabled:cursor-not-allowed",
        SIZE_CLASS_MAP[size],
        VARIANT_CLASS_MAP[variant],
        fullWidth ? "w-full" : "w-auto",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});

export default AppButton;
