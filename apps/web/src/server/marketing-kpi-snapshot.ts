import "server-only";

import { serverEnv } from "@/lib/server-env";
import {
  buildMarketingKpiSnapshot,
  type MarketingAppointmentRow,
  type MarketingPaymentRow,
  type MarketingSignupRow,
} from "@/lib/marketing-kpi-runtime";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { MarketingKpiEnvironment, MarketingKpiSnapshot } from "@/types/marketing-kpi";

const PAGE_SIZE = 1_000;
const SHOP_BATCH_SIZE = 100;

type SupabaseAdmin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;
type QueryError = {
  code?: string;
  message?: string;
};

type OwnerProfileRow = {
  user_id: string;
  shop_id: string;
  created_at: string;
};

type ShopRow = {
  id: string;
  deleted_at: string | null;
};

type AppointmentRow = {
  id: string;
  shop_id: string;
  status: string;
  created_at: string;
};

type PaymentRow = {
  id: string;
  shop_id: string;
  plan_code: string | null;
  status: string;
  paid_at: string | null;
};

export async function getMarketingKpiSnapshot(days = 7): Promise<MarketingKpiSnapshot> {
  const now = new Date();
  const normalizedDays = Number.isInteger(days) ? Math.min(Math.max(days, 1), 30) : 7;
  const environment = resolveEnvironment(serverEnv.supabaseEnvName);
  const previousFrom = new Date(
    now.getTime() - normalizedDays * 2 * 24 * 60 * 60 * 1_000,
  ).toISOString();

  let admin: SupabaseAdmin | null = null;
  try {
    admin = getSupabaseAdmin();
  } catch (error) {
    logSourceError("Supabase client", error);
  }

  if (!admin) {
    return buildMarketingKpiSnapshot({
      now,
      days: normalizedDays,
      environment,
      signupRows: null,
      activeShopIds: null,
      appointmentRows: null,
      paymentRows: null,
    });
  }

  const signupRows = await readSignupRows(admin, previousFrom, now.toISOString());
  if (signupRows === null) {
    return buildMarketingKpiSnapshot({
      now,
      days: normalizedDays,
      environment,
      signupRows: null,
      activeShopIds: null,
      appointmentRows: null,
      paymentRows: null,
    });
  }

  const shopIds = [...new Set(signupRows.map((row) => row.shopId).filter(Boolean))];
  const activeShopIds = await readActiveShopIds(admin, shopIds);
  if (activeShopIds === null) {
    return buildMarketingKpiSnapshot({
      now,
      days: normalizedDays,
      environment,
      signupRows,
      activeShopIds: null,
      appointmentRows: null,
      paymentRows: null,
    });
  }

  const [appointmentRows, paymentRows] = await Promise.all([
    readAppointmentRows(admin, activeShopIds, previousFrom, now.toISOString()),
    readPaymentRows(admin, activeShopIds, previousFrom, now.toISOString()),
  ]);

  return buildMarketingKpiSnapshot({
    now,
    days: normalizedDays,
    environment,
    signupRows,
    activeShopIds,
    appointmentRows,
    paymentRows,
  });
}

function resolveEnvironment(value: string | undefined): MarketingKpiEnvironment {
  if (value === "production" || value === "development") return value;
  return "unknown";
}

async function readSignupRows(
  admin: SupabaseAdmin,
  from: string,
  to: string,
): Promise<MarketingSignupRow[] | null> {
  const rows: MarketingSignupRow[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const result = await admin
      .from("owner_profiles")
      .select("user_id,shop_id,created_at")
      .gte("created_at", from)
      .lt("created_at", to)
      .order("created_at", { ascending: true })
      .order("user_id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (result.error) {
      logSourceError("owner_profiles", result.error);
      return null;
    }

    const page = (result.data ?? []) as OwnerProfileRow[];
    rows.push(...page.map((row) => ({ shopId: row.shop_id, createdAt: row.created_at })));
    if (page.length < PAGE_SIZE) return rows;
  }
}

async function readActiveShopIds(admin: SupabaseAdmin, shopIds: string[]) {
  if (shopIds.length === 0) return [];

  const activeShopIds: string[] = [];
  for (const batch of chunk(shopIds, SHOP_BATCH_SIZE)) {
    const result = await admin.from("shops").select("id,deleted_at").in("id", batch);
    if (result.error) {
      logSourceError("shops", result.error);
      return null;
    }

    const rows = (result.data ?? []) as ShopRow[];
    activeShopIds.push(...rows.filter((row) => !row.deleted_at).map((row) => row.id));
  }

  return [...new Set(activeShopIds)];
}

async function readAppointmentRows(
  admin: SupabaseAdmin,
  shopIds: string[],
  from: string,
  to: string,
): Promise<MarketingAppointmentRow[] | null> {
  if (shopIds.length === 0) return [];
  const rows: MarketingAppointmentRow[] = [];

  for (const batch of chunk(shopIds, SHOP_BATCH_SIZE)) {
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const result = await admin
        .from("appointments")
        .select("id,shop_id,status,created_at")
        .in("shop_id", batch)
        .gte("created_at", from)
        .lt("created_at", to)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (result.error) {
        logSourceError("appointments", result.error);
        return null;
      }

      const page = (result.data ?? []) as AppointmentRow[];
      rows.push(
        ...page.map((row) => ({
          shopId: row.shop_id,
          status: row.status,
          createdAt: row.created_at,
        })),
      );
      if (page.length < PAGE_SIZE) break;
    }
  }

  return rows;
}

async function readPaymentRows(
  admin: SupabaseAdmin,
  shopIds: string[],
  from: string,
  to: string,
): Promise<MarketingPaymentRow[] | null> {
  if (shopIds.length === 0) return [];
  const rows: MarketingPaymentRow[] = [];

  for (const batch of chunk(shopIds, SHOP_BATCH_SIZE)) {
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const result = await admin
        .from("owner_payment_ledger")
        .select("id,shop_id,plan_code,status,paid_at")
        .in("shop_id", batch)
        .eq("status", "PAID")
        .not("plan_code", "is", null)
        .neq("plan_code", "free")
        .gte("paid_at", from)
        .lt("paid_at", to)
        .order("paid_at", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (result.error) {
        logSourceError("owner_payment_ledger", result.error);
        return null;
      }

      const page = (result.data ?? []) as PaymentRow[];
      rows.push(
        ...page.map((row) => ({
          shopId: row.shop_id,
          planCode: row.plan_code,
          status: row.status,
          paidAt: row.paid_at,
        })),
      );
      if (page.length < PAGE_SIZE) break;
    }
  }

  return rows;
}

function chunk<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function logSourceError(source: string, error: unknown) {
  const queryError = error as QueryError | null | undefined;
  console.error(`[marketing-kpi] ${source} query failed`, {
    code: queryError?.code ?? "unknown",
    message: queryError?.message ?? "unknown error",
  });
}
