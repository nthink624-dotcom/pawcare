export type CalendarHoliday = { date: string; name: string };

export type CalendarHolidaysResponse = { month: string; holidays: CalendarHoliday[] };

export const shopCalendarTitleMaxLength = 160;
export const shopCalendarBodyMaxLength = 1000;

export type ShopCalendarEventInput = {
  title: string;
  /** Note body. Leaving it out of a PATCH keeps the stored body; a new event starts with an empty one. */
  body?: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
};

export type ShopCalendarEvent = ShopCalendarEventInput & {
  id: string;
  body: string;
  source: "manual" | "ics";
};

export type ShopCalendarResponse = { events: ShopCalendarEvent[]; canEdit: boolean };

export type CalendarImportPreview = {
  items: (ShopCalendarEventInput & { key: string; alreadyImported: boolean })[];
  skipped: number;
};

export type CalendarRequest = <T>(url: string, init?: RequestInit) => Promise<T>;
