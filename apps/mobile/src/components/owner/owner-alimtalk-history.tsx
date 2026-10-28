"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import type { BootstrapPayload, NotificationStatus, NotificationType } from "@/types/domain";

const notificationLabels: Record<NotificationType | "booking_deposit_request", string> = {
  booking_deposit_request: "예약금 안내",
  booking_received: "예약 접수 안내",
  booking_confirmed: "예약 확정 안내",
  owner_booking_requested: "예약 요청 안내",
  booking_cancelled: "예약 취소 안내",
  appointment_reminder_10m: "방문 직전 안내",
  visit_schedule_notice: "예약 방문 안내",
  visit_reminder_notice: "예약 방문 안내",
  grooming_started: "미용 시작 안내",
  grooming_almost_done: "픽업 준비 안내",
  grooming_completed: "미용 완료 안내",
  revisit_notice: "재방문 안내",
  landing_feedback: "문의 안내",
  waitlist_interest: "대기 안내",
  birthday_greeting: "생일 안내",
};

const statusLabels: Record<NotificationStatus, string> = {
  queued: "발송 대기",
  sent: "발송 완료",
  failed: "발송 실패",
  mocked: "테스트 기록",
  skipped: "발송 안 함",
};

const statusStyles: Record<NotificationStatus, string> = {
  queued: "bg-[#f8f3e9] text-[#866747]",
  sent: "bg-[#edf5f1] text-[#2c6654]",
  failed: "bg-[#fbefed] text-[#985b50]",
  mocked: "bg-[#f1f4f7] text-[#64748b]",
  skipped: "bg-[#f1f4f7] text-[#64748b]",
};

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatNotificationDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "시간 정보 없음" : dateFormatter.format(date);
}

export default function OwnerAlimtalkHistory({ data }: { data: BootstrapPayload }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<NotificationStatus | "all">("all");
  const [type, setType] = useState<NotificationType | "all">("all");
  const [visibleCount, setVisibleCount] = useState(10);

  const records = useMemo(() => {
    const guardians = new Map(data.guardians.map((guardian) => [guardian.id, guardian.name]));
    const pets = new Map(data.pets.map((pet) => [pet.id, pet.name]));
    return data.notifications
      .filter((item) => item.shop_id === data.shop.id && item.channel === "alimtalk")
      .map((item) => ({
        ...item,
        guardianName: (item.guardian_id && guardians.get(item.guardian_id)) || "고객 정보 없음",
        petName: (item.pet_id && pets.get(item.pet_id)) || "",
      }))
      .sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0));
  }, [data.guardians, data.notifications, data.pets, data.shop.id]);

  const availableTypes = useMemo(() => Array.from(new Set(records.map((item) => item.type))), [records]);
  const filteredRecords = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("ko-KR");
    return records.filter((item) => (
      (status === "all" || item.status === status)
      && (type === "all" || item.type === type)
      && (!query || `${item.guardianName} ${item.petName}`.toLocaleLowerCase("ko-KR").includes(query))
    ));
  }, [records, search, status, type]);

  function resetFilters() {
    setSearch("");
    setStatus("all");
    setType("all");
    setVisibleCount(10);
  }

  const hasFilters = search.trim() !== "" || status !== "all" || type !== "all";
  const filterClassName = "min-h-11 w-full min-w-0 rounded-xl border border-[#e2e7ed] bg-white px-3 text-[16px] text-[#334155] outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]";

  return (
    <section aria-labelledby="customer-alimtalk-history-title" className="space-y-3 rounded-2xl border border-[#e2e7ed] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="customer-alimtalk-history-title" className="text-[16px] font-semibold text-[#25364d]">알림톡 발송 내역</h3>
        <span className="text-[12px] text-[#64748b]">최근 불러온 내역 {records.length}건</span>
      </div>

      <label className="relative block">
        <span className="sr-only">고객·반려동물 이름으로 발송 내역 검색</span>
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#94a3b8]" />
        <input
          type="search"
          value={search}
          onChange={(event) => { setSearch(event.target.value); setVisibleCount(10); }}
          placeholder="고객·반려동물 검색"
          className={`${filterClassName} pl-9`}
        />
      </label>
      <div className="grid min-w-0 grid-cols-1 gap-2 min-[375px]:grid-cols-2">
        <select aria-label="발송 결과 필터" value={status} onChange={(event) => { setStatus(event.target.value as NotificationStatus | "all"); setVisibleCount(10); }} className={filterClassName}>
          <option value="all">발송 결과 전체</option>
          {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select aria-label="알림 종류 필터" value={type} onChange={(event) => { setType(event.target.value as NotificationType | "all"); setVisibleCount(10); }} className={filterClassName}>
          <option value="all">알림 종류 전체</option>
          {availableTypes.map((value) => <option key={value} value={value}>{notificationLabels[value]}</option>)}
        </select>
      </div>
      {hasFilters ? (
        <div className="flex items-center justify-between gap-2 text-[13px]">
          <p role="status" className="text-[#64748b]">검색 결과 {filteredRecords.length}건</p>
          <button type="button" onClick={resetFilters} className="min-h-11 rounded-lg px-2 font-medium text-[#334155] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-[#2563eb]">필터 초기화</button>
        </div>
      ) : null}

      {filteredRecords.length === 0 ? (
        <p className="rounded-xl bg-[#f8fafc] px-3 py-5 text-[14px] leading-6 text-[#64748b]">
          {hasFilters ? "조건에 맞는 발송 내역이 없어요." : "불러온 알림톡 발송 내역이 없어요."}
        </p>
      ) : (
        <ul className="divide-y divide-[#e8edf3]">
          {filteredRecords.slice(0, visibleCount).map((item) => (
            <li key={item.id} className="space-y-1.5 py-3 first:pt-1">
              <div className="flex min-w-0 items-start justify-between gap-2">
                <p className="min-w-0 text-[14px] font-medium text-[#334155] [overflow-wrap:anywhere]">{notificationLabels[item.type]}</p>
                <span className={`shrink-0 rounded-full px-2 py-1 text-[12px] font-medium ${statusStyles[item.status]}`}>{statusLabels[item.status]}</span>
              </div>
              <p className="text-[14px] text-[#475569] [overflow-wrap:anywhere]">{item.guardianName}{item.petName ? ` · ${item.petName}` : ""}</p>
              <time dateTime={item.sent_at || item.created_at} className="block text-[12px] text-[#64748b]">{formatNotificationDate(item.sent_at || item.created_at)}</time>
              {item.status === "failed" ? <p className="text-[13px] leading-5 text-[#985b50]">수신 설정과 매장 알림톡 잔액을 확인해 주세요.</p> : null}
            </li>
          ))}
        </ul>
      )}
      {filteredRecords.length > visibleCount ? (
        <button type="button" onClick={() => setVisibleCount((count) => count + 10)} className="min-h-11 w-full rounded-xl border border-[#e2e7ed] bg-white px-3 text-[14px] font-medium text-[#334155] focus-visible:outline-2 focus-visible:outline-[#2563eb]">발송 내역 더 보기</button>
      ) : null}
    </section>
  );
}
