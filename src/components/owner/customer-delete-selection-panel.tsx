"use client";

import { ChevronRight, Search } from "lucide-react";

import type { Guardian, Pet } from "@/types/domain";

type CustomerDeleteSummary = {
  guardian: Guardian;
  pets: Pet[];
};

type CustomerDeleteSelectionPanelProps = {
  customerSearch: string;
  onCustomerSearchChange: (value: string) => void;
  filteredDeletedGuardians: Guardian[];
  isDeletedCustomersOpen: boolean;
  onToggleDeletedCustomersOpen: () => void;
  filteredGuardians: CustomerDeleteSummary[];
  selectedGuardianIds: string[];
  selectedGuardianCount: number;
  allFilteredGuardiansSelected: boolean;
  onToggleAllVisibleGuardians: () => void;
  onToggleGuardianSelection: (guardianId: string) => void;
  onClose: () => void;
  onRestoreDeletedGuardians: (guardianIds: string[]) => void | Promise<void>;
  saving: boolean;
  emptyTitle: string;
  emptyDescription: string;
};

export default function CustomerDeleteSelectionPanel({
  customerSearch,
  onCustomerSearchChange,
  filteredDeletedGuardians,
  isDeletedCustomersOpen,
  onToggleDeletedCustomersOpen,
  filteredGuardians,
  selectedGuardianIds,
  selectedGuardianCount,
  allFilteredGuardiansSelected,
  onToggleAllVisibleGuardians,
  onToggleGuardianSelection,
  onClose,
  onRestoreDeletedGuardians,
  saving,
  emptyTitle,
  emptyDescription,
}: CustomerDeleteSelectionPanelProps) {
  return (
    <div className="rounded-[14px] border border-[var(--border)] bg-white px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[19px] font-semibold tracking-[-0.03em] text-[var(--text)]">고객 삭제</h2>
          {filteredDeletedGuardians.length > 0 ? (
            <button
              type="button"
              className="mt-1 inline-flex items-center gap-1 text-[12px] font-medium text-[var(--muted)] transition hover:text-[var(--text)]"
              onClick={onToggleDeletedCustomersOpen}
            >
              <span>복구 가능 고객 {filteredDeletedGuardians.length}명 보기</span>
              <ChevronRight
                className={`h-3.5 w-3.5 transition ${isDeletedCustomersOpen ? "rotate-90" : ""}`}
                strokeWidth={1.9}
              />
            </button>
          ) : null}
        </div>
        <button
          type="button"
          className="shrink-0 rounded-full border border-[var(--border)] bg-white px-3.5 py-2 text-[13px] font-medium text-[var(--muted)] transition"
          onClick={onClose}
        >
          닫기
        </button>
      </div>

      <div className="mt-3 rounded-[10px] border border-[var(--border)] bg-white px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Search className="h-4 w-4 shrink-0 text-[var(--muted)]" strokeWidth={1.9} />
          <input
            value={customerSearch}
            onChange={(event) => onCustomerSearchChange(event.target.value)}
            placeholder="보호자명, 연락처, 반려동물 이름 검색"
            className="relative -top-[1.5px] min-w-0 flex-1 bg-transparent text-[14px] font-normal leading-6 outline-none placeholder:text-[14px] placeholder:font-normal placeholder:text-[var(--muted)]"
          />
        </div>
      </div>

      {filteredGuardians.length > 0 ? (
        <div className="mt-2.5 rounded-[10px] border border-[var(--border)] bg-white px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-3 text-[14px] font-normal text-[var(--text)]">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                <input
                  type="checkbox"
                  checked={allFilteredGuardiansSelected}
                  onChange={onToggleAllVisibleGuardians}
                  className="h-4 w-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
                />
              </span>
              <span className="inline-flex h-5 items-center">전체선택</span>
            </label>
            <span className="inline-flex h-5 items-center text-[14px] font-normal text-[var(--text)]">선택 {selectedGuardianCount}명</span>
          </div>
        </div>
      ) : null}

      {filteredGuardians.length === 0 ? (
        <div className="mt-3 px-1">
          <p className="text-[15px] font-medium text-[var(--text)]">{emptyTitle}</p>
          <p className="mt-1 text-[13px] leading-5 text-[var(--muted)]">{emptyDescription}</p>
        </div>
      ) : (
        <div className="mt-2.5 overflow-hidden rounded-[10px] border border-[var(--border)] bg-white">
          {filteredGuardians.map((summary, index) => (
            <label
              key={summary.guardian.id}
              className={`flex cursor-pointer items-start gap-3 px-3 py-2.5 transition ${
                selectedGuardianIds.includes(summary.guardian.id) ? "bg-[var(--accent-soft)]" : "hover:bg-[#fcfaf7]"
              } ${index > 0 ? "border-t border-[var(--border)]" : ""}`}
            >
              <div className="mt-[3px] flex w-5 shrink-0 justify-center">
                <input
                  type="checkbox"
                  checked={selectedGuardianIds.includes(summary.guardian.id)}
                  onChange={() => onToggleGuardianSelection(summary.guardian.id)}
                  className="h-4 w-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
                />
              </div>
              <div className="relative -top-[1.5px] min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium tracking-[-0.02em] text-[var(--text)]">{summary.guardian.name}</p>
                <p className="mt-0.5 truncate text-[12.5px] leading-5 text-[var(--muted)]">
                  {summary.guardian.phone} · {summary.pets.map((pet) => pet.name).join(", ") || "등록된 반려동물 없음"}
                </p>
              </div>
            </label>
          ))}
        </div>
      )}

      {filteredDeletedGuardians.length > 0 && isDeletedCustomersOpen ? (
        <div className="mt-3 rounded-[10px] border border-[var(--border)] bg-white px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 flex-1 truncate text-[12px] leading-5 text-[var(--muted)]">
              삭제한 고객은 3일 안에 다시 복구할 수 있어요.
            </p>
            <button
              type="button"
              className="shrink-0 rounded-full bg-[#eef6f3] px-2.5 py-1 text-[11px] font-normal leading-none text-[var(--accent)]"
              onClick={() => onRestoreDeletedGuardians(filteredDeletedGuardians.map((guardian) => guardian.id))}
              disabled={saving}
            >
              전체 복구
            </button>
          </div>

          <div className="mt-2 divide-y divide-[var(--border)]">
            {filteredDeletedGuardians.map((guardian) => (
              <div key={guardian.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium text-[var(--text)]">{guardian.name}</p>
                  <p className="mt-0.5 text-[12px] leading-5 text-[var(--muted)]">{guardian.phone}</p>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-full bg-[#eef6f3] px-2.5 py-1 text-[11px] font-normal leading-none text-[var(--accent)]"
                  onClick={() => onRestoreDeletedGuardians([guardian.id])}
                  disabled={saving}
                >
                  복구
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
