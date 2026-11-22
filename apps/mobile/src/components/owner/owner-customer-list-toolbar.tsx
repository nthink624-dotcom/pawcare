import { IconSearch, IconTrash } from "@tabler/icons-react";

type OwnerCustomerListToolbarProps = {
  customerSearch: string;
  isStaffApp: boolean;
  onCustomerSearchChange: (value: string) => void;
  onOpenDeleteMode: () => void;
};

export default function OwnerCustomerListToolbar({
  customerSearch,
  isStaffApp,
  onCustomerSearchChange,
  onOpenDeleteMode,
}: OwnerCustomerListToolbarProps) {
  return (
    <div className="flex items-center gap-2 px-3.5 pb-2 pt-1.5" data-testid="customer-list-toolbar">
      <div className="relative min-w-0 flex-1">
        <IconSearch aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#64748b]" strokeWidth={1.8} />
        <input
          aria-label="고객 검색"
          value={customerSearch}
          onChange={(event) => onCustomerSearchChange(event.target.value)}
          placeholder={isStaffApp ? "보호자·반려동물 검색" : "보호자·연락처·반려동물 검색"}
          className="block h-11 w-full min-w-0 rounded-[14px] border border-[#e2eaf3] bg-white pl-9 pr-3 text-[14px] font-normal leading-5 outline-none placeholder:text-[#64748b] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
        />
      </div>

      <button
        type="button"
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-[#e2eaf3] bg-white text-[#64748b] transition hover:text-[#174ea6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-inset"
        onClick={onOpenDeleteMode}
        aria-label="고객 삭제 선택 모드 열기"
      >
        <IconTrash className="size-[17px]" strokeWidth={1.8} aria-hidden="true" />
      </button>
    </div>
  );
}
