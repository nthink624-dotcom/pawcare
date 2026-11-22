import type { ReactNode } from "react";

export function CustomerReportSectionTitle({
  id,
  icon,
  children,
  subtitle,
}: {
  id?: string;
  icon?: ReactNode;
  children: ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      {icon ? <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#fdf0ef] text-[#ad5e69] [&>svg]:h-[18px] [&>svg]:w-[18px]" aria-hidden="true">
        {icon}
      </span> : null}
      <div>
        <h2 id={id} data-report-section-title className="text-[18px] font-normal leading-[26px] tracking-[-0.02em] text-[#433438]">{children}</h2>
        {subtitle ? <p className="mt-0.5 text-[13px] font-normal leading-5 text-[#8d7d82]">{subtitle}</p> : null}
      </div>
    </div>
  );
}
