"use client";

import { useEffect, useState } from "react";
import type { CalendarHoliday, CalendarHolidaysResponse, CalendarRequest, ShopCalendarEvent, ShopCalendarResponse } from "../contracts/owner-calendar";

const noHolidays: CalendarHoliday[] = [];
const noEvents: ShopCalendarEvent[] = [];

export function useCalendarHolidays(month: string | null, request: CalendarRequest) {
  const [snapshot, setSnapshot] = useState<{ month: string; holidays: CalendarHoliday[]; error: boolean }>();
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!month) return;
    const controller = new AbortController();
    void request<CalendarHolidaysResponse>(`/api/calendar/holidays?${new URLSearchParams({ month })}`, { signal: controller.signal })
      .then(result => {
        if (!controller.signal.aborted && result.month === month) setSnapshot({ month, holidays: result.holidays, error: false });
      }).catch(() => {
        if (!controller.signal.aborted) setSnapshot(previous => ({ month, holidays: previous?.month === month ? previous.holidays : noHolidays, error: true }));
      });
    return () => controller.abort();
  }, [month, request, revision]);

  const current = snapshot?.month === month ? snapshot : undefined;
  return { holidays: current?.holidays ?? noHolidays, holidayError: current?.error ?? false, reloadHolidays: () => setRevision(value => value + 1) };
}

export function useShopCalendarEvents(shopId: string | null, month: string, request: CalendarRequest) {
  const [snapshot, setSnapshot] = useState<{ key: string; data?: ShopCalendarResponse; error: boolean }>();
  const [revision, setRevision] = useState(0);
  const key = JSON.stringify([shopId, month]);
  useEffect(() => {
    if (!shopId) return;
    let controller: AbortController;
    const fetchEvents = () => {
      controller?.abort();
      const signal = (controller = new AbortController()).signal;
      void request<ShopCalendarResponse>(`/api/owner/calendar-events?${new URLSearchParams({ shopId, month })}`, { signal })
        .then(data => {
          if (!signal.aborted) setSnapshot({ key, data, error: false });
        }).catch(() => {
          if (!signal.aborted) setSnapshot(previous => ({ key, data: previous?.key === key ? previous.data : undefined, error: true }));
        });
    };
    const refreshVisible = () => { if (!document.hidden) fetchEvents(); };
    fetchEvents();
    const timer = window.setInterval(refreshVisible, 60_000);
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      controller?.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [shopId, month, request, key, revision]);

  const current = snapshot?.key === key ? snapshot : undefined;
  return {
    events: current?.data?.events ?? noEvents,
    canEdit: current?.error ? false : current?.data?.canEdit ?? false,
    eventsLoading: !!shopId && !current,
    eventsError: current?.error ?? false,
    reloadEvents: () => setRevision(value => value + 1),
  };
}
