import { NextRequest, NextResponse } from "next/server";

import { getOwnerPlanDisplayName, ownerPlans, type OwnerPlanCode } from "@/lib/billing/owner-plans";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { AdminApiError, requireAdminSession } from "@/server/admin-api-auth";

type PaymentLedgerRow = {
  payment_id: string;
  shop_id: string;
  plan_code: OwnerPlanCode | null;
  amount: number | null;
  status: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  updated_at: string;
  created_at: string;
};

type SubscriptionRow = {
  current_plan_code: OwnerPlanCode;
  subscription_status: string;
};

const paidStatuses = new Set(["PAID"]);
const cancelledStatuses = new Set(["CANCELLED", "REQUESTED"]);

function isMissingTableError(error: { code?: string | null; message?: string | null; details?: string | null; hint?: string | null } | null | undefined, tableName: string) {
  const haystack = [error?.message, error?.details, error?.hint].filter(Boolean).join(" ").toLowerCase();
  return error?.code === "42P01" || (haystack.includes(tableName.toLowerCase()) && haystack.includes("schema cache"));
}

function kstDateParts(date = new Date()) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return {
    year: kst.getUTCFullYear(),
    month: kst.getUTCMonth(),
    day: kst.getUTCDate(),
  };
}

function kstRangeStartIso(kind: "today" | "month" | "last30Days") {
  const now = new Date();
  if (kind === "last30Days") {
    return new Date(now.getTime() - 30 * 86400000).toISOString();
  }

  const { year, month, day } = kstDateParts(now);
  const utc = kind === "today" ? Date.UTC(year, month, day) - 9 * 60 * 60 * 1000 : Date.UTC(year, month, 1) - 9 * 60 * 60 * 1000;
  return new Date(utc).toISOString();
}

function paidTimestamp(row: PaymentLedgerRow) {
  return row.paid_at ?? row.updated_at ?? row.created_at;
}

function sumPaid(rows: PaymentLedgerRow[], fromIso: string) {
  const fromTime = new Date(fromIso).getTime();
  return rows.reduce((sum, row) => {
    const status = row.status?.toUpperCase() ?? "";
    if (!paidStatuses.has(status) || cancelledStatuses.has(status)) return sum;
    if (new Date(paidTimestamp(row)).getTime() < fromTime) return sum;
    return sum + Math.max(row.amount ?? 0, 0);
  }, 0);
}

function countPaid(rows: PaymentLedgerRow[], fromIso: string) {
  const fromTime = new Date(fromIso).getTime();
  return rows.filter((row) => {
    const status = row.status?.toUpperCase() ?? "";
    return paidStatuses.has(status) && new Date(paidTimestamp(row)).getTime() >= fromTime;
  }).length;
}

function monthlyPriceForPlan(code: OwnerPlanCode | null | undefined) {
  return ownerPlans.find((plan) => plan.code === code)?.monthlyPrice ?? 0;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminSession(request);
    const admin = getSupabaseAdmin();
    if (!admin) {
      throw new AdminApiError("Supabase 설정을 확인해 주세요.", 503);
    }

    const [ledgerResult, subscriptionsResult] = await Promise.all([
      admin
        .from("owner_payment_ledger")
        .select("payment_id, shop_id, plan_code, amount, status, paid_at, cancelled_at, updated_at, created_at")
        .order("updated_at", { ascending: false })
        .limit(2000),
      admin.from("owner_subscriptions").select("current_plan_code, subscription_status"),
    ]);

    if (ledgerResult.error && !isMissingTableError(ledgerResult.error, "owner_payment_ledger")) {
      throw new AdminApiError(ledgerResult.error.message, 500);
    }
    if (subscriptionsResult.error && !isMissingTableError(subscriptionsResult.error, "owner_subscriptions")) {
      throw new AdminApiError(subscriptionsResult.error.message, 500);
    }

    const ledgerRows = ledgerResult.error ? [] : ((ledgerResult.data ?? []) as PaymentLedgerRow[]);
    const subscriptions = subscriptionsResult.error ? [] : ((subscriptionsResult.data ?? []) as SubscriptionRow[]);
    const todayStart = kstRangeStartIso("today");
    const monthStart = kstRangeStartIso("month");
    const last30DaysStart = kstRangeStartIso("last30Days");

    const activeSubscriptions = subscriptions.filter((row) => row.subscription_status === "active" && row.current_plan_code !== "free");
    const mrr = activeSubscriptions.reduce((sum, row) => sum + monthlyPriceForPlan(row.current_plan_code), 0);

    const paidThisMonth = ledgerRows.filter((row) => {
      const status = row.status?.toUpperCase() ?? "";
      return paidStatuses.has(status) && new Date(paidTimestamp(row)).getTime() >= new Date(monthStart).getTime();
    });

    const planBreakdown = ownerPlans
      .filter((plan) => plan.code !== "free" && !plan.hidden)
      .map((plan) => {
        const rows = paidThisMonth.filter((row) => row.plan_code === plan.code);
        return {
          planCode: plan.code,
          planName: getOwnerPlanDisplayName(plan.code),
          revenue: rows.reduce((sum, row) => sum + Math.max(row.amount ?? 0, 0), 0),
          paidCount: rows.length,
          activeCount: activeSubscriptions.filter((row) => row.current_plan_code === plan.code).length,
        };
      });

    const recentPayments = ledgerRows
      .filter((row) => paidStatuses.has(row.status?.toUpperCase() ?? ""))
      .slice(0, 6)
      .map((row) => ({
        paymentId: row.payment_id,
        shopId: row.shop_id,
        planCode: row.plan_code,
        planName: getOwnerPlanDisplayName(row.plan_code),
        amount: row.amount ?? 0,
        paidAt: paidTimestamp(row),
      }));

    return NextResponse.json({
      todayRevenue: sumPaid(ledgerRows, todayStart),
      monthRevenue: sumPaid(ledgerRows, monthStart),
      last30DaysRevenue: sumPaid(ledgerRows, last30DaysStart),
      monthPaidCount: countPaid(ledgerRows, monthStart),
      activePaidSubscriptions: activeSubscriptions.length,
      expectedMonthlyRecurringRevenue: mrr,
      planBreakdown,
      recentPayments,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof AdminApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "매출 분석을 불러오지 못했습니다.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
