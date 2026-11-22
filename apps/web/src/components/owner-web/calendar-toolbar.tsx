"use client";

import { IconCalendarPlus as CalendarPlus, IconChevronLeft as ChevronLeft, IconChevronRight as ChevronRight } from "@tabler/icons-react";

import { OWNER_WEB_COMPACT_PRIMARY_ACTION_BUTTON_CLASS } from "@/components/owner-web/owner-web-action-button-styles";
import { StableAvatar } from "@/components/owner-web/stable-avatar";
import { MemberSelector, type Member } from "@/components/ui/member-selector";
import { getStaffWorkWindow } from "@/components/owner-web/calendar-staff-lane-columns";
import { getScheduleStaffIdentityTone } from "@/lib/staff-chip-colors";
import { cn } from "@/lib/utils";
import type { OwnerWebStaffColumn, OwnerWebStaffMember } from "@/components/owner-web/owner-web-staff-data";
import { isShopClosedOnDate } from "@/lib/availability";
import { addDate, currentDateInTimeZone } from "@/lib/utils";
import type { BootstrapPayload } from "@/types/domain";

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
  selectedStaffKeys,
  visibleStaff,
  staffMembers,
  staffScheduleOverrides,
  onDateChange,
  onStaffChange,
  onAddSchedule,
}: {
  shop: BootstrapPayload["shop"];
  selectedDate: string;
  selectedStaffKeys: string[];
  visibleStaff: OwnerWebStaffColumn[];
  staffMembers: OwnerWebStaffMember[];
  staffScheduleOverrides: BootstrapPayload["staffScheduleOverrides"];
  onDateChange: (date: string) => void;
  onStaffChange: (staff: string[]) => void;
  onAddSchedule: () => void;
}) {
  const singleStaff = visibleStaff.length <= 1;
  const dateStep = 1;
  const shopClosed = isShopClosedOnDate(shop, selectedDate);
  const members: Member[] = visibleStaff.map((member) => {
    const source = staffMembers.find((item) => item.id === member.key);
    return {
      id: member.key,
      name: member.name,
      color: getScheduleStaffIdentityTone(member.key, member.chipColorIndex).color,
      workStatus: source ? !shopClosed && getStaffWorkWindow(source, staffScheduleOverrides, selectedDate) ? "working" : "off" : undefined,
    };
  });

  return (
    <div className="border-b border-[#e8edf3] bg-white px-4 py-2.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onDateChange(addDate(selectedDate, -dateStep))}
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-[8px] border border-transparent text-[#64748b] transition hover:border-[#e1e7ef] hover:bg-[#f8fafc] hover:text-[#0f172a]"
            aria-label="이전 날짜"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onDateChange(currentDateInTimeZone())}
            className="relative inline-flex h-10 min-w-[158px] items-center justify-center rounded-[8px] px-3 text-[16px] font-semibold tracking-[-0.015em] text-[#172033] transition hover:bg-[#f8fafc]"
          >
            {formatSchedulePickerRelativeLabel(selectedDate, shop)}
          </button>
          <button
            type="button"
            onClick={() => onDateChange(addDate(selectedDate, dateStep))}
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-[8px] border border-transparent text-[#64748b] transition hover:border-[#e1e7ef] hover:bg-[#f8fafc] hover:text-[#0f172a]"
            aria-label="다음 날짜"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex w-full min-w-0 items-center justify-end gap-2 sm:ml-auto sm:w-auto">
          {visibleStaff.length ? <div className="w-[136px] min-w-0 shrink" data-calendar-staff-filter="true">
            <MemberSelector
              allLabel={singleStaff ? undefined : "전체 직원"}
              members={members}
              selected={selectedStaffKeys}
              onChange={onStaffChange}
              className="w-full"
              renderAvatar={(member) => {
                const option = visibleStaff.find((item) => item.key === member.id);
                return <StableAvatar
                  identity={member.id} name={member.name}
                  imageUrl={option?.profileImageUrl} imageUrls={option?.profileImageUrls}
                  imageAssetIds={option?.profileImageAssetIds}
                  profileImageFallbackKey={option?.profileImageFallbackKey}
                  className="h-full w-full"
                />;
              }}
            />
          </div> : <span className="text-[14px] text-[#64748b]">담당 없음</span>}
          <button
            type="button"
            data-owner-control-size="content"
            onClick={onAddSchedule}
            className={cn(
              OWNER_WEB_COMPACT_PRIMARY_ACTION_BUTTON_CLASS,
              "h-11 min-w-[110px] shrink-0 px-3 text-[15px] sm:min-w-[136px] sm:px-5 sm:text-[16px] focus-visible:ring-2 focus-visible:ring-[#1677ff] focus-visible:ring-offset-2",
            )}
          >
            <CalendarPlus className="h-[18px] w-[18px]" aria-hidden="true" />
            예약 추가
          </button>
        </div>
      </div>
    </div>
  );
}
