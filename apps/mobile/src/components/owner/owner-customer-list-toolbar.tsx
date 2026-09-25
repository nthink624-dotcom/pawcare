import type { OwnerCustomerFilter } from "@/lib/owner-customer-filter";
import { Trash2 } from "lucide-react";

type OwnerCustomerListToolbarProps = {
  customerSearch: string;
  customerFilter: OwnerCustomerFilter;
  customerFilterCounts: Record<OwnerCustomerFilter, number>;
  isStaffApp: boolean;
  onCustomerSearchChange: (value: string) => void;
  onCustomerFilterChange: (filter: OwnerCustomerFilter) => void;
  onOpenDeleteMode: () => void;
};

const chipClassName = "inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border px-3 text-[14px] font-medium leading-5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2";

export default function OwnerCustomerListToolbar({
  customerSearch,
  customerFilter,
  customerFilterCounts,
  isStaffApp,
  onCustomerSearchChange,
  onCustomerFilterChange,
  onOpenDeleteMode,
}: OwnerCustomerListToolbarProps) {
  const filterOptions: Array<{ key: OwnerCustomerFilter; label: string; ariaLabel: string }> = [
    { key: "all", label: `전체 ${customerFilterCounts.all}명`, ariaLabel: "전체 고객 보기" },
    { key: "loyal", label: `단골 ${customerFilterCounts.loyal}명`, ariaLabel: "단골 고객만 보기" },
    { key: "first_visit", label: `신규 ${customerFilterCounts.first_visit}명`, ariaLabel: "신규 고객만 보기" },
  ];

  return (
    <div className="space-y-2 border-b border-[#eaf0f6] bg-white px-4 py-2.5" data-testid="customer-list-toolbar">
      <div className="flex items-center gap-2">
        <div className="flex h-11 min-w-0 flex-1 items-center rounded-[14px] border border-[#eaf0f6] bg-[#f6f9fc] px-3.5 focus-within:border-[#2563eb] focus-within:ring-2 focus-within:ring-[#2563eb]/20">
          <input
            aria-label="고객 검색"
            value={customerSearch}
            onChange={(event) => onCustomerSearchChange(event.target.value)}
            placeholder={isStaffApp ? "보호자명, 반려동물 이름 검색" : "보호자명, 연락처, 반려동물 이름 검색"}
            className="h-full min-h-0 min-w-0 flex-1 bg-transparent text-[14px] font-normal leading-5 outline-none placeholder:text-[14px] placeholder:font-normal placeholder:text-[#a8b3c0]"
          />
        </div>

        <button
          type="button"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-[#eaf0f6] bg-white text-[#8a97a6] transition hover:text-[#4f7cb8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"
          onClick={onOpenDeleteMode}
          aria-label="고객 삭제 선택 모드 열기"
        >
          <Trash2 className="h-[17px] w-[17px]" strokeWidth={1.9} aria-hidden="true" />
        </button>
      </div>

      <div className="no-scrollbar flex gap-1 overflow-x-auto pb-0.5" aria-label="고객 분류 필터">
        {filterOptions.map((option) => {
          const selected = customerFilter === option.key;
          return (
            <button
              key={option.key}
              type="button"
              aria-label={option.ariaLabel}
              aria-pressed={selected}
              className={`${chipClassName} ${selected ? "border-[#6f9bd1] bg-[#e7f0fa] text-[#174ea6]" : "border-[#eaf0f6] bg-[#f6f9fc] text-[#64748b]"}`}
              onClick={() => onCustomerFilterChange(option.key)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
