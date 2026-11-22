"use client";

import { IconChevronDown as ChevronDown } from "@tabler/icons-react";
import { WheelTimeField } from "@petmanager/shared/components/ui/wheel-time-field";
import styles from "./initial-setup-layout.module.css";

export default function SetupTimeField({ label, value, onChange }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return <div className={styles.timeField} data-setup-time-field>
    <span aria-hidden="true" className={styles.timeFieldSurface} />
    <WheelTimeField aria-label={label} value={value} onValueChange={onChange} displayFormat="24h" placeholder="선택"
      className="relative z-[1] min-h-11 min-w-0 w-full justify-center rounded-[8px] border-0 bg-transparent pl-1 pr-5 text-[16px] font-normal leading-6"
      data-setup-time-control data-setup-time-value />
    <ChevronDown aria-hidden="true" className={styles.timeFieldIndicator} />
  </div>;
}
