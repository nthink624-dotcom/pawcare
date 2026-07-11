import { randomUUID } from "node:crypto";

import { phoneNormalize } from "@/lib/utils";
import { OwnerApiError } from "@/server/owner-api-auth";

export const SHOP_IDENTITY_CHANGE_MONTHLY_LIMIT = 2;

export const SHOP_IDENTITY_FIELD_NAMES = ["name", "address", "phone", "additional_contact"] as const;

export type ShopIdentityFieldName = (typeof SHOP_IDENTITY_FIELD_NAMES)[number];

export type ShopIdentityChange = {
  fieldName: ShopIdentityFieldName;
  previousValue: string;
  nextValue: string;
};

type SupabaseLikeClient = {
  from: (table: string) => any;
};

type ShopIdentityEventRow = {
  id: string;
  metadata: Record<string, unknown> | null;
};

function normalizeTextIdentityValue(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function normalizePhoneIdentityValue(value: unknown) {
  const normalized = phoneNormalize(typeof value === "string" ? value : "");
  return normalized || normalizeTextIdentityValue(value);
}

function normalizeIdentityValue(fieldName: ShopIdentityFieldName, value: unknown) {
  return fieldName === "phone" || fieldName === "additional_contact"
    ? normalizePhoneIdentityValue(value)
    : normalizeTextIdentityValue(value);
}

function getKstMonthStartIso(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  return new Date(Date.UTC(year, month - 1, 1) - 9 * 60 * 60 * 1000).toISOString();
}

export function buildShopIdentityChanges(params: {
  current: Partial<Record<ShopIdentityFieldName, unknown>>;
  next: Partial<Record<ShopIdentityFieldName, unknown>>;
}) {
  const changes: ShopIdentityChange[] = [];

  for (const fieldName of SHOP_IDENTITY_FIELD_NAMES) {
    if (!(fieldName in params.next)) continue;

    const previousValue = normalizeIdentityValue(fieldName, params.current[fieldName]);
    const nextValue = normalizeIdentityValue(fieldName, params.next[fieldName]);
    if (previousValue === nextValue) continue;

    changes.push({
      fieldName,
      previousValue,
      nextValue,
    });
  }

  return changes;
}

function isMissingShopIdentityChangeEventsError(error: {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}) {
  const haystack = [error.message, error.details, error.hint].filter(Boolean).join(" ").toLowerCase();
  return error.code === "42P01" || (haystack.includes("shop_identity_change_events") && haystack.includes("schema cache"));
}

export async function assertShopIdentityChangeLimit(params: {
  admin: SupabaseLikeClient;
  shopId: string;
  changes: ShopIdentityChange[];
  now?: Date;
}) {
  if (params.changes.length === 0) {
    return {
      changeGroupId: null,
      monthlyChangeCount: 0,
      monthlyLimit: SHOP_IDENTITY_CHANGE_MONTHLY_LIMIT,
    };
  }

  const monthStartIso = getKstMonthStartIso(params.now);
  const historyResult = await params.admin
    .from("shop_identity_change_events")
    .select("id,metadata")
    .eq("shop_id", params.shopId)
    .in("field_name", SHOP_IDENTITY_FIELD_NAMES)
    .gte("created_at", monthStartIso);

  if (historyResult.error) {
    if (isMissingShopIdentityChangeEventsError(historyResult.error)) {
      return {
        changeGroupId: randomUUID(),
        monthlyChangeCount: 0,
        monthlyLimit: SHOP_IDENTITY_CHANGE_MONTHLY_LIMIT,
      };
    }

    throw new OwnerApiError(historyResult.error.message, 500);
  }

  const changeGroups = new Set<string>();
  for (const row of (historyResult.data ?? []) as ShopIdentityEventRow[]) {
    const groupId = row.metadata?.change_group_id;
    changeGroups.add(typeof groupId === "string" && groupId ? groupId : row.id);
  }

  if (changeGroups.size >= SHOP_IDENTITY_CHANGE_MONTHLY_LIMIT) {
    throw new OwnerApiError(
      "매장명, 주소, 대표 연락처 같은 핵심 정보는 월 2회까지만 수정할 수 있어요. 추가 변경이 필요하면 1:1 문의로 요청해 주세요.",
      429,
    );
  }

  return {
    changeGroupId: randomUUID(),
    monthlyChangeCount: changeGroups.size,
    monthlyLimit: SHOP_IDENTITY_CHANGE_MONTHLY_LIMIT,
  };
}

export async function insertShopIdentityChangeEvents(params: {
  admin: SupabaseLikeClient;
  shopId: string;
  ownerUserId: string | null;
  changedByUserId: string | null;
  changes: ShopIdentityChange[];
  changeGroupId: string | null;
  source: string;
}) {
  if (params.changes.length === 0 || !params.changeGroupId) return;

  const rows = params.changes.map((change) => ({
    shop_id: params.shopId,
    owner_user_id: params.ownerUserId,
    changed_by_user_id: params.changedByUserId,
    field_name: change.fieldName,
    previous_value: change.previousValue,
    next_value: change.nextValue,
    metadata: {
      source: params.source,
      change_group_id: params.changeGroupId,
    },
  }));

  const result = await params.admin.from("shop_identity_change_events").insert(rows);
  if (result.error && !isMissingShopIdentityChangeEventsError(result.error)) {
    throw new OwnerApiError(result.error.message, 500);
  }
}
