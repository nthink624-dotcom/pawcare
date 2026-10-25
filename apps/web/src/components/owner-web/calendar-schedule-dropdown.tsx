"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

export type ScheduleDropdownOption = {
  value: string;
  label: string;
  meta?: string;
  searchText?: string;
};

export function ScheduleDropdown({
  label,
  value,
  options,
  placeholder = "선택",
  showMeta = true,
  showSelectedMeta = showMeta,
  showOptionMeta = showMeta,
  inlineOptionMeta = false,
  searchable = false,
  searchPlaceholder = "검색",
  focusClassName,
  open: controlledOpen,
  onOpenChange,
  onChange,
}: {
  label: string;
  value: string;
  options: ScheduleDropdownOption[];
  placeholder?: string;
  showMeta?: boolean;
  showSelectedMeta?: boolean;
  showOptionMeta?: boolean;
  inlineOptionMeta?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Limits an alternate focus treatment to a parent surface such as the booking dialog. */
  focusClassName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onChange: (value: string) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.value === value);
  const normalizedQuery = query.trim().toLowerCase();
  const queryDigits = query.replace(/\D/g, "");
  const filteredOptions = normalizedQuery
    ? options.filter((option) => {
        const haystack = `${option.label} ${option.meta ?? ""} ${option.searchText ?? ""}`.toLowerCase();
        const haystackDigits = haystack.replace(/\D/g, "");
        return haystack.includes(normalizedQuery) || Boolean(queryDigits && haystackDigits.includes(queryDigits));
      })
    : options;

  return (
    <div className="relative space-y-1.5">
      <span className="text-[14px] font-medium leading-5 text-[#64748b]">{label}</span>
      <button
        type="button"
        onClick={() => {
          const nextOpen = !open;
          setOpen(nextOpen);
          if (!nextOpen) setQuery("");
        }}
        className={cn(
          "flex min-h-11 w-full items-center justify-between gap-3 rounded-[8px] border bg-white px-3 py-2 text-left text-[16px] font-medium leading-6 outline-none transition",
          open ? "border-[#b8c8d8] bg-[#fbfdff]" : "border-[#dbe2ea] hover:border-[#b8c8d8]",
          focusClassName,
        )}
      >
        <span className="min-w-0">
          <span className={cn("block whitespace-normal break-words [overflow-wrap:anywhere]", selected ? "text-[#111827]" : "text-[#94a3b8]")}>{selected?.label ?? placeholder}</span>
          {showSelectedMeta && selected?.meta ? <span className="mt-0.5 block whitespace-normal break-words text-[13px] font-normal leading-5 text-[#64748b] [overflow-wrap:anywhere]">{selected.meta}</span> : null}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-[#64748b] transition", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.375rem)] z-[70] overflow-hidden rounded-[8px] border border-[#dbe2ea] bg-white shadow-[0_18px_42px_rgba(15,23,42,0.16)]">
          {searchable ? (
            <div className="border-b border-[#edf2f7] p-2">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                autoFocus
                className={cn(
                  "h-11 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[16px] font-normal leading-6 outline-none transition placeholder:text-[#94a3b8] focus:border-[#b8c8d8]",
                  focusClassName,
                )}
                placeholder={searchPlaceholder}
              />
            </div>
          ) : null}
          <div className="max-h-[220px] overflow-y-auto p-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={cn(
                    "flex min-h-11 w-full items-center justify-between gap-3 rounded-[7px] px-3 py-2.5 text-left transition",
                    option.value === value ? "bg-[#f8fafc] text-[#111827]" : "text-[#111827] hover:bg-[#f8fafc]",
                  )}
                >
                  <span className={cn("min-w-0", inlineOptionMeta ? "flex flex-1 items-baseline gap-2 overflow-hidden" : "")}>
                    <span className={cn("text-[14px] font-medium", inlineOptionMeta ? "shrink-0 truncate leading-5" : "block whitespace-normal break-words leading-5 [overflow-wrap:anywhere]")}>{option.label}</span>
                    {showOptionMeta && option.meta ? (
                      <span className={cn("text-[12px] font-medium text-[#64748b]", inlineOptionMeta ? "min-w-0 truncate leading-5" : "mt-0.5 block whitespace-normal break-words leading-[18px] [overflow-wrap:anywhere]")}>{option.meta}</span>
                    ) : null}
                  </span>
                </button>
              ))
            ) : (
              <p className="px-3 py-6 text-center text-[13px] font-normal leading-5 text-[#64748b]">검색 결과가 없습니다.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
