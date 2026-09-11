"use client";

import { Check, ChevronRight } from "lucide-react";

import { getDotIndicatorClass } from "@/components/owner-web/status-indicators";
import { cn } from "@/lib/utils";
import type { CustomerGradeOverride } from "@/types/domain";

export type CustomerManagementTableRow = {
  id: string;
  registeredAt: string;
  name: string;
  phone: string;
  pets: string[];
  shopName: string;
  memo: string;
  alertEnabled: boolean;
  appointmentCount: number;
  groomingCount: number;
  noshowCount: number;
  customerGradeOverride: CustomerGradeOverride | null;
};

const customerGradeLabels: Record<"auto" | CustomerGradeOverride, string> = {
  auto: "자동",
  normal: "일반",
  loyal: "단골",
  attention: "주의",
};

function getCustomerGrade(row: CustomerManagementTableRow) {
  return customerGradeLabels[row.customerGradeOverride ?? "auto"];
}

function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10 && digits.startsWith("02")) return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return value || "미등록";
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
        <p className="text-[16px] font-medium text-[#111827]">조건에 맞는 고객이 없습니다.</p>
        <p className="mt-1 text-[15px] text-[#64748b]">검색어를 줄이거나 고객을 추가해 주세요.</p>
      </div>
    );
  }

  return (
    <>
      <div className="hidden h-full overflow-auto lg:block">
        <table className="w-full min-w-[1480px] table-fixed border-collapse text-[14px] leading-5">
          <thead className="sticky top-0 z-10 bg-[#f4f5f3] text-[#4f5a64]">
            <tr className="border-b border-[#dbe2ea]">
              {deleteMode ? <th className="w-14 px-2 py-3" aria-label="선택" /> : null}
              <th className="w-[104px] px-3 py-3 text-left font-medium">등록일</th>
              <th className="w-[112px] px-3 py-3 text-left font-medium">
                <button type="button" onClick={onSortByName} className="min-h-11 text-left hover:text-[#1f6b5b]">고객명</button>
              </th>
              <th className="w-[164px] px-3 py-3 text-left font-medium">고객 ID</th>
              <th className="w-[72px] px-3 py-3 text-left font-medium">등급</th>
              <th className="w-[140px] px-3 py-3 text-left font-medium">매장명</th>
              <th className="w-[132px] px-3 py-3 text-left font-medium">연락처</th>
              <th className="w-[70px] px-3 py-3 text-left font-medium">성별</th>
              <th className="w-[70px] px-3 py-3 text-left font-medium">나이</th>
              <th className="w-[220px] px-3 py-3 text-left font-medium">연락·메모</th>
              <th className="w-[210px] px-3 py-3 text-left font-medium">관련 이력</th>
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
                  <td className="truncate px-3 tabular-nums">{row.registeredAt}</td>
                  <td className="truncate px-3 font-semibold text-[#17243c]">{row.name}</td>
                  <td className="truncate px-3 font-mono text-[#64748b]">{row.id}</td>
                  <td className="px-3">{getCustomerGrade(row)}</td>
                  <td className="truncate px-3">{row.shopName || "미등록"}</td>
                  <td className="truncate px-3 tabular-nums">{formatPhoneNumber(row.phone)}</td>
                  <td className="px-3 text-[#64748b]">미등록</td>
                  <td className="px-3 text-[#64748b]">미등록</td>
                  <td className="truncate px-3">{row.alertEnabled ? "알림 수신" : "알림 중지"} · {row.memo || "미등록"}</td>
                  <td className="truncate px-3">반려동물 {row.pets.join(", ") || "미등록"} · 예약 {row.appointmentCount}회 · 미용 {row.groomingCount}회</td>
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
                {deleteMode ? <SelectionControl checked={checked} onToggle={() => onToggleDelete(row.id)} /> : <span className={cn("mt-2", row.noshowCount >= 2 ? getDotIndicatorClass("burgundy") : row.alertEnabled ? getDotIndicatorClass("teal") : getDotIndicatorClass("neutral"))} />}
                <button type="button" onClick={() => onOpen(row.id)} className="min-h-11 min-w-0 flex-1 text-left">
                  <span className="flex items-center justify-between gap-3">
                    <span className="truncate text-[15px] font-semibold text-[#17243c]">{row.name} · {getCustomerGrade(row)}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[#94a3b8]" />
                  </span>
                  <span className="mt-1 block truncate text-[14px] leading-5 text-[#475569]">{formatPhoneNumber(row.phone)} · {row.shopName || "미등록"}</span>
                </button>
              </div>
              <dl className="mt-2 grid min-w-0 grid-cols-2 gap-x-3 gap-y-2 border-t border-[#edf2f7] pt-2 text-[14px] leading-5">
                <div className="min-w-0"><dt className="text-[#94a3b8]">등록일</dt><dd className="mt-0.5 break-words text-[#475569]">{row.registeredAt}</dd></div>
                <div className="min-w-0"><dt className="text-[#94a3b8]">성별 · 나이</dt><dd className="mt-0.5 break-words text-[#475569]">미등록 · 미등록</dd></div>
                <div className="min-w-0"><dt className="text-[#94a3b8]">관련 이력</dt><dd className="mt-0.5 break-words text-[#475569]">예약 {row.appointmentCount}회 · 미용 {row.groomingCount}회</dd></div>
                <div className="col-span-2"><dt className="text-[#94a3b8]">연락·메모</dt><dd className="mt-0.5 line-clamp-2 text-[#475569]">{row.alertEnabled ? "알림 수신" : "알림 중지"} · {row.memo || "미등록"}</dd></div>
                <div className="col-span-2"><dt className="text-[#94a3b8]">고객 ID</dt><dd className="mt-0.5 truncate font-mono text-[#64748b]">{row.id}</dd></div>
              </dl>
            </article>
          );
        })}
      </div>
    </>
  );
}
