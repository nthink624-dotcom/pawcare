"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { AppointmentStatus } from "@/types/domain";
import type {
  MongshopMobileBooking,
  MongshopMobileBookingsPayload,
} from "@/server/mongshop-mobile";

type BookingResponse = MongshopMobileBookingsPayload | { message: string };

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: "예약 접수",
  confirmed: "예약 확정",
  in_progress: "진행 중",
  almost_done: "픽업 준비",
  completed: "미용 완료",
  cancelled: "취소",
  rejected: "거절",
  noshow: "노쇼",
};

const STATUS_DOT_COLORS: Record<AppointmentStatus, string> = {
  pending: "bg-[#b98121]",
  confirmed: "bg-[#1f9d55]",
  in_progress: "bg-[#2563eb]",
  almost_done: "bg-[#7c3aed]",
  completed: "bg-[#64748b]",
  cancelled: "bg-[#a04455]",
  rejected: "bg-[#a04455]",
  noshow: "bg-[#a04455]",
};

function formatDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(parsed);
}

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function MongshopMobileBookings() {
  const [payload, setPayload] = useState<MongshopMobileBookingsPayload | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadBookings = useCallback(async (isBackgroundRefresh = false) => {
    if (isBackgroundRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const response = await fetch("/api/embed/mongshop/bookings", {
        cache: "no-store",
      });
      const responseBody = (await response.json()) as BookingResponse;

      if (!response.ok || !("bookings" in responseBody)) {
        throw new Error("message" in responseBody ? responseBody.message : "예약 목록을 불러오지 못했습니다.");
      }

      setPayload(responseBody);
      setError(null);
      setSelectedId((current) =>
        current && responseBody.bookings.some((booking) => booking.id === current) ? current : null,
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "예약 목록을 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadBookings();

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void loadBookings(true);
      }
    };
    const refreshTimer = window.setInterval(refreshWhenVisible, 15_000);

    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(refreshTimer);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [loadBookings]);

  const filteredBookings = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
    if (!normalizedQuery || !payload) {
      return payload?.bookings ?? [];
    }

    return payload.bookings.filter((booking) =>
      [booking.guardianName, booking.petName, booking.serviceName, booking.staffName ?? ""]
        .join(" ")
        .toLocaleLowerCase("ko-KR")
        .includes(normalizedQuery),
    );
  }, [payload, query]);

  const selectedBooking = useMemo(
    () => payload?.bookings.find((booking) => booking.id === selectedId) ?? null,
    [payload, selectedId],
  );

  return (
    <main className="min-h-dvh bg-white text-slate-900">
      <div className="mx-auto w-full max-w-[430px] px-5 pb-8 pt-7">
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <p className="text-xs font-medium text-slate-500">개발 예약 현황</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.04em]">
              {payload?.shop.name ?? "몽샵멍샵"}
            </h1>
            {payload?.shop.address ? <p className="mt-1 text-sm text-slate-500">{payload.shop.address}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => void loadBookings(true)}
            disabled={isLoading || isRefreshing}
            className="min-h-11 shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRefreshing ? "불러오는 중" : "새로고침"}
          </button>
        </header>

        <div className="mt-5">
          <label className="sr-only" htmlFor="mongshop-booking-search">
            예약자 또는 반려견 검색
          </label>
          <input
            id="mongshop-booking-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="예약자, 반려견, 서비스 검색"
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none placeholder:text-slate-400 focus:border-slate-500"
          />
        </div>

        <section className="mt-5" aria-live="polite">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">예약 목록</h2>
            {payload ? <span className="text-sm text-slate-500">{filteredBookings.length}건</span> : null}
          </div>

          {isLoading ? <p className="py-12 text-center text-sm text-slate-500">개발 데이터를 불러오는 중입니다.</p> : null}

          {!isLoading && error ? (
            <div className="rounded-lg border border-[#a04455]/30 bg-white p-4 text-sm text-[#8b3445]">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => void loadBookings()}
                className="mt-3 font-semibold underline underline-offset-4"
              >
                다시 시도
              </button>
            </div>
          ) : null}

          {!isLoading && !error && filteredBookings.length === 0 ? (
            <p className="rounded-lg border border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
              표시할 예약이 없습니다.
            </p>
          ) : null}

          {!isLoading && !error ? (
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {filteredBookings.map((booking) => (
                <BookingRow
                  booking={booking}
                  isSelected={booking.id === selectedId}
                  key={booking.id}
                  onSelect={() => setSelectedId(booking.id)}
                />
              ))}
            </div>
          ) : null}
        </section>

        {selectedBooking ? <BookingDetail booking={selectedBooking} onClose={() => setSelectedId(null)} /> : null}

        {payload ? (
          <p className="mt-5 text-center text-xs text-slate-500">최근 확인 {formatUpdatedAt(payload.generatedAt)}</p>
        ) : null}
      </div>
    </main>
  );
}

function BookingRow({
  booking,
  isSelected,
  onSelect,
}: {
  booking: MongshopMobileBooking;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full px-4 py-4 text-left transition-colors hover:bg-slate-50 ${isSelected ? "bg-slate-50" : "bg-white"}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-900">{booking.petName}</span>
        <span className="text-sm font-medium text-slate-600">
          {formatDate(booking.appointmentDate)} {booking.appointmentTime.slice(0, 5)}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-3 text-sm text-slate-500">
        <span>{booking.guardianName} · {booking.serviceName}</span>
        <span className="flex shrink-0 items-center gap-1.5">
          <i aria-hidden="true" className={`h-2 w-2 rounded-full ${STATUS_DOT_COLORS[booking.status]}`} />
          {STATUS_LABELS[booking.status]}
        </span>
      </div>
    </button>
  );
}

function BookingDetail({ booking, onClose }: { booking: MongshopMobileBooking; onClose: () => void }) {
  return (
    <section className="mt-5 rounded-lg border border-slate-300 bg-white p-5" aria-label="예약 상세">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">예약 상세</p>
          <h2 className="mt-1 text-lg font-semibold">{booking.petName}</h2>
        </div>
        <button type="button" onClick={onClose} className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-slate-500">
          닫기
        </button>
      </div>
      <dl className="mt-5 grid grid-cols-[88px_1fr] gap-x-3 gap-y-3 text-sm">
        <dt className="text-slate-500">일시</dt>
        <dd>{formatDate(booking.appointmentDate)} {booking.appointmentTime.slice(0, 5)}</dd>
        <dt className="text-slate-500">예약자</dt>
        <dd>{booking.guardianName}</dd>
        <dt className="text-slate-500">서비스</dt>
        <dd>{booking.serviceName}</dd>
        <dt className="text-slate-500">담당</dt>
        <dd>{booking.staffName ?? "미지정"}</dd>
        <dt className="text-slate-500">상태</dt>
        <dd className="flex items-center gap-1.5">
          <i aria-hidden="true" className={`h-2 w-2 rounded-full ${STATUS_DOT_COLORS[booking.status]}`} />
          {STATUS_LABELS[booking.status]}
        </dd>
        {booking.memo ? (
          <>
            <dt className="text-slate-500">메모</dt>
            <dd className="whitespace-pre-wrap">{booking.memo}</dd>
          </>
        ) : null}
      </dl>
      <p className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-500">이 화면에서는 예약 내용을 변경할 수 없습니다.</p>
    </section>
  );
}
