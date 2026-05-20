import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { NotificationType } from "@/types/domain";

type CreditMetadata = Record<string, string | number | boolean | null | undefined>;

export type AlimtalkCreditReservation = {
  consumed: boolean;
  remainingCount: number | null;
  eventId: string | null;
  consumedBucket: "included" | "purchased" | null;
  failReason: string | null;
};

export type AdminAlimtalkCreditBalance = {
  shopId: string;
  shopName: string;
  includedTotal: number;
  includedUsed: number;
  includedRemaining: number;
  includedPeriodStartedAt: string | null;
  includedPeriodEndsAt: string | null;
  purchasedTotal: number;
  purchasedUsed: number;
  purchasedRemaining: number;
  remainingTotal: number;
  updatedAt: string;
};

type CreditBalanceRow = {
  shop_id: string;
  included_total: number;
  included_used: number;
  included_remaining: number;
  included_period_started_at: string | null;
  included_period_ends_at: string | null;
  purchased_total: number;
  purchased_used: number;
  purchased_remaining: number;
  remaining_total: number;
  updated_at: string;
};

type ShopRow = {
  id: string;
  name: string;
};

function getAdmin() {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new Error("Supabase 관리자 설정을 확인해 주세요.");
  }
  return admin;
}

function normalizeRpcRow(value: unknown) {
  if (Array.isArray(value)) return value[0] as Record<string, unknown> | undefined;
  return value as Record<string, unknown> | undefined;
}

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function reserveShopAlimtalkCredit(input: {
  shopId: string;
  appointmentId?: string | null;
  notificationType?: NotificationType | null;
  metadata?: CreditMetadata | null;
}): Promise<AlimtalkCreditReservation> {
  const admin = getAdmin();
  const result = await admin.rpc("consume_shop_alimtalk_credit", {
    p_shop_id: input.shopId,
    p_notification_id: null,
    p_appointment_id: input.appointmentId ?? null,
    p_notification_type: input.notificationType ?? null,
    p_reason: "alimtalk_send_attempt",
    p_metadata: input.metadata ?? {},
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  const row = normalizeRpcRow(result.data);
  return {
    consumed: row?.success === true,
    remainingCount: toNumber(row?.remaining_count),
    eventId: typeof row?.event_id === "string" ? row.event_id : null,
    consumedBucket:
      row?.consumed_bucket === "included" || row?.consumed_bucket === "purchased"
        ? row.consumed_bucket
        : null,
    failReason: typeof row?.fail_reason === "string" ? row.fail_reason : null,
  };
}

export async function refundShopAlimtalkCredit(input: {
  shopId: string;
  sourceEventId?: string | null;
  appointmentId?: string | null;
  notificationType?: NotificationType | null;
  reason?: string | null;
  metadata?: CreditMetadata | null;
}) {
  const admin = getAdmin();
  const result = await admin.rpc("refund_shop_alimtalk_credit", {
    p_shop_id: input.shopId,
    p_source_event_id: input.sourceEventId ?? null,
    p_notification_id: null,
    p_appointment_id: input.appointmentId ?? null,
    p_notification_type: input.notificationType ?? null,
    p_reason: input.reason ?? "alimtalk_send_failed",
    p_metadata: input.metadata ?? {},
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  const row = normalizeRpcRow(result.data);
  return {
    remainingCount: toNumber(row?.remaining_count),
    eventId: typeof row?.event_id === "string" ? row.event_id : null,
  };
}

export async function grantShopAlimtalkCredits(input: {
  shopId: string;
  amount: number;
  creditBucket: "included" | "purchased";
  reason?: string | null;
  metadata?: CreditMetadata | null;
}) {
  const admin = getAdmin();
  const result = await admin.rpc("grant_shop_alimtalk_credits", {
    p_shop_id: input.shopId,
    p_amount: input.amount,
    p_credit_bucket: input.creditBucket,
    p_reason: input.reason ?? "manual_grant",
    p_metadata: input.metadata ?? {},
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  const row = normalizeRpcRow(result.data);
  return {
    remainingCount: toNumber(row?.remaining_count),
    eventId: typeof row?.event_id === "string" ? row.event_id : null,
  };
}

export async function resetShopAlimtalkIncludedCredits(input: {
  shopId: string;
  includedAmount: number;
  periodStartedAt?: string | null;
  periodEndsAt?: string | null;
  reason?: string | null;
  metadata?: CreditMetadata | null;
}) {
  const admin = getAdmin();
  const result = await admin.rpc("reset_shop_alimtalk_included_credits", {
    p_shop_id: input.shopId,
    p_included_amount: input.includedAmount,
    p_period_started_at: input.periodStartedAt ?? new Date().toISOString(),
    p_period_ends_at: input.periodEndsAt ?? null,
    p_reason: input.reason ?? "monthly_included_reset",
    p_metadata: input.metadata ?? {},
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  const row = normalizeRpcRow(result.data);
  return {
    remainingCount: toNumber(row?.remaining_count),
    eventId: typeof row?.event_id === "string" ? row.event_id : null,
  };
}

export async function getAdminAlimtalkCreditBalances(): Promise<AdminAlimtalkCreditBalance[]> {
  const admin = getAdmin();
  const [balancesResult, shopsResult] = await Promise.all([
    admin
      .from("shop_alimtalk_credit_summaries")
      .select(
        "shop_id, included_total, included_used, included_remaining, included_period_started_at, included_period_ends_at, purchased_total, purchased_used, purchased_remaining, remaining_total, updated_at",
      )
      .order("updated_at", { ascending: false }),
    admin.from("shops").select("id, name"),
  ]);

  if (balancesResult.error) {
    throw new Error(balancesResult.error.message);
  }
  if (shopsResult.error) {
    throw new Error(shopsResult.error.message);
  }

  const shopNameById = new Map((shopsResult.data as ShopRow[]).map((shop) => [shop.id, shop.name]));

  return ((balancesResult.data ?? []) as CreditBalanceRow[]).map((row) => ({
    shopId: row.shop_id,
    shopName: shopNameById.get(row.shop_id) ?? row.shop_id,
    includedTotal: row.included_total,
    includedUsed: row.included_used,
    includedRemaining: row.included_remaining,
    includedPeriodStartedAt: row.included_period_started_at,
    includedPeriodEndsAt: row.included_period_ends_at,
    purchasedTotal: row.purchased_total,
    purchasedUsed: row.purchased_used,
    purchasedRemaining: row.purchased_remaining,
    remainingTotal: row.remaining_total,
    updatedAt: row.updated_at,
  }));
}
