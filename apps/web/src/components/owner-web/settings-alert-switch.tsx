"use client";

import type { ComponentPropsWithoutRef } from "react";

import { Switch } from "@/components/ui/switch";

type AlertSettingsSwitchProps = Omit<ComponentPropsWithoutRef<typeof Switch>, "size" | "className" | "thumbClassName">;

export function AlertSettingsSwitch(props: AlertSettingsSwitchProps) {
  return (
    <Switch
      {...props}
      size="md"
      className="h-11 w-11 border-transparent bg-transparent before:absolute before:h-6 before:w-11 before:rounded-full before:border before:border-[#d6dee8] before:bg-[#f1f5f9] data-[checked]:before:border-[#2563eb] data-[checked]:before:bg-[#2563eb] focus-visible:outline-[#2563eb] focus-visible:outline-offset-2"
      thumbClassName="relative z-10 h-5 w-5"
    />
  );
}
