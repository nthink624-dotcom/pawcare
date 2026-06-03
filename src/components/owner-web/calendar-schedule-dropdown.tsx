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
  searchable = false,
  searchPlaceholder = "검색",
  onChange,
}: {
  label: string;
  value: string;
  options: ScheduleDropdownOption[];
  placeholder?: string;
  showMeta?: boolean;
  showSelectedMeta?: boolean;
  showOptionMeta?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
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
      <span className="text-[14px] text-[#64748b]">{label}</span>
      <button
        type="button"
        onClick={() => {
          setOpen((current) => !current);
          if (open) setQuery("");
        }}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-3 rounded-[8px] border bg-white px-3 text-left text-[14px] outline-none transition",
          open ? "border-[#b8c8d8] bg-[#fbfdff]" : "border-[#dbe2ea] hover:border-[#b8c8d8]",
        )}
      >
        <span className="min-w-0">
          <span className={cn("block truncate", selected ? "text-[#111827]" : "text-[#94a3b8]")}>{selected?.label ?? placeholder}</span>
          {showSelectedMeta && selected?.meta ? <span className="mt-0.5 block truncate text-[11px] text-[#64748b]">{selected.meta}</span> : null}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-[#64748b] transition", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-[68px] z-[70] overflow-hidden rounded-[8px] border border-[#dbe2ea] bg-white shadow-[0_18px_42px_rgba(15,23,42,0.16)]">
          {searchable ? (
            <div className="border-b border-[#edf2f7] p-2">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                autoFocus
                className="h-11 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[16px] outline-none transition placeholder:text-[#94a3b8] focus:border-[#b8c8d8]"
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
                    "flex w-full items-center justify-between gap-3 rounded-[7px] px-3 py-2.5 text-left transition",
                    option.value === value ? "bg-[#f8fafc] text-[#111827]" : "text-[#111827] hover:bg-[#f8fafc]",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[14px]">{option.label}</span>
                    {showOptionMeta && option.meta ? <span className="mt-0.5 block truncate text-[12px] text-[#64748b]">{option.meta}</span> : null}
                  </span>
                </button>
              ))
            ) : (
              <p className="px-3 py-6 text-center text-[13px] text-[#64748b]">검색 결과가 없습니다.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
