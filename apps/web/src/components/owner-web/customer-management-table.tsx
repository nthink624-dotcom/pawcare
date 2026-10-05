"use client";

import { Check, ChevronRight } from "lucide-react";

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
      <div className="hidden h-full overflow-auto md:block">
        <table className="w-full min-w-[1000px] table-fixed border-collapse text-center text-[16px] leading-6 [&_th]:align-middle [&_td]:align-middle">
          <colgroup>
            {deleteMode ? <col className="w-14" /> : null}
            <col className="w-[9%]" />
            <col className="w-[15%]" />
            <col className="w-[12%]" />
            <col className="w-[11%]" />
            <col className="w-[13%]" />
            <col />
            <col className="w-[8%]" />
            <col className="w-[13%]" />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-[#f4f5f3] text-[#4f5a64]">
            <tr className="border-b border-[#dbe2ea]">
              {deleteMode ? <th className="w-14 px-2 py-0" aria-label="선택" /> : null}
              <th scope="col" className="px-2 py-0 font-medium">
                <button type="button" onClick={onSortByName} className="inline-flex min-h-11 items-center justify-center text-center hover:text-[#1f6b5b]"><span className="text-[16px] leading-6">고객명</span></button>
              </th>
              <th scope="col" className="px-2 py-0 font-medium">연락처</th>
              <th scope="col" className="px-2 py-0 font-medium">반려동물 이름</th>
              <th scope="col" className="px-2 py-0 font-medium">반려동물 나이</th>
              <th scope="col" className="px-2 py-0 font-medium">최근 방문일</th>
              <th scope="col" className="px-2 py-0 font-medium">최근 받은 서비스</th>
              <th scope="col" className="px-2 py-0 font-medium">고객 등급</th>
              <th scope="col" className="px-2 py-0 font-medium">등록일</th>
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
                  <td className="truncate px-2 font-medium text-[#17243c]">{row.name}</td>
                  <td className="truncate px-2 tabular-nums">{formatPhoneNumber(row.phone)}</td>
                  <td className="truncate px-2">{row.pets.map((pet) => pet.name).join(", ") || "미등록"}</td>
                  <td className="truncate px-2">{row.pets.map((pet) => formatPetAge(pet.birthday)).join(", ") || "미등록"}</td>
                  <td className="truncate px-2 tabular-nums">{row.recentVisitDate || "미방문"}</td>
                  <td className="break-words px-2 py-2" title={row.recentService || undefined}>{row.recentService || (row.recentVisitDate ? "미등록" : "미방문")}</td>
                  <td className="px-2"><span className={cn("inline-flex min-h-6 items-center rounded-full border px-2 text-[16px] font-medium leading-6", row.customerGrade === "단골" ? "border-[#d6e8e2] bg-[#f3faf7] text-[#1f6b5b]" : "border-[#e2e8f0] bg-[#f8fafc] text-[#475569]")}>{row.customerGrade}</span></td>
                  <td className="truncate px-2 tabular-nums">{row.registeredAt}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="h-full space-y-2 overflow-y-auto p-3 md:hidden">
        {rows.map((row) => {
          const checked = selectedDeleteIds.includes(row.id);
          return (
            <article key={row.id} className={cn("rounded-[10px] border p-3", selectedId === row.id ? "border-[#bfd2ea] bg-[#f8fbff]" : "border-[#dbe2ea] bg-white")}>
              <div className="flex items-start gap-2">
                {deleteMode ? <SelectionControl checked={checked} onToggle={() => onToggleDelete(row.id)} /> : null}
                <button type="button" onClick={() => onOpen(row.id)} className="relative min-h-11 min-w-0 flex-1 px-5 text-center">
                  <span className="flex items-center justify-center gap-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="min-w-0 break-keep text-[16px] font-medium leading-6 text-[#17243c] [overflow-wrap:anywhere]">{row.name}</span>
                      <span className={cn("inline-flex min-h-6 shrink-0 items-center rounded-full border px-2 text-[16px] font-medium leading-6", row.customerGrade === "단골" ? "border-[#d6e8e2] bg-[#f3faf7] text-[#1f6b5b]" : "border-[#e2e8f0] bg-[#f8fafc] text-[#475569]")}>{row.customerGrade}</span>
                    </span>
                    <ChevronRight className="absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
                  </span>
                  <span className="mt-1 block truncate text-[16px] leading-6 font-normal text-[#475569]">{formatPhoneNumber(row.phone)}</span>
                </button>
              </div>
              <dl className="mt-2 grid min-w-0 grid-cols-2 gap-x-3 gap-y-2 border-t border-[#edf2f7] pt-2 text-center text-[16px] leading-6">
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
