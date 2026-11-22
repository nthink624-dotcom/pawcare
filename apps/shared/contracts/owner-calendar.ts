export type CalendarHoliday = { date: string; name: string };

export type CalendarHolidaysResponse = { month: string; holidays: CalendarHoliday[] };

export type ShopCalendarEventInput = {
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
};

export type ShopCalendarEvent = ShopCalendarEventInput & {
  id: string;
  source: "manual" | "ics";
};

export type ShopCalendarResponse = { events: ShopCalendarEvent[]; canEdit: boolean };

export type CalendarImportPreview = {
  items: (ShopCalendarEventInput & { key: string; alreadyImported: boolean })[];
  skipped: number;
};

export type CalendarRequest = <T>(url: string, init?: RequestInit) => Promise<T>;
