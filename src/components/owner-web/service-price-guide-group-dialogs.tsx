"use client";

import { FormEvent, ReactNode, useRef, useState } from "react";
import { PencilLine, Plus, X } from "lucide-react";

import { BasilIcon } from "@/components/owner-web/basil-icon";

const RECOMMENDED_BREEDS = [
  "말티즈", "믹스", "말티푸", "푸들", "포메라니안", "비숑", "시츄", "치와와",
  "요크셔테리어", "미니어처푸들", "스피츠", "슈나우저", "비글", "페키니즈",
  "꼬똥드툴레아", "코카스파니엘", "웰시코기", "베들링턴테리어", "빠삐용",
] as const;

function normalizedBreedKey(value: string) {
  return value.replace(/\s+/g, "").trim().toLocaleLowerCase("ko-KR");
}

type DialogShellProps = {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
};

function DialogShell({
  title,
  description,
  children,
  onClose,
}: DialogShellProps) {
  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-[#0f172a]/35 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="service-price-guide-dialog-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div className="w-full max-w-[460px] overflow-hidden rounded-[16px] border border-[#dbe2ea] bg-white shadow-[0_24px_64px_rgba(15,23,42,0.2)]">
        <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2 border-b border-[#edf1f5] px-6 py-4">
          <span aria-hidden="true" />
          <div className="min-w-0 text-center">
            <h2
              id="service-price-guide-dialog-title"
              className="text-[20px] font-semibold leading-7 tracking-[-0.015em] text-[#0f172a]"
            >
              {title}
            </h2>
            {description ? <p className="mt-1 text-[14px] font-normal leading-5 text-[#64748b]">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] text-[#64748b] transition hover:bg-[#f1f5f9] hover:text-[#0f172a]"
            aria-label={`${title} 닫기`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function GroupNameDialog({
  initialName,
  onClose,
  onSave,
}: {
  initialName: string;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(initialName);

  const trimmedName = name.trim().replace(/\s*그룹$/, "").trim();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trimmedName) return;
    onSave(trimmedName);
  }

  return (
    <DialogShell
      title="그룹명 설정"
      description="요금표에 표시할 그룹명을 입력해 주세요."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="px-6 py-5">
        <label className="block text-center text-[14px] font-semibold text-[#334155]">
          그룹명
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
            placeholder="예: 베이직"
            className="mt-2 h-12 w-full rounded-[10px] border border-[#cbd5e1] bg-white px-4 text-center text-[17px] font-semibold text-[#0f172a] outline-none transition placeholder:font-normal placeholder:text-[#94a3b8] focus:border-[var(--accent)] focus:ring-2 focus:ring-[#e8f0f7]"
          />
        </label>
        <p className="mt-2 text-center text-[13px] text-[#64748b]">
          화면에는 ‘{trimmedName || "그룹명"} 그룹’으로 표시됩니다.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-[9px] border border-[#dbe2ea] bg-white text-[15px] font-semibold text-[#334155] transition hover:bg-[#f8fafc]"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={!trimmedName}
            className="h-11 rounded-[9px] bg-[#0f172a] text-[15px] font-semibold text-white transition hover:bg-[#1e293b] disabled:cursor-not-allowed disabled:opacity-40"
          >
            저장
          </button>
        </div>
      </form>
    </DialogShell>
  );
}

export function BreedManagementDialog({
  initialBreeds,
  unavailableBreeds = [],
  onClose,
  onSave,
}: {
  initialBreeds: string[];
  unavailableBreeds?: string[];
  onClose: () => void;
  onSave: (breeds: string[]) => void;
}) {
  const [breeds, setBreeds] = useState<string[]>(initialBreeds);
  const [breedName, setBreedName] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [customBreedMode, setCustomBreedMode] = useState(false);
  const breedInputRef = useRef<HTMLInputElement>(null);

  const trimmedBreedName = breedName.trim();
  const unavailableKeys = new Set(unavailableBreeds.map(normalizedBreedKey));
  const assignedElsewhere = unavailableKeys.has(normalizedBreedKey(trimmedBreedName));
  const duplicateBreed = breeds.some(
    (breed, index) =>
      index !== editingIndex &&
      normalizedBreedKey(breed) === normalizedBreedKey(trimmedBreedName),
  );

  function resetBreedInput() {
    setBreedName("");
    setEditingIndex(null);
    setCustomBreedMode(false);
  }

  function startCustomBreedInput() {
    setBreedName("");
    setEditingIndex(null);
    setCustomBreedMode(true);
    requestAnimationFrame(() => breedInputRef.current?.focus());
  }

  function handleBreedSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trimmedBreedName || duplicateBreed || assignedElsewhere) return;

    if (editingIndex === null) {
      setBreeds((current) => [...current, trimmedBreedName]);
    } else {
      setBreeds((current) =>
        current.map((breed, index) =>
          index === editingIndex ? trimmedBreedName : breed,
        ),
      );
    }
    resetBreedInput();
  }

  return (
    <DialogShell
      title="품종 관리"
      onClose={onClose}
    >
      <div className="px-6 py-5">
        <form onSubmit={handleBreedSubmit}>
          <div>
            <label htmlFor="price-guide-breed-name" className="block text-center text-[16px] font-medium leading-6 text-[#334155]">
            {editingIndex !== null ? "수정할 품종" : customBreedMode ? "기타 품종명" : "추가할 품종"}
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="price-guide-breed-name"
                ref={breedInputRef}
                type="text"
                value={breedName}
                onChange={(event) => setBreedName(event.target.value)}
                autoFocus
                placeholder={customBreedMode ? "원하는 품종 입력" : "품종 검색 또는 입력"}
                list={customBreedMode ? undefined : "price-guide-available-breeds"}
                className="h-11 min-w-0 flex-1 rounded-[9px] border border-[#cbd5e1] bg-white px-3 text-center !text-[16px] !font-normal !leading-6 text-[#0f172a] outline-none transition placeholder:text-[#94a3b8] focus:border-[var(--accent)] focus:ring-2 focus:ring-[#e8f0f7]"
              />
              {editingIndex === null ? (
                <button
                  type="button"
                  onClick={startCustomBreedInput}
                  aria-pressed={customBreedMode}
                  data-price-guide-custom-breed="true"
                  className="inline-flex h-11 min-w-[64px] items-center justify-center rounded-[9px] border border-[#cbd5e1] bg-white px-3 !text-[16px] !font-medium !leading-6 text-[#334155] transition hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
                >
                  기타
                </button>
              ) : null}
              <button
                type="submit"
                disabled={!trimmedBreedName || duplicateBreed || assignedElsewhere}
                className="inline-flex h-11 min-w-[80px] items-center justify-center gap-1.5 rounded-[9px] bg-[#0f172a] px-3 !text-[16px] !font-medium !leading-6 text-white transition hover:bg-[#1e293b] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {editingIndex === null ? (
                  <Plus className="h-4 w-4" strokeWidth={2} />
                ) : (
                  <PencilLine className="h-4 w-4" strokeWidth={2} />
                )}
                {editingIndex === null ? "추가" : "수정"}
              </button>
            </div>
            <datalist id="price-guide-available-breeds">
              {RECOMMENDED_BREEDS.filter((breed) => (
                !unavailableKeys.has(normalizedBreedKey(breed))
                && !breeds.some((current) => normalizedBreedKey(current) === normalizedBreedKey(breed))
              )).map((breed) => <option key={breed} value={breed} />)}
            </datalist>
          </div>
          {duplicateBreed ? (
            <p className="mt-2 text-center text-[13px] font-medium leading-5 text-[#a04455]">
              이미 등록된 품종입니다.
            </p>
          ) : null}
          {assignedElsewhere ? (
            <p className="mt-2 text-center text-[13px] font-medium leading-5 text-[#a04455]">
              다른 분류에 이미 등록된 품종입니다.
            </p>
          ) : null}
          {editingIndex !== null ? (
            <button
              type="button"
              onClick={resetBreedInput}
              className="mx-auto mt-2 block min-h-11 !text-[14px] !font-medium !leading-5 text-[#64748b] underline-offset-4 hover:underline"
            >
              수정 취소
            </button>
          ) : null}
        </form>

        <div className="mt-5 border-t border-[#edf1f5] pt-4">
          <div className="flex items-center justify-center gap-2">
            <p className="text-[16px] font-medium leading-6 text-[#334155]">등록된 품종</p>
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#eef2f7] px-2 text-[12px] font-medium text-[#607080]">
              {breeds.length}
            </span>
          </div>
          {breeds.length > 0 ? (
            <div className="mt-3 max-h-[260px] space-y-2 overflow-y-auto pr-1">
              {breeds.map((breed, index) => (
                <div
                  key={`${breed}-${index}`}
                  className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center rounded-[9px] border border-[#e2e7ed] bg-[#f8fafc] px-2 py-2"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setBreedName(breed);
                      setEditingIndex(index);
                      setCustomBreedMode(false);
                    }}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-[7px] text-[#64748b] transition hover:bg-white hover:text-[var(--accent)]"
                    aria-label={`${breed} 수정`}
                  >
                    <PencilLine className="h-4 w-4" strokeWidth={1.9} />
                  </button>
                  <span className="min-w-0 truncate px-2 text-center text-[16px] font-medium leading-6 text-[#1e293b]">
                    {breed}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setBreeds((current) =>
                        current.filter((_, breedIndex) => breedIndex !== index),
                      );
                      if (editingIndex === index) resetBreedInput();
                    }}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-[7px] text-[#94a3b8] transition hover:bg-white hover:text-[#a04455]"
                    aria-label={`${breed} 삭제`}
                  >
                    <BasilIcon name="trash" className="h-5 w-5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-[9px] border border-dashed border-[#dbe2ea] bg-[#fafbfc] px-4 py-6 text-center text-[14px] text-[#64748b]">
              등록된 품종이 없습니다. 위 입력칸에서 한 품종씩 추가해 주세요.
            </div>
          )}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-[9px] border border-[#dbe2ea] bg-white !text-[16px] !font-medium !leading-6 text-[#334155] transition hover:bg-[#f8fafc]"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => onSave(breeds)}
            className="h-11 rounded-[9px] bg-[#0f172a] !text-[16px] !font-medium !leading-6 text-white transition hover:bg-[#1e293b]"
          >
            완료
          </button>
        </div>
      </div>
    </DialogShell>
  );
}
