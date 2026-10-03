"use client";

import { Check, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

export type CustomerManagementTableRow = {
  id: string;
  registeredAt: string;
  name: string;
  phone: string;
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
      <div className="hidden h-full overflow-auto lg:block">
        <table className="w-full min-w-[720px] table-fixed border-collapse text-[14px] leading-5">
          <thead className="sticky top-0 z-10 bg-[#f4f5f3] text-[#4f5a64]">
            <tr className="border-b border-[#dbe2ea]">
              {deleteMode ? <th className="w-14 px-2 py-0" aria-label="선택" /> : null}
              <th className="w-[112px] px-2 py-0 text-left font-medium">등록일</th>
              <th className="w-[100px] px-2 py-0 text-left font-medium">
                <button type="button" onClick={onSortByName} className="inline-flex min-h-11 items-center text-left hover:text-[#1f6b5b]">고객명</button>
              </th>
              <th className="px-2 py-0 text-left font-medium">연락처</th>
              <th className="px-2 py-0 text-left font-medium">반려동물 이름</th>
              <th className="px-2 py-0 text-left font-medium">반려동물 나이</th>
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
                    "h-[58px] cursor-pointer border-b border-[#edf2f7] text-[#334155] outline-none transition focus-visible:bg-[#eef5ff]",
                    selectedId === row.id ? "bg-[#f8fafc]" : "bg-white hover:bg-[#fbfcfd]",
                  )}
                >
                  {deleteMode ? <td className="px-2"><SelectionControl checked={checked} onToggle={() => onToggleDelete(row.id)} /></td> : null}
                  <td className="truncate px-2 tabular-nums">{row.registeredAt}</td>
                  <td className="truncate px-2 font-medium text-[#17243c]">{row.name}</td>
                  <td className="truncate px-2 tabular-nums">{formatPhoneNumber(row.phone)}</td>
                  <td className="truncate px-2">{row.pets.map((pet) => pet.name).join(", ") || "미등록"}</td>
                  <td className="truncate px-2">{row.pets.map((pet) => formatPetAge(pet.birthday)).join(", ") || "미등록"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="h-full space-y-2 overflow-y-auto p-3 lg:hidden">
        {rows.map((row) => {
          const checked = selectedDeleteIds.includes(row.id);
          return (
            <article key={row.id} className={cn("rounded-[10px] border p-3", selectedId === row.id ? "border-[#bfd2ea] bg-[#f8fbff]" : "border-[#dbe2ea] bg-white")}>
              <div className="flex items-start gap-2">
                {deleteMode ? <SelectionControl checked={checked} onToggle={() => onToggleDelete(row.id)} /> : null}
                <button type="button" onClick={() => onOpen(row.id)} className="min-h-11 min-w-0 flex-1 text-left">
                  <span className="flex items-center justify-between gap-3">
                    <span className="min-w-0 break-keep text-[14px] font-medium leading-5 text-[#17243c] [overflow-wrap:anywhere]">{row.name}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[#94a3b8]" />
                  </span>
                  <span className="mt-1 block truncate text-[14px] leading-5 font-normal text-[#475569]">{formatPhoneNumber(row.phone)}</span>
                </button>
              </div>
              <dl className="mt-2 grid min-w-0 grid-cols-2 gap-x-3 gap-y-2 border-t border-[#edf2f7] pt-2 text-[14px] leading-5">
                <div className="min-w-0"><dt className="font-medium text-[#64748b]">등록일</dt><dd className="mt-0.5 break-words font-normal text-[#475569]">{row.registeredAt}</dd></div>
                <div className="min-w-0"><dt className="font-medium text-[#64748b]">반려동물 이름</dt><dd className="mt-0.5 break-words font-normal text-[#475569]">{row.pets.map((pet) => pet.name).join(", ") || "미등록"}</dd></div>
                <div className="min-w-0"><dt className="font-medium text-[#64748b]">반려동물 나이</dt><dd className="mt-0.5 break-words font-normal text-[#475569]">{row.pets.map((pet) => formatPetAge(pet.birthday)).join(", ") || "미등록"}</dd></div>
              </dl>
            </article>
          );
        })}
      </div>
    </>
  );
}
