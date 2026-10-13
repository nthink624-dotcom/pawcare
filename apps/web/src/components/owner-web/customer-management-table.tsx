"use client";

import { Check, ChevronRight, PawPrint } from "lucide-react";

import { cn } from "@/lib/utils";

export type CustomerManagementTableRow = {
  id: string;
  registeredAt: string;
  name: string;
  phone: string;
  customerGrade: "신규" | "일반" | "단골";
  recentVisitDate: string | null;
  recentService: string | null;
  pets: Array<{ name: string; birthday: string | null }>;
};

function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10 && digits.startsWith("02")) return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return value || "미등록";
}

function formatPetAge(birthday: string | null) {
  if (!birthday) return "미등록";
  const birthDate = new Date(`${birthday}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) return "미등록";
  const today = new Date();
  let months = (today.getFullYear() - birthDate.getFullYear()) * 12 + today.getMonth() - birthDate.getMonth();
  if (today.getDate() < birthDate.getDate()) months -= 1;
  if (months < 0) return "미등록";
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (years === 0) return `${remainingMonths}개월`;
  return remainingMonths === 0 ? `${years}세` : `${years}세 ${remainingMonths}개월`;
}

function SelectionControl({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-label={checked ? "고객 선택 해제" : "고객 선택"}
      aria-pressed={checked}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className={cn(
        "inline-flex h-11 w-11 items-center justify-center rounded-[8px] border bg-white",
        checked ? "border-[#2f7866] text-[#2f7866]" : "border-[#cbd5e1] text-transparent",
      )}
    >
      <span className={cn("inline-flex h-5 w-5 items-center justify-center rounded-[5px] border", checked ? "border-[#2f7866] bg-[#2f7866] text-white" : "border-[#cbd5e1]")}>
        {checked ? <Check className="h-3.5 w-3.5" /> : null}
      </span>
    </button>
  );
}

export default function CustomerManagementTable({
  rows,
  selectedId,
  deleteMode,
  selectedDeleteIds,
  onSortByName,
  onToggleDelete,
  onOpen,
}: {
  rows: CustomerManagementTableRow[];
  selectedId: string;
  deleteMode: boolean;
  selectedDeleteIds: string[];
  onSortByName: () => void;
  onToggleDelete: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
        <p className="text-[16px] font-medium leading-6 text-[#111827]">조건에 맞는 고객이 없습니다.</p>
        <p className="mt-1 text-[13px] font-normal leading-5 text-[#64748b]">검색어를 줄이거나 고객을 추가해 주세요.</p>
      </div>
    );
  }

  return (
    <>
      <div className="hidden h-full overflow-auto bg-[#fafbfD] px-3 pb-3 md:block">
        <table data-customer-management-table className="w-full min-w-[1080px] table-fixed border-separate border-spacing-x-0 border-spacing-y-2 text-center text-[16px] font-normal leading-6 [&_th]:align-middle [&_td]:align-middle [&_td:first-child]:rounded-l-[14px] [&_td:last-child]:rounded-r-[14px]">
          <colgroup>
            {deleteMode ? <col className="w-14" /> : null}
            <col className="w-[11%]" />
            <col className="w-[15%]" />
            <col className="w-[12%]" />
            <col className="w-[11%]" />
            <col className="w-[12%]" />
            <col />
            <col className="w-[8%]" />
            <col className="w-[12%]" />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-[#fafbfd] text-[14px] leading-5 text-[#526079] [&_th]:h-14 [&_th]:bg-[#edf2f8] [&_th:first-child]:rounded-l-[14px] [&_th:last-child]:rounded-r-[14px] [&_svg]:shrink-0 [&_svg]:text-[#7387a2]">
            <tr>
              {deleteMode ? <th className="w-14 px-2 py-0" aria-label="선택" /> : null}
              <th scope="col" className="px-2 py-0 text-center font-medium">
                <button type="button" aria-label="고객명으로 정렬" data-owner-control-size="content" onClick={onSortByName} className="inline-flex min-h-11 items-center justify-center rounded-[10px] px-2 text-center text-[14px] font-medium leading-5 transition-colors hover:bg-white hover:text-[#15213b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]">고객명</button>
              </th>
              <th scope="col" className="px-3 py-2 text-center font-medium">연락처</th>
              <th scope="col" className="px-3 py-2 text-center font-medium">반려동물 이름</th>
              <th scope="col" className="px-2 py-2 font-medium">반려동물 나이</th>
              <th scope="col" className="px-2 py-2 font-medium">최근 방문일</th>
              <th scope="col" className="px-2 py-2 font-medium">최근 받은 서비스</th>
              <th scope="col" className="px-2 py-2 font-medium">고객 등급</th>
              <th scope="col" className="px-2 py-2 font-medium">등록일</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const checked = selectedDeleteIds.includes(row.id);
              return (
                <tr
                  key={row.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpen(row.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onOpen(row.id);
                    }
                  }}
                  className={cn(
                    "h-[60px] cursor-pointer text-[#475569] outline-none transition-colors focus-visible:bg-[#eef5ff] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2563eb]",
                    selectedId === row.id ? "bg-[#edf4fc]" : "bg-white hover:bg-[#f0f5fc]",
                  )}
                >
                  {deleteMode ? <td className="px-2"><SelectionControl checked={checked} onToggle={() => onToggleDelete(row.id)} /></td> : null}
                  <td className="truncate px-2 py-3 text-center text-[16px] font-medium leading-6 text-[#15213b]" title={row.name}>{row.name}</td>
                  <td className={cn("truncate px-3 text-center tabular-nums", !row.phone && "text-[#64748b]")}>{formatPhoneNumber(row.phone)}</td>
                  <td className="px-3 text-center font-normal text-[#334155]" title={row.pets.map((pet) => pet.name).join(", ")}><span className="flex min-w-0 items-center justify-center gap-2"><span aria-hidden="true" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f5f0e9] text-[#87664a]"><PawPrint className="h-4 w-4" strokeWidth={1.7} /></span><span className="truncate">{row.pets.map((pet) => pet.name).join(", ") || "미등록"}</span></span></td>
                  <td className={cn("truncate px-2", !row.pets.some((pet) => pet.birthday) && "text-[#64748b]")}>{row.pets.map((pet) => formatPetAge(pet.birthday)).join(", ") || "미등록"}</td>
                  <td className={cn("truncate px-2 tabular-nums", !row.recentVisitDate && "text-[#64748b]")}>{row.recentVisitDate || "미방문"}</td>
                  <td className={cn("break-words px-2 py-3", !row.recentService && "text-[#64748b]")} title={row.recentService || undefined}>{row.recentService || (row.recentVisitDate ? "미등록" : "미방문")}</td>
                  <td className="px-2"><span className={cn("inline-flex min-h-8 items-center rounded-full px-3 py-1 text-[16px] font-normal leading-6", row.customerGrade === "단골" ? "bg-[#edf6f2] text-[#1f6b5b]" : row.customerGrade === "신규" ? "bg-[#eff4fa] text-[#476184]" : "bg-[#f1f3f6] text-[#64748b]")}>{row.customerGrade}</span></td>
                  <td className="truncate px-2 tabular-nums text-[#64748b]">{row.registeredAt}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="h-full space-y-3 overflow-y-auto bg-[#f8fafc] p-3 md:hidden">
        {rows.map((row) => {
          const checked = selectedDeleteIds.includes(row.id);
          return (
            <article key={row.id} className={cn("rounded-[14px] border p-4", selectedId === row.id ? "border-[#b8c8d9] bg-[#f8fbff]" : "border-[#e8edf3] bg-white")}>
              <div className="flex items-start gap-2">
                {deleteMode ? <SelectionControl checked={checked} onToggle={() => onToggleDelete(row.id)} /> : null}
                <button type="button" onClick={() => onOpen(row.id)} className="relative min-h-11 min-w-0 flex-1 rounded-md pr-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]">
                  <span className="flex items-center gap-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="min-w-0 break-keep text-[16px] font-medium leading-6 text-[#17243c] [overflow-wrap:anywhere]">{row.name}</span>
                      <span className={cn("inline-flex min-h-6 shrink-0 items-center rounded-md px-2 text-[13px] font-medium leading-5", row.customerGrade === "단골" ? "bg-[#edf6f2] text-[#1f6b5b]" : row.customerGrade === "신규" ? "bg-[#eff4fa] text-[#476184]" : "bg-[#f1f3f6] text-[#64748b]")}>{row.customerGrade}</span>
                    </span>
                    <ChevronRight className="absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
                  </span>
                  <span className="mt-1 block truncate text-[16px] leading-6 font-normal text-[#475569]">{formatPhoneNumber(row.phone)}</span>
                </button>
              </div>
              <dl className="mt-3 grid min-w-0 grid-cols-2 gap-x-4 gap-y-3 border-t border-[#edf2f7] pt-3 text-left text-[16px] leading-6 [&_dt]:text-[14px] [&_dt]:leading-5">
                <div className="min-w-0"><dt className="font-medium text-[#64748b]">반려동물 이름</dt><dd className="mt-0.5 break-words font-normal text-[#475569]">{row.pets.map((pet) => pet.name).join(", ") || "미등록"}</dd></div>
                <div className="min-w-0"><dt className="font-medium text-[#64748b]">반려동물 나이</dt><dd className="mt-0.5 break-words font-normal text-[#475569]">{row.pets.map((pet) => formatPetAge(pet.birthday)).join(", ") || "미등록"}</dd></div>
                <div className="min-w-0"><dt className="font-medium text-[#64748b]">최근 방문일</dt><dd className="mt-0.5 break-words font-normal text-[#475569]">{row.recentVisitDate || "미방문"}</dd></div>
                <div className="min-w-0"><dt className="font-medium text-[#64748b]">최근 받은 서비스</dt><dd className="mt-0.5 break-words font-normal text-[#475569]">{row.recentService || (row.recentVisitDate ? "미등록" : "미방문")}</dd></div>
                <div className="col-span-2 min-w-0"><dt className="font-medium text-[#64748b]">등록일</dt><dd className="mt-0.5 break-words font-normal text-[#475569]">{row.registeredAt}</dd></div>
              </dl>
            </article>
          );
        })}
      </div>
    </>
  );
}
