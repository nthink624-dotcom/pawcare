import { z } from "zod";
import type { ShopCalendarEvent, ShopCalendarEventInput } from "@petmanager/shared/contracts/owner-calendar";
import { calendarMonthBounds, seoulCalendarDate, seoulCalendarInstant } from "@petmanager/shared/lib/owner-calendar";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { OwnerApiError, type OwnerShopContext } from "@/server/owner-api-auth";

const dayMs = 86_400_000;
const eventFields = "id,title,starts_at,ends_at,all_day,source";

export const shopCalendarMonthSchema = z.string().regex(/^(?:19[7-9]\d|20\d{2}|2100)-(?:0[1-9]|1[0-2])$/);

export const calendarEventSchema = z.object({
  title: z.string().trim().min(1).max(160),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  allDay: z.boolean(),
}).superRefine((event, ctx) => {
  const start = Date.parse(event.startsAt);
  const end = Date.parse(event.endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 366 * dayMs) {
    ctx.addIssue({ code: "custom", path: ["endsAt"], message: "일정 시작과 종료를 확인해 주세요." });
    return;
  }
  if (event.allDay && [event.startsAt, event.endsAt].some(instant =>
    Date.parse(instant) !== Date.parse(seoulCalendarInstant(seoulCalendarDate(instant))),
  )) ctx.addIssue({ code: "custom", path: ["startsAt"], message: "종일 일정의 날짜를 확인해 주세요." });
});

type EventRow = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  source: ShopCalendarEvent["source"];
};

function projectEvent(row: EventRow): ShopCalendarEvent {
  return { id: row.id, title: row.title, startsAt: row.starts_at, endsAt: row.ends_at, allDay: row.all_day, source: row.source };
}

function eventValues(event: ShopCalendarEventInput) {
  return { title: event.title, starts_at: event.startsAt, ends_at: event.endsAt, all_day: event.allDay };
}

function calendarAdmin() {
  const admin = getSupabaseAdmin();
  if (!admin) throw new OwnerApiError("매장 일정을 사용할 수 없어요.", 503);
  return admin;
}

export function requireCalendarEditor(owner: OwnerShopContext) {
  if (!owner.userId) throw new OwnerApiError("로그인이 필요합니다.", 401);
  if (owner.role !== "owner" && owner.role !== "manager") {
    throw new OwnerApiError("매장 일정을 편집할 권한이 없어요.", 403);
  }
}

export async function listShopCalendarEvents(owner: OwnerShopContext, month: string) {
  const admin = calendarAdmin();
  const { from, until } = calendarMonthBounds(month);
  const events: ShopCalendarEvent[] = [];
  const batchSize = 500;
  for (let offset = 0; ; offset += batchSize) {
    const { data, error } = await admin.from("shop_calendar_events").select(eventFields)
      .eq("shop_id", owner.shopId)
      .lt("starts_at", seoulCalendarInstant(until))
      .gt("ends_at", seoulCalendarInstant(from))
      .order("starts_at").order("id").range(offset, offset + batchSize - 1);
    if (error) throw new OwnerApiError("매장 일정을 불러오지 못했어요.", 503);
    events.push(...(data as EventRow[]).map(projectEvent));
    if (data.length < batchSize) break;
  }
  return { events, canEdit: owner.role === "owner" || owner.role === "manager" };
}

export async function saveShopCalendarEvent(owner: OwnerShopContext, id: string, event: ShopCalendarEventInput, create: boolean) {
  requireCalendarEditor(owner);
  const admin = calendarAdmin();
  const values = eventValues(event);
  const table = admin.from("shop_calendar_events");
  const { data, error } = create
    ? await table.upsert({ ...values, id, shop_id: owner.shopId }, { onConflict: "id", ignoreDuplicates: true }).select(eventFields).maybeSingle()
    : await table.update({ ...values, updated_at: new Date().toISOString() }).eq("shop_id", owner.shopId).eq("id", id).select(eventFields).maybeSingle();
  if (error) throw new OwnerApiError("매장 일정을 저장하지 못했어요.", 503);
  if (data) return projectEvent(data as EventRow);
  if (create) {
    const existing = await admin.from("shop_calendar_events").select(eventFields).eq("shop_id", owner.shopId).eq("id", id).maybeSingle();
    if (existing.error) throw new OwnerApiError("매장 일정을 확인하지 못했어요.", 503);
    if (existing.data) return projectEvent(existing.data as EventRow);
  }
  throw new OwnerApiError("편집할 일정을 찾을 수 없어요.", 404);
}

export async function removeShopCalendarEvent(owner: OwnerShopContext, id: string) {
  requireCalendarEditor(owner);
  const { error } = await calendarAdmin().from("shop_calendar_events").delete().eq("shop_id", owner.shopId).eq("id", id);
  if (error) throw new OwnerApiError("매장 일정을 삭제하지 못했어요.", 503);
}

export async function getImportedCalendarKeys(owner: OwnerShopContext, keys: string[]) {
  requireCalendarEditor(owner);
  const batches: string[][] = [];
  for (let start = 0; start < keys.length; start += 50) batches.push(keys.slice(start, start + 50));
  const admin = calendarAdmin();
  const results = await Promise.all(batches.map(batch => admin.from("shop_calendar_events")
    .select("source_key").eq("shop_id", owner.shopId).in("source_key", batch)));
  if (results.some(result => result.error)) throw new OwnerApiError("기존에 가져온 일정을 확인하지 못했어요.", 503);
  return new Set(results.flatMap(result => (result.data ?? []).map(row => row.source_key as string)));
}

export async function importShopCalendarEvents(owner: OwnerShopContext, events: (ShopCalendarEventInput & { key: string })[]) {
  requireCalendarEditor(owner);
  const { data, error } = await calendarAdmin().from("shop_calendar_events").upsert(
    events.map(event => ({ ...eventValues(event), shop_id: owner.shopId, source: "ics", source_key: event.key })),
    { onConflict: "shop_id,source_key", ignoreDuplicates: true },
  ).select("id");
  if (error) throw new OwnerApiError("일정을 가져오지 못했어요. 다시 시도해 주세요.", 503);
  return { imported: data.length, duplicates: events.length - data.length };
}
