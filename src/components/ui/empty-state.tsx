import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  titleClassName?: string;
};

export function EmptyState({ action, className, description, title, titleClassName }: EmptyStateProps) {
  return (
    <div className={cn("rounded-2xl border border-[var(--border)] bg-white px-4 py-6 text-center", className)}>
      <div className="space-y-1.5">
        <h3 className={cn("text-[16px] font-normal leading-6 tracking-[-0.02em] text-[var(--text)]", titleClassName)}>{title}</h3>
        {description ? <p className="text-[14px] leading-[22px] text-[#5f574f]">{description}</p> : null}
      </div>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export default EmptyState;
