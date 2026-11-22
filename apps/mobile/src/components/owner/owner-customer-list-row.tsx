import { IconChevronRight } from "@tabler/icons-react";

type OwnerCustomerListRowProps = {
  name: string;
  phone?: string;
  petNames: string;
  onOpen: () => void;
};

export default function OwnerCustomerListRow({ name, phone, petNames, onOpen }: OwnerCustomerListRowProps) {
  return (
    <button
      type="button"
      aria-label={`${name} 상세 보기`}
      onClick={onOpen}
      className="flex min-h-11 w-full items-center gap-2 rounded-[14px] border border-[#e2eaf3] bg-white px-3 py-[7px] text-left transition hover:border-[#b8cce4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-inset"
    >
      <span aria-hidden="true" className="mr-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-[#e8f0fa] text-[14px] font-medium text-[#294c75]">
        {name.slice(0, 1)}
      </span>
      <span className="flex min-w-28 flex-1 flex-col gap-0.5">
        <span className="text-[16px] font-semibold leading-[22px] text-[#26364a] [overflow-wrap:anywhere]">{name}</span>
        {phone ? (
          <span className="text-[14px] leading-5 tabular-nums text-[var(--muted)] [overflow-wrap:anywhere]">{phone}</span>
        ) : null}
      </span>
      {petNames ? (
        <span className="min-w-0 max-w-[38%] truncate rounded-full bg-[#eaf4f3] px-2 py-1 text-[12px] font-medium leading-4 text-[#245b63]">
          {petNames}
        </span>
      ) : (
        <span className="max-w-[38%] text-[12px] leading-4 text-[var(--muted)]">반려동물 없음</span>
      )}
      <IconChevronRight aria-hidden="true" size={16} className="shrink-0 text-[#718196]" strokeWidth={1.9} />
    </button>
  );
}
