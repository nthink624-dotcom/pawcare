"use client";

import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { OwnerMediaUploadPanel } from "@/components/owner-web/media-upload-panel";
import { ToolbarRow, WebSurface } from "@/components/owner-web/owner-web-ui";
import { getWrapIndicatorClass, type StatusIndicatorTone } from "@/components/owner-web/status-indicators";
import { cn, currentDateInTimeZone } from "@/lib/utils";
import type { AppointmentStatus, BootstrapPayload } from "@/types/domain";

type GroomingCalendarRecord = {
  id: string;
  guardianId: string;
  petId: string;
  appointmentId: string | null;
  pet: string;
  customer: string;
  service: string;
  memo: string;
  next: string;
  date: string;
};

type ReservationRow = {
  id: string;
  guardianId: string;
  petId: string;
  pet: string;
  customer: string;
  service: string;
  status: string;
  note: string;
  date: string;
  time: string;
  staff: string;
  phone: string;
  channel: string;
};

type DayItem = {
  id: string;
  type: "record" | "reservation";
  guardianId: string;
  petId: string;
  appointmentId?: string | null;
  groomingRecordId?: string | null;
  pet: string;
  customer: string;
  service: string;
  status: string;
  note: string;
  date: string;
  next?: string;
  time?: string;
  staff?: string;
  phone?: string;
  channel?: string;
};

const weekdayLabels = ["일", "월", "화", "수", "목", "금", "토"];

const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  pending: "승인 대기",
  confirmed: "확정",
  in_progress: "진행 중",
  almost_done: "픽업 준비",
  completed: "완료",
  cancelled: "취소",
  rejected: "거절",
  noshow: "노쇼",
};

function buildBootstrapLookup(data: BootstrapPayload) {
  return {
    guardianById: new Map(data.guardians.map((guardian) => [guardian.id, guardian])),
    petById: new Map(data.pets.map((pet) => [pet.id, pet])),
    serviceById: new Map(data.services.map((service) => [service.id, service])),
  };
}

function buildReservationsFromBootstrap(data: BootstrapPayload): ReservationRow[] {
  const { guardianById, petById, serviceById } = buildBootstrapLookup(data);

  return data.appointments.map((appointment) => {
    const guardian = guardianById.get(appointment.guardian_id);
    const pet = petById.get(appointment.pet_id);
    const service = serviceById.get(appointment.service_id);

    return {
      id: appointment.id,
      guardianId: appointment.guardian_id,
      petId: appointment.pet_id,
      pet: pet?.name ?? "반려동물 미등록",
      customer: guardian?.name ?? "보호자 미등록",
      service: service?.name ?? "서비스 미등록",
      status: appointmentStatusLabels[appointment.status],
      note: appointment.memo?.trim() || "요청 메모가 없습니다.",
      date: appointment.appointment_date,
      time: appointment.appointment_time,
      staff: "담당 미배정",
      phone: guardian?.phone ?? "",
      channel: appointment.source === "customer" ? "고객 예약" : "오너 등록",
    };
  });
}

function buildRecordsFromBootstrap(data: BootstrapPayload): GroomingCalendarRecord[] {
  const { guardianById, petById, serviceById } = buildBootstrapLookup(data);

  return data.groomingRecords.map((record) => {
    const guardian = guardianById.get(record.guardian_id);
    const pet = petById.get(record.pet_id);
    const service = serviceById.get(record.service_id);
    const memoParts = [record.style_notes, record.memo].map((item) => item?.trim()).filter(Boolean);

    return {
      id: record.id,
      guardianId: record.guardian_id,
      petId: record.pet_id,
      appointmentId: record.appointment_id,
      pet: pet?.name ?? "반려동물 미등록",
      customer: guardian?.name ?? "보호자 미등록",
      service: service?.name ?? "서비스 미등록",
      memo: memoParts.join(" · ") || "작성된 메모가 없습니다.",
      next: "",
      date: record.groomed_at.slice(0, 10),
    };
  });
}

