import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type FormFieldProps = {
  label?: string;
  required?: boolean;
  helperText?: string;
  errorText?: string;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
};

export function FormField({ children, className, errorText, helperText, htmlFor, label, required = false }: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <label htmlFor={htmlFor} className="block text-[12px] font-medium leading-[18px] tracking-[-0.01em] text-[#6b7280]">
          {label}
          {required ? <span className="ml-1 text-[var(--danger)]">*</span> : null}
        </label>
      ) : null}
      {children}
      {errorText ? (
        <p className="text-[12px] font-medium leading-[18px] text-[var(--danger)]">{errorText}</p>
      ) : helperText ? (
        <p className="text-[12px] leading-[18px] text-[var(--muted)]">{helperText}</p>
      ) : null}
    </div>
  );
}

export default FormField;
