"use client";

import { useMemo, useState } from "react";

import { calendarBookings } from "@/components/owner-web/owner-web-data";
import {
  Chip,
  DateToolbarBadge,
  DetailBlock,
  DetailPanel,
  EmptyCalendarHint,
  GhostButton,
  SelectLike,
  ToolbarRow,
  WebSectionTitle,
  WebSurface,
} from "@/components/owner-web/owner-web-ui";

const viewOptions = ["일", "주", "월"] as const;
const staffOptions = ["전체", "원장", "서브"] as const;
const hours = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
const weekDays = ["월", "화", "수", "목", "금", "토", "일"] as const;

export default function CalendarManagementScreen() {
  const [view, setView] = useState<(typeof viewOptions)[number]>("주");
  const [staff, setStaff] = useState<(typeof staffOptions)[number]>("전체");
  const [selectedBookingId, setSelectedBookingId] = useState(calendarBookings[0]?.id ?? "");

  const filteredBookings = useMemo(
    () => (staff === "전체" ? calendarBookings : calendarBookings.filter((item) => item.staff === staff)),
    [staff],
  );

  const selectedBooking = filteredBookings.find((item) => item.id === selectedBookingId) ?? filteredBookings[0] ?? calendarBookings[0];

  return (
    <div className="space-y-6">
      <WebSectionTitle
        title="캘린더"
        description="일/주/월 전환, 담당자 필터, 시간표 위 예약 블록과 우측 상세 패널을 함께 보는 웹 오너 화면입니다."
        action={<GhostButton label="예약 추가" />}
      />

      <ToolbarRow className="justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {viewOptions.map((option) => (
            <Chip key={option} label={option} active={view === option} onClick={() => setView(option)} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {staffOptions.map((option) => (
            <Chip key={option} label={option} active={staff === option} tone="soft" onClick={() => setStaff(option)} />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <DateToolbarBadge />
          <SelectLike label="담당자 필터" />
        </div>
      </ToolbarRow>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <WebSurface className="overflow-hidden p-4">
          {view === "주" ? (
            <div className="grid grid-cols-[72px_repeat(7,minmax(0,1fr))]">
              <div className="border-r border-[#efe8e2] pr-3">
                <div className="h-12" />
                {hours.map((hour) => (
                  <div key={hour} className="flex h-20 items-start text-[12px] font-medium text-[#8d867e]">
                    {hour}
                  </div>
                ))}
              </div>
              {weekDays.map((day) => (
                <div key={day} className="relative border-r border-[#efe8e2] last:border-r-0">
                  <div className="sticky top-0 z-10 h-12 border-b border-[#efe8e2] bg-white px-3 py-3 text-[14px] font-semibold text-[#17211f]">
                    {day}
                  </div>
                  {hours.map((hour) => (
                    <div key={`${day}-${hour}`} className="h-20 border-b border-[#f4ede7]" />
                  ))}
                  {filteredBookings
                    .filter((booking) => booking.day === day)
                    .map((booking) => (
                      <button
                        key={booking.id}
                        type="button"
                        onClick={() => setSelectedBookingId(booking.id)}
                        className={`absolute w-[44%] rounded-[18px] border px-3 py-2 text-left shadow-[0_10px_18px_rgba(47,120,102,0.12)] ${
                          booking.id === selectedBookingId ? "border-[#2f7866] bg-[#2f7866] text-white" : "border-[#d5e7df] bg-[#eef8f4] text-[#1f5043]"
                        }`}
                        style={{
                          left: booking.lane === 0 ? 10 : "52%",
                          top: 58 + (booking.start - 9) * 80,
                          height: booking.duration * 80 - 8,
                        }}
                      >
                        <p className="text-[12px] font-semibold">{booking.customer}</p>
                        <p className={`mt-1 text-[11px] ${booking.id === selectedBookingId ? "text-white/80" : "text-[#5f756e]"}`}>
                          {booking.pet} · {booking.service}
                        </p>
                      </button>
                    ))}
                </div>
              ))}
            </div>
          ) : view === "일" ? (
            <div className="space-y-3">
              <div className="rounded-[18px] border border-[#e6ddd6] bg-[#fbfaf8] px-4 py-3 text-[15px] font-semibold text-[#17211f]">오늘 시간표</div>
              <EmptyCalendarHint />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 12 }).map((_, index) => (
                <div key={index} className="rounded-[18px] border border-[#ece4dd] bg-[#fcfaf8] p-4">
                  <p className="text-[13px] font-medium text-[#8f877d]">{index + 1}일</p>
                  <p className="mt-3 text-[22px] font-semibold tracking-[-0.03em] text-[#17211f]">{(index % 4) + 2}건</p>
                  <p className="mt-2 text-[12px] text-[#756e66]">오전 2건 / 오후 {(index % 3) + 1}건</p>
                </div>
              ))}
            </div>
          )}
        </WebSurface>

        <DetailPanel
          title={selectedBooking ? `${selectedBooking.customer} · ${selectedBooking.pet}` : "예약 없음"}
          subtitle={selectedBooking ? `${selectedBooking.day} ${selectedBooking.start}:00 / ${selectedBooking.service}` : "선택한 예약이 없어요"}
        >
          <DetailBlock label="담당자" value={selectedBooking?.staff ?? "-"} description="클릭한 예약 블록의 담당자와 진행 상태를 우측 패널에서 바로 확인합니다." />
          <DetailBlock label="서비스" value={selectedBooking?.service ?? "-"} description="서비스, 메모, 시간 이동, 빠른 상태 변경이 이어지는 구조를 가정했습니다." />
          <DetailBlock label="고객 정보" value={selectedBooking ? `${selectedBooking.customer} / ${selectedBooking.pet}` : "-"} description="전화, 알림톡, 고객 상세 진입 액션이 이 패널에 붙는 구조입니다." />
          <div className="grid gap-2 sm:grid-cols-2">
            <GhostButton label="시간 이동" />
            <GhostButton label="예약 상세 열기" />
          </div>
        </DetailPanel>
      </div>
    </div>
  );
}