function normalizeRecordDate(date: string) {
  return date.replaceAll(".", "-");
}

function formatMonthLabel(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  return `${parsed.getFullYear()}년 ${parsed.getMonth() + 1}월`;
}

function formatShortDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  return `${parsed.getMonth() + 1}.${parsed.getDate()}`;
}

function formatFullDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  return `${parsed.getFullYear()}년 ${parsed.getMonth() + 1}월 ${parsed.getDate()}일 ${weekdayLabels[parsed.getDay()]}요일`;
}

function getMonthDates(monthAnchor: string) {
  const parsed = new Date(`${monthAnchor}T00:00:00`);
  const year = parsed.getFullYear();
  const month = parsed.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const dates: Array<string | null> = [];

  for (let index = 0; index < firstDay.getDay(); index += 1) dates.push(null);
  for (let day = 1; day <= lastDay.getDate(); day += 1) dates.push(new Date(year, month, day).toLocaleDateString("en-CA"));
  while (dates.length % 7 !== 0) dates.push(null);

  return dates;
}

function moveMonth(date: string, offset: number) {
  const parsed = new Date(`${date}T00:00:00`);
  parsed.setMonth(parsed.getMonth() + offset);
  return parsed.toLocaleDateString("en-CA");
}

function buildDayItems(records: GroomingCalendarRecord[], reservations: ReservationRow[], date: string): DayItem[] {
  const recordItems: DayItem[] = records
    .filter((record) => normalizeRecordDate(record.date) === date)
    .map((record) => ({
      id: record.id,
      type: "record" as const,
      guardianId: record.guardianId,
      petId: record.petId,
      appointmentId: record.appointmentId,
      groomingRecordId: record.id,
      pet: record.pet,
      customer: record.customer,
      service: record.service,
      status: "기록 완료",
      note: record.memo,
      next: record.next,
      date,
    }));

  const reservationItems: DayItem[] = reservations
    .filter((reservation) => reservation.date === date)
    .map((reservation) => ({
      id: reservation.id,
      type: "reservation" as const,
      guardianId: reservation.guardianId,
      petId: reservation.petId,
      appointmentId: reservation.id,
      groomingRecordId: null,
      pet: reservation.pet,
      customer: reservation.customer,
      service: reservation.service,
      status: reservation.status,
      note: reservation.note,
      time: reservation.time,
      staff: reservation.staff,
      phone: reservation.phone,
      channel: reservation.channel,
      date,
    }));

  return [...reservationItems, ...recordItems].sort((first, second) => (first.time ?? "99:99").localeCompare(second.time ?? "99:99"));
}

function getRecordTone(item: DayItem) {
  if (item.type === "record") return "border-[#dbe2ea]";
  if (item.status === "승인 대기") return "border-[#ead28e]";
  return "border-[#c8ded6]";
}

function getBadgeTone(item: DayItem) {
  if (item.type === "record") return "text-[#475569]";
  if (item.status === "승인 대기") return "text-[#8a5a00]";
  return "text-[#1f6b5b]";
}

function getTimeTone(item: DayItem) {
  if (item.type === "record") return "text-[#475569]";
  if (item.status === "승인 대기") return "text-[#8a5a00]";
  return "text-[#1f6b5b]";
}

function getStatusAccent(item: DayItem): StatusIndicatorTone {
  if (item.type === "record") return "slate";
  if (item.status === "승인 대기") return "amber";
  return "teal";
}

