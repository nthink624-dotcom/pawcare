import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type SectionHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  titleClassName?: string;
};

export function SectionHeader({ action, className, description, title, titleClassName }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0 space-y-1">
        <h2 className={cn("text-[17px] font-medium leading-6 tracking-[-0.02em] text-[var(--text)]", titleClassName)}>{title}</h2>
        {description ? <p className="text-[14px] leading-[22px] text-[#5f574f]">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export default SectionHeader;
