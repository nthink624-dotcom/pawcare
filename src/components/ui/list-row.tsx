import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type ListRowProps = {
  leading?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  className?: string;
};

export function ListRow({ className, description, leading, meta, onClick, title, trailing }: ListRowProps) {
  const content = (
    <div className={cn("flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-white px-4 py-3", className)}>
      {leading ? <div className="shrink-0 pt-0.5">{leading}</div> : null}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="text-[16px] font-bold leading-6 tracking-[-0.02em] text-[var(--text)]">{title}</div>
        {description ? <div className="text-[14px] leading-[22px] text-[#5f574f]">{description}</div> : null}
        {meta ? <div className="text-[12px] leading-[18px] text-[var(--muted)]">{meta}</div> : null}
      </div>
      {trailing ? <div className="shrink-0 pt-0.5">{trailing}</div> : null}
    </div>
  );

  if (!onClick) {
    return content;
  }

  return (
    <button type="button" onClick={onClick} className="block w-full text-left focus-visible:outline-none">
      {content}
    </button>
  );
}

export default ListRow;
