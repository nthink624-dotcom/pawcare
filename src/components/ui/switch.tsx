"use client";

import { Switch as BaseSwitch } from "@base-ui/react/switch";
import * as React from "react";

import { cn } from "@/lib/utils";

type SwitchSize = "sm" | "md" | "lg";

const rootSizeClasses: Record<SwitchSize, string> = {
  sm: "h-5 w-9",
  md: "h-6 w-11",
  lg: "h-7 w-[52px]",
};

const thumbSizeClasses: Record<SwitchSize, string> = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
};

const thumbPositionClasses: Record<SwitchSize, { checked: string; unchecked: string }> = {
  sm: { checked: "translate-x-[17px]", unchecked: "translate-x-[1px]" },
  md: { checked: "translate-x-[21px]", unchecked: "translate-x-[1px]" },
  lg: { checked: "translate-x-[25px]", unchecked: "translate-x-[1px]" },
};

export type SwitchProps = Omit<React.ComponentPropsWithoutRef<typeof BaseSwitch.Root>, "children"> & {
  size?: SwitchSize;
  thumbClassName?: string;
};

export const Switch = React.forwardRef<React.ElementRef<typeof BaseSwitch.Root>, SwitchProps>(function Switch(
  { checked = false, className, disabled, size = "md", thumbClassName, ...props },
  ref,
) {
  return (
    <BaseSwitch.Root
      ref={ref}
      checked={checked}
      disabled={disabled}
      className={cn(
        "relative inline-flex translate-y-px shrink-0 items-center rounded-full border align-middle transition-colors duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f7866]",
        rootSizeClasses[size],
        checked ? "border-[#2f7866] bg-[#2f7866]" : "border-[#d6dee8] bg-[#f1f5f9]",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
      {...props}
    >
      <BaseSwitch.Thumb
        className={cn(
          "pointer-events-none block rounded-full border border-black/5 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.20)] transition-transform duration-200 ease-out",
          thumbSizeClasses[size],
          checked ? thumbPositionClasses[size].checked : thumbPositionClasses[size].unchecked,
          thumbClassName,
        )}
      />
    </BaseSwitch.Root>
  );
});