function getCalendarCellTone(active: boolean, isToday: boolean, hasItems: boolean) {
  if (active) return "border-[#2f7866] bg-white shadow-[inset_3px_0_0_#2f7866,0_8px_20px_rgba(15,23,42,0.08)]";
  if (isToday) return "border-[#d6e8e1] bg-white shadow-[0_2px_8px_rgba(15,23,42,0.035)]";
  if (hasItems) return "border-white bg-[linear-gradient(to_bottom,#fff_0%,#fff_62%,#fbfefd_100%)] shadow-[0_1px_4px_rgba(15,23,42,0.035)] hover:border-[#d5e7df] hover:shadow-[0_6px_16px_rgba(15,23,42,0.055)]";
  return "border-white bg-[linear-gradient(to_bottom,#fff_0%,#fff_72%,#fcfefd_100%)] shadow-[0_1px_4px_rgba(15,23,42,0.032)] hover:border-[#dbe8e2] hover:bg-white hover:shadow-[0_5px_14px_rgba(15,23,42,0.05)]";
}

type CalendarStatusIndicator = {
  key: "pending" | "confirmed" | "changed" | "cancelled";
  label: string;
  className: string;
};

const calendarStatusIndicators: CalendarStatusIndicator[] = [
  { key: "confirmed", label: "확정", className: "bg-[#2f7866]" },
  { key: "pending", label: "승인대기", className: "bg-[#d8a634]" },
  { key: "cancelled", label: "취소", className: "bg-[#9f3a3a]" },
  { key: "changed", label: "변경", className: "bg-[#b7791f]" },
];

function getCalendarStatusCounts(items: DayItem[]) {
  const reservationItems = items.filter((item) => item.type === "reservation");

  return {
    pending: reservationItems.filter((item) => item.status.includes("승인")).length,
    confirmed: reservationItems.filter((item) => item.status.includes("확정")).length,
    changed: reservationItems.filter((item) => item.status.includes("변경")).length,
    cancelled: reservationItems.filter((item) => item.status.includes("취소")).length,
  };
}

