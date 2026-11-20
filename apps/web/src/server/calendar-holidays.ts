import { XMLParser } from "fast-xml-parser";
import { unstable_cache } from "next/cache.js";
import type { CalendarHoliday } from "@petmanager/shared/contracts/owner-calendar";
import { isCalendarDate } from "@petmanager/shared/lib/owner-calendar";

const endpoint = "https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo";
const parser = new XMLParser({ parseTagValue: false });

type SpecialDay = { locdate?: string; dateName?: string; isHoliday?: string };

export function parseCalendarHolidays(xml: string, month: string): CalendarHoliday[] {
  if (xml.length > 100_000 || /<!DOCTYPE/i.test(xml)) throw new Error("Invalid holiday response");
  const response = parser.parse(xml).response as {
    header?: { resultCode?: string };
    body?: { items?: { item?: SpecialDay | SpecialDay[] }; totalCount?: string };
  } | undefined;
  if (!response || response.header?.resultCode !== "00" || !/^\d+$/.test(response.body?.totalCount ?? "")) {
    throw new Error("Holiday service did not return data");
  }
  const items = response.body?.items?.item;
  const rows = Array.isArray(items) ? items : items ? [items] : [];
  if (rows.length !== Number(response.body?.totalCount)) throw new Error("Incomplete holiday response");

  const holidays = new Map<string, CalendarHoliday>();
  for (const row of rows) {
    if (row.isHoliday !== "Y") continue;
    const raw = row.locdate ?? "";
    const date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6)}`;
    const name = row.dateName?.trim();
    if (!isCalendarDate(date) || !date.startsWith(`${month}-`) || !name || name.length > 100) {
      throw new Error("Invalid holiday row");
    }
    holidays.set(`${date}/${name}`, { date, name });
  }
  return [...holidays.values()].sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, "ko"));
}

export const readCalendarHolidays = unstable_cache(async (month: string) => {
  const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY?.trim();
  if (!serviceKey) throw new Error("Holiday service key is missing");
  const [solYear, solMonth] = month.split("-");
  const url = new URL(endpoint);
  url.search = new URLSearchParams({ serviceKey, solYear, solMonth, pageNo: "1", numOfRows: "100" }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(5_000), redirect: "error", cache: "no-store" });
  if (!response.ok) throw new Error("Holiday service request failed");
  return parseCalendarHolidays(await response.text(), month);
}, ["korean-public-holidays-v1"], { revalidate: 21_600 });
