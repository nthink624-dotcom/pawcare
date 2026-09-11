"use client";

import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";

import { OWNER_WEB_PRIMARY_ACTION_BUTTON_CLASS } from "@/components/owner-web/owner-web-action-button-styles";
import { StableAvatar } from "@/components/owner-web/stable-avatar";
import { SoftSelect } from "@/components/owner-web/owner-web-ui";
import { cn } from "@/lib/utils";
import type { OwnerWebStaffColumn } from "@/components/owner-web/owner-web-staff-data";
import { isShopClosedOnDate } from "@/lib/availability";
import { addDate, currentDateInTimeZone } from "@/lib/utils";
import type { BootstrapPayload } from "@/types/domain";

type StaffFilter = "전체 직원" | string;

function formatSchedulePickerDateLabel(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return `${String(year).slice(-2)}년 ${String(month).padStart(2, "0")}월 ${String(day).padStart(2, "0")}일`;
}

function formatSchedulePickerRelativeLabel(date: string, shop?: BootstrapPayload["shop"]) {
  if (shop && isShopClosedOnDate(shop, date)) return "휴무일";
  const today = currentDateInTimeZone();
  if (date === today) return "오늘";
  if (date === addDate(today, 1)) return "내일";
  if (date === addDate(today, 2)) return "모레";
  return formatSchedulePickerDateLabel(date);
}

export function CalendarToolbar({
  shop,
  selectedDate,
  staff,
  visibleStaff,
  onDateChange,
  onStaffChange,
  onAddSchedule,
}: {
  shop: BootstrapPayload["shop"];
  selectedDate: string;
  staff: StaffFilter;
  visibleStaff: OwnerWebStaffColumn[];
  onDateChange: (date: string) => void;
  onStaffChange: (staff: StaffFilter) => void;
  onAddSchedule: () => void;
}) {
  const singleStaff = visibleStaff.length <= 1;
  const dateStep = 1;
  const selectedStaff = singleStaff
    ? visibleStaff[0] ?? null
    : staff === "전체 직원"
      ? null
      : visibleStaff.find((item) => item.key === staff) ?? null;
  const staffLabel = selectedStaff?.name ?? (singleStaff ? "담당 없음" : "전체 직원");

  return (
    <div className="border-b border-[#e4eaf1] bg-white px-4 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1 rounded-[10px] border border-[#e1e7ef] bg-[#f8fafc] p-1">
          <button
            type="button"
            onClick={() => onDateChange(addDate(selectedDate, -dateStep))}
            className="inline-flex h-11 w-11 items-center justify-center rounded-[7px] text-[#64748b] transition hover:bg-white hover:text-[#0f172a] hover:shadow-[0_1px_3px_rgba(15,23,42,0.08)]"
            aria-label="이전 날짜"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onDateChange(currentDateInTimeZone())}
            className="inline-flex h-8 min-w-[158px] items-center justify-center rounded-[7px] px-3 text-[16px] font-semibold tracking-[-0.015em] text-[#172033] transition hover:bg-white"
          >
            {formatSchedulePickerRelativeLabel(selectedDate, shop)}
          </button>
          <button
            type="button"
            onClick={() => onDateChange(addDate(selectedDate, dateStep))}
            className="inline-flex h-11 w-11 items-center justify-center rounded-[7px] text-[#64748b] transition hover:bg-white hover:text-[#0f172a] hover:shadow-[0_1px_3px_rgba(15,23,42,0.08)]"
            aria-label="다음 날짜"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-2.5">
          {singleStaff ? (
            <div className="inline-flex min-h-11 w-[196px] items-center justify-between gap-2 rounded-[9px] border border-[#dfe6ee] bg-white px-3 text-[#0f172a]">
              <span className="text-[14px] font-medium leading-5 tracking-[-0.005em] text-[#64748b]">담당</span>
              <span className="flex min-w-0 items-center gap-2">
                {selectedStaff ? (
                  <StableAvatar
                    identity={selectedStaff.key}
                    name={selectedStaff.name}
                    imageUrl={selectedStaff.profileImageUrl}
                    imageAssetId={selectedStaff.profileImageAssetIds?.[0]}
                    size="sm"
                    className="h-8 w-8"
                  />
                ) : null}
                <span className="truncate text-[16px] font-medium leading-6 tracking-[-0.005em]">{staffLabel}</span>
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2" data-calendar-staff-filter="true">
              {selectedStaff ? (
                <StableAvatar
                  identity={selectedStaff.key}
                  name={selectedStaff.name}
                  imageUrl={selectedStaff.profileImageUrl}
                  imageAssetId={selectedStaff.profileImageAssetIds?.[0]}
                  size="sm"
                  className="h-8 w-8"
                />
              ) : null}
              <SoftSelect<StaffFilter>
                label="담당"
                value={staff}
                onChange={onStaffChange}
                options={[
                  { value: "전체 직원", label: "전체 직원" },
                  ...visibleStaff.map((option) => ({ value: option.key, label: option.name })),
                ]}
                className="w-[164px]"
                buttonClassName="!h-11"
                labelClassName="text-[14px] font-medium leading-5 tracking-[-0.005em] text-[#64748b]"
                valueClassName="text-[16px] font-medium leading-6 tracking-[-0.005em] text-[#111827]"
                menuClassName="w-[164px] min-w-0"
              />
            </div>
          )}
          <button
            type="button"
            onClick={onAddSchedule}
            className={cn(
              OWNER_WEB_PRIMARY_ACTION_BUTTON_CLASS,
              "!bg-[#2563eb] !text-[16px] !font-medium !leading-6 !tracking-[-0.005em] hover:!bg-[#1d4ed8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2",
            )}
          >
            <CalendarPlus className="h-4 w-4" aria-hidden="true" />
            예약 추가
          </button>
        </div>
      </div>
    </div>
  );
}