export default function GroomingManagementScreen({ initialData }: { initialData: BootstrapPayload }) {
  const records = useMemo(() => buildRecordsFromBootstrap(initialData), [initialData]);
  const initialReservations = useMemo(() => buildReservationsFromBootstrap(initialData), [initialData]);
  const [reservations, setReservations] = useState<ReservationRow[]>(() => initialReservations);
  const [selectedDate, setSelectedDate] = useState(currentDateInTimeZone());
  const [monthAnchor, setMonthAnchor] = useState(currentDateInTimeZone());
  const [query, setQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<DayItem | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setReservations(initialReservations);
      setSelectedItem((current) => {
        if (!current) return null;
        const exists = [...initialReservations, ...records].some((item) => item.id === current.id);
        return exists ? current : null;
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [initialReservations, records]);

  const filteredRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return records.filter((record) => {
      const haystack = [record.pet, record.customer, record.date, record.service, record.memo, record.next].join(" ").toLowerCase();
      const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
      return matchesQuery;
    });
  }, [query, records]);

  const monthDates = useMemo(() => getMonthDates(monthAnchor), [monthAnchor]);
  const dayItemsByDate = useMemo(() => {
    const map = new Map<string, DayItem[]>();
    for (const date of monthDates) {
      if (!date) continue;
      map.set(date, buildDayItems(filteredRecords, reservations, date));
    }
    return map;
  }, [filteredRecords, monthDates, reservations]);
  const selectedItems = dayItemsByDate.get(selectedDate) ?? [];

  function confirmReservation(reservationId: string) {
    setReservations((current) =>
      current.map((reservation) =>
        reservation.id === reservationId
          ? {
              ...reservation,
              status: "확정",
            }
          : reservation,
      ),
    );
    setSelectedItem((current) =>
      current?.id === reservationId && current.type === "reservation"
        ? {
            ...current,
            status: "확정",
          }
        : current,
    );
  }

  function openDate(date: string) {
    setSelectedDate(date);
    setSelectedItem(null);
  }

  function openItem(item: DayItem) {
    setSelectedDate(item.date);
    setSelectedItem(item);
  }

  return (
    <div className="space-y-3">
      <ToolbarRow>
        <label className="flex h-9 min-w-[240px] flex-1 items-center gap-3 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[#64748b]">
          <Search className="h-4 w-4 text-[#94a3b8]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full bg-transparent text-[14px] text-[#111827] outline-none placeholder:text-[#94a3b8]"
            placeholder="반려동물명, 보호자명, 메모 검색"
          />
        </label>
      </ToolbarRow>

      <WebSurface className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] px-5 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMonthAnchor((current) => moveMonth(current, -1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#dbe2ea] text-[#64748b] hover:bg-[#f8fafc]"
              aria-label="이전 달"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="min-w-[130px] text-center text-[18px] font-medium text-[#111827]">{formatMonthLabel(monthAnchor)}</p>
            <button
              type="button"
              onClick={() => setMonthAnchor((current) => moveMonth(current, 1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#dbe2ea] text-[#64748b] hover:bg-[#f8fafc]"
              aria-label="다음 달"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                const today = currentDateInTimeZone();
                setSelectedDate(today);
                setMonthAnchor(today);
                setSelectedItem(null);
              }}
              className="ml-1 h-8 rounded-[8px] border border-[#dbe2ea] px-3 text-[13px] text-[#334155] hover:bg-[#f8fafc]"
            >
              오늘
            </button>
          </div>
          <p className="text-[13px] text-[#64748b]">선택한 날짜의 예약과 기록을 오른쪽에서 확인합니다.</p>
        </div>

        <div className="grid min-h-0 xl:grid-cols-[minmax(0,1fr)_392px]">
          <section className="min-w-0 bg-[#f1f5f9] xl:border-r xl:border-[#edf2f7]">
            <div className="grid grid-cols-7 border-b border-[#e8eef5] bg-[#fbfcfd]">
              {weekdayLabels.map((label) => (
                <div key={label} className="px-2 py-2 text-center text-[13px] font-medium text-[#64748b]">
                  {label}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-px bg-[#eef2f7] p-px">
              {monthDates.map((date, index) => {
                const items = date ? dayItemsByDate.get(date) ?? [] : [];
                const recordCount = items.filter((item) => item.type === "record").length;
                const reservationCount = items.filter((item) => item.type === "reservation").length;
                const active = date === selectedDate;
                const hasItems = items.length > 0;
                const isToday = date === currentDateInTimeZone();
                const statusCounts = getCalendarStatusCounts(items);
                const visibleStatuses = calendarStatusIndicators.filter((indicator) => statusCounts[indicator.key] > 0);

                if (!date) {
                  return <div key={`empty-${index}`} className="min-h-[82px] rounded-[8px] bg-[#fdfefe]" />;
                }

                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => openDate(date)}
                    className={cn(
                      "relative flex min-h-[90px] flex-col justify-between rounded-[8px] border px-3 py-2.5 text-left transition duration-150",
                      getCalendarCellTone(active, isToday, hasItems),
                    )}
                    aria-label={`${date} 예약 ${reservationCount}건`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={cn(
                          "leading-5",
                          isToday
                            ? "text-[15px] font-bold text-[#1f6b5b]"
                            : active
                              ? "text-[13px] font-bold text-[#1f6b5b]"
                              : hasItems
                                ? "text-[13px] font-medium text-[#111827]"
                                : "text-[13px] font-medium text-[#111827]",
                        )}
                      >
                        {Number(date.slice(-2))}
                      </span>
                      {reservationCount > 0 ? (
                        <span className="pt-0.5 text-[11px] font-medium leading-4 text-[#64748b]">
                          {reservationCount}건
                        </span>
                      ) : null}
                    </div>
                    {visibleStatuses.length > 0 || recordCount > 0 ? (
                      <div className="flex items-end justify-between gap-2">
                        <div className="flex h-5 w-3 flex-col-reverse items-start justify-start gap-0.5">
                          {visibleStatuses.map((indicator) => (
                            <span
                              key={indicator.key}
                              className={cn("h-[3px] w-3 rounded-full", indicator.className)}
                              title={`${indicator.label} ${statusCounts[indicator.key]}건`}
                            />
                          ))}
                        </div>
                        {recordCount > 0 ? (
                          <span
                            className="h-[3px] w-3 rounded-full bg-[#a7b3c2]"
                            title={`기록 ${recordCount}건`}
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>

          <GroomingDatePanel date={selectedDate} items={selectedItems} onSelectItem={openItem} onConfirmReservation={confirmReservation} />
        </div>
      </WebSurface>

      {selectedItem ? (
        <GroomingRecordSheet shopId={initialData.shop.id} item={selectedItem} onClose={() => setSelectedItem(null)} />
      ) : null}
    </div>
  );
}

function GroomingDatePanel({
  date,
  items,
  onSelectItem,
  onConfirmReservation,
}: {
  date: string;
  items: DayItem[];
  onSelectItem: (item: DayItem) => void;
  onConfirmReservation: (reservationId: string) => void;
}) {
  const reservationCount = items.filter((item) => item.type === "reservation").length;
  const recordCount = items.filter((item) => item.type === "record").length;
  const reservationItems = items.filter((item) => item.type === "reservation");
  const recordItems = items.filter((item) => item.type === "record");
  const isPastDate = date < currentDateInTimeZone();

  return (
    <aside className="flex min-h-[492px] flex-col bg-white">
      <div className="border-b border-[#edf2f7] px-5 py-4">
        <h3 className="text-[20px] font-semibold text-[#111827]">{formatFullDate(date)}</h3>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-2.5">
        {items.length > 0 ? (
          <div className="space-y-3">
            {isPastDate ? (
              <>
                <DayItemSection title="기록" count={recordCount} items={recordItems} onSelectItem={onSelectItem} onConfirmReservation={onConfirmReservation} />
                <DayItemSection title="예약" count={reservationCount} items={reservationItems} onSelectItem={onSelectItem} onConfirmReservation={onConfirmReservation} />
              </>
            ) : (
              <>
                <DayItemSection title="예약" count={reservationCount} items={reservationItems} onSelectItem={onSelectItem} onConfirmReservation={onConfirmReservation} />
                <DayItemSection title="기록" count={recordCount} items={recordItems} onSelectItem={onSelectItem} onConfirmReservation={onConfirmReservation} />
              </>
            )}
          </div>
        ) : (
          <div className="rounded-[8px] border border-dashed border-[#dbe2ea] bg-[#f8fafc] px-4 py-8 text-center text-[13px] text-[#94a3b8]">
            이 날짜에는 예약이나 기록이 없습니다.
          </div>
        )}
      </div>
    </aside>
  );
}

function DayItemSection({
  title,
  count,
  items,
  onSelectItem,
  onConfirmReservation,
}: {
  title: string;
  count: number;
  items: DayItem[];
  onSelectItem: (item: DayItem) => void;
  onConfirmReservation: (reservationId: string) => void;
}) {
  return (
    <section>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[13px] font-semibold text-[#334155]">{title}</p>
        <span className="text-[12px] text-[#94a3b8]">{count}건</span>
      </div>
      {items.length > 0 ? (
        <div className="space-y-1">
          {items.map((item) => {
            const confirmable = item.type === "reservation" && item.status === "승인 대기";
            return (
            <div
              key={`${item.type}-${item.id}`}
              className={cn(
                "relative w-full overflow-hidden rounded-[8px] border bg-white transition hover:bg-[#f8fafc]",
                getRecordTone(item),
                getWrapIndicatorClass(getStatusAccent(item)),
              )}
            >
              <button type="button" onClick={() => onSelectItem(item)} className="w-full px-3 py-2 text-left">
                <div className="flex min-w-0 items-start justify-between gap-3 pl-1">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-[#111827]">{item.pet} · {item.customer}</p>
                  </div>
                  {item.time ? <span className={cn("shrink-0 text-[14px] font-normal tabular-nums", getTimeTone(item))}>{item.time}</span> : null}
                </div>
                <div className="mt-1 flex min-w-0 items-end justify-between gap-3 pl-1">
                  <p className="line-clamp-1 min-w-0 text-[12px] leading-4 text-[#64748b]">
                    {item.service}
                    {item.note ? ` · ${item.note}` : ""}
                  </p>
                  <span className={cn("shrink-0 bg-white px-0 py-0 text-[14px] font-normal leading-5", getBadgeTone(item))}>
                    {item.type === "record" ? "기록" : item.status}
                  </span>
                </div>
              </button>
              {confirmable ? (
                <div className="border-t border-[#f1e4c2] px-3 pb-2 pt-2">
                  <button
                    type="button"
                    onClick={() => onConfirmReservation(item.id)}
                    className="h-8 w-full rounded-[7px] bg-[#dca93b] text-[13px] font-medium text-white transition hover:bg-[#c79024]"
                  >
                    예약 확정
                  </button>
                </div>
              ) : null}
            </div>
          );
          })}
        </div>
      ) : (
        <div className="rounded-[8px] border border-dashed border-[#dbe2ea] bg-white px-3 py-3 text-[12px] text-[#94a3b8]">
          {title === "예약" ? "예약이 없습니다." : "작성된 기록이 없습니다."}
        </div>
      )}
    </section>
  );
}

function GroomingRecordSheet({ shopId, item, onClose }: { shopId: string; item: DayItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/20" onClick={onClose}>
      <aside
        className="ml-auto flex h-full w-full max-w-[430px] flex-col border-l border-[#dbe2ea] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.22)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#edf2f7] px-5 py-4">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold tracking-[0.12em] text-[#94a3b8]">{item.type === "record" ? "기록 상세" : "예약 내역"}</p>
            <h3 className="mt-2 truncate text-[24px] font-semibold text-[#111827]">{item.pet} · {item.customer}</h3>
            <p className="mt-1 text-[14px] text-[#64748b]">{formatShortDate(item.date)}{item.time ? ` · ${item.time}` : ""}</p>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#64748b] hover:bg-[#f8fafc]" aria-label="닫기">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="grid grid-cols-2 gap-2">
            <InfoTile label="구분" value={item.type === "record" ? "기록" : "예약"} />
            <InfoTile label="상태" value={item.status} />
            <InfoTile label="서비스" value={item.service} />
            <InfoTile label="담당" value={item.staff ?? "미지정"} />
          </div>

          <section className="mt-5 rounded-[8px] border border-[#dbe2ea] bg-[#f8fafc] p-4">
            <p className="text-[12px] font-semibold text-[#64748b]">{item.type === "record" ? "시술 메모" : "고객 요청"}</p>
            <p className="mt-2 text-[15px] leading-6 text-[#111827]">{item.note || "요청 내용이 없습니다."}</p>
          </section>

          {item.next ? (
            <section className="mt-3 rounded-[8px] border border-[#dbe2ea] bg-white p-4">
              <p className="text-[12px] font-semibold text-[#64748b]">다음 체크</p>
              <p className="mt-2 text-[15px] leading-6 text-[#111827]">{item.next}</p>
            </section>
          ) : null}

          <OwnerMediaUploadPanel
            context={{
              shopId,
              guardianId: item.guardianId,
              petId: item.petId,
              appointmentId: item.appointmentId ?? null,
              groomingRecordId: item.groomingRecordId ?? null,
            }}
          />
        </div>
      </aside>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-[#dbe2ea] bg-white px-3 py-3">
      <p className="text-[12px] text-[#94a3b8]">{label}</p>
      <p className="mt-1 truncate text-[15px] font-semibold text-[#111827]">{value}</p>
    </div>
  );
}
