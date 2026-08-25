import type {
  MarketingKpiEnvironment,
  MarketingKpiPeriod,
  MarketingKpiSnapshot,
} from "@/types/marketing-kpi";

const DAY_MS = 24 * 60 * 60 * 1_000;
const MAX_RANGE_DAYS = 30;
const INVALID_APPOINTMENT_STATUSES = new Set(["cancelled", "rejected", "noshow"]);

export type MarketingSignupRow = {
  shopId: string;
  createdAt: string;
};

export type MarketingAppointmentRow = {
  shopId: string;
  status: string;
  createdAt: string;
};

export type MarketingPaymentRow = {
  shopId: string;
  planCode: string | null;
  status: string;
  paidAt: string | null;
};

export type BuildMarketingKpiSnapshotInput = {
  now?: Date;
  days?: number;
  environment: MarketingKpiEnvironment;
  signupRows: MarketingSignupRow[] | null;
  activeShopIds: string[] | null;
  appointmentRows: MarketingAppointmentRow[] | null;
  paymentRows: MarketingPaymentRow[] | null;
};

type SignupCohort = Map<string, number>;

export function safeConversionRate(numerator: number | null, denominator: number | null) {
  if (numerator === null || denominator === null || denominator <= 0) return null;
  return roundToOneDecimal((numerator / denominator) * 100);
}

export function safePercentChange(current: number | null, previous: number | null) {
  if (current === null || previous === null || previous <= 0) return null;
  return roundToOneDecimal(((current - previous) / previous) * 100);
}

export function buildMarketingKpiSnapshot(
  input: BuildMarketingKpiSnapshotInput,
): MarketingKpiSnapshot {
  const checkedAt = normalizeNow(input.now);
  const days = normalizeDays(input.days);
  const currentTo = checkedAt.getTime();
  const currentFrom = currentTo - days * DAY_MS;
  const previousFrom = currentFrom - days * DAY_MS;
  const baseSourceReady = input.signupRows !== null && input.activeShopIds !== null;
  const appointmentSourceReady = input.appointmentRows !== null;
  const paymentSourceReady = input.paymentRows !== null;

  const cohorts = baseSourceReady
    ? buildSignupCohorts({
        rows: input.signupRows ?? [],
        activeShopIds: input.activeShopIds ?? [],
        previousFrom,
        currentFrom,
        currentTo,
      })
    : null;

  const current = buildPeriod({
    cohort: cohorts?.current ?? null,
    appointmentRows: input.appointmentRows,
    paymentRows: input.paymentRows,
    checkedAt: currentTo,
  });
  const previous = buildPeriod({
    cohort: cohorts?.previous ?? null,
    appointmentRows: input.appointmentRows,
    paymentRows: input.paymentRows,
    checkedAt: currentFrom,
  });

  const warnings: string[] = [];

  if (!baseSourceReady) {
    warnings.push("가입 또는 활성 매장 원본을 읽지 못해 운영 KPI를 집계할 수 없습니다.");
  }
  if (!appointmentSourceReady) {
    warnings.push("예약 원본을 읽지 못해 활성화 수와 활성화율을 표시하지 않습니다.");
  }
  if (!paymentSourceReady) {
    warnings.push("구독 결제 원본을 읽지 못해 유료 전환 수와 전환율을 표시하지 않습니다.");
  }
  warnings.push(
    "랜딩 방문, CTA 클릭, UTM·리퍼러는 아직 계측되지 않아 0이 아닌 미연결로 표시합니다.",
    "탈퇴로 삭제된 계정은 현재 운영 테이블만으로 과거 가입 코호트에 복원할 수 없습니다.",
    "최근·직전 코호트는 각각 자기 7일 구간의 종료 시점까지만 예약·결제를 계산합니다.",
  );

  return {
    checkedAt: checkedAt.toISOString(),
    availability: !baseSourceReady
      ? "unavailable"
      : appointmentSourceReady && paymentSourceReady
        ? "ready"
        : "partial",
    source: {
      kind: "supabase-operational",
      environment: input.environment,
    },
    range: {
      days,
      timeZone: "Asia/Seoul",
      current: {
        from: new Date(currentFrom).toISOString(),
        to: checkedAt.toISOString(),
      },
      previous: {
        from: new Date(previousFrom).toISOString(),
        to: new Date(currentFrom).toISOString(),
      },
    },
    sources: {
      signups: baseSourceReady ? "measured" : "unavailable",
      appointments: appointmentSourceReady ? "measured" : "unavailable",
      subscriptionPayments: paymentSourceReady ? "measured" : "unavailable",
    },
    acquisition: {
      landingVisitors: { state: "not_instrumented", value: null },
      ctaClicks: { state: "not_instrumented", value: null },
      attribution: { state: "not_instrumented" },
    },
    current,
    previous,
    changes: {
      signupCompletedPercent: safePercentChange(
        current.signupCompleted,
        previous.signupCompleted,
      ),
      activatedShopsPercent: safePercentChange(
        current.activatedShops,
        previous.activatedShops,
      ),
      paidConversionsPercent: safePercentChange(
        current.paidConversions,
        previous.paidConversions,
      ),
    },
    definitions: {
      signupCompleted: "조회 기간에 생성됐고 현재 삭제되지 않은 매장의 대표 가입 프로필",
      activatedShop: "같은 가입 코호트에서 가입 후 취소·거절·노쇼가 아닌 예약을 만든 매장",
      paidConversion: "같은 가입 코호트에서 가입 후 무료 요금제가 아닌 구독 결제를 완료한 매장",
    },
    warnings,
  };
}

function normalizeNow(now?: Date) {
  const resolved = now ? new Date(now) : new Date();
  return Number.isNaN(resolved.getTime()) ? new Date() : resolved;
}

function normalizeDays(days?: number) {
  if (!Number.isInteger(days) || (days ?? 0) < 1) return 7;
  return Math.min(days ?? 7, MAX_RANGE_DAYS);
}

function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function parseTimestamp(value: string | null | undefined) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function buildSignupCohorts(input: {
  rows: MarketingSignupRow[];
  activeShopIds: string[];
  previousFrom: number;
  currentFrom: number;
  currentTo: number;
}) {
  const activeShopIds = new Set(input.activeShopIds.filter(Boolean));
  const earliestSignupByShop = new Map<string, number>();

  for (const row of input.rows) {
    const shopId = row.shopId.trim();
    const createdAt = parseTimestamp(row.createdAt);
    if (!shopId || createdAt === null || !activeShopIds.has(shopId)) continue;
    if (createdAt < input.previousFrom || createdAt >= input.currentTo) continue;

    const existing = earliestSignupByShop.get(shopId);
    if (existing === undefined || createdAt < existing) {
      earliestSignupByShop.set(shopId, createdAt);
    }
  }

  const current: SignupCohort = new Map();
  const previous: SignupCohort = new Map();

  for (const [shopId, signupAt] of earliestSignupByShop) {
    if (signupAt >= input.currentFrom) {
      current.set(shopId, signupAt);
    } else {
      previous.set(shopId, signupAt);
    }
  }

  return { current, previous };
}

function buildPeriod(input: {
  cohort: SignupCohort | null;
  appointmentRows: MarketingAppointmentRow[] | null;
  paymentRows: MarketingPaymentRow[] | null;
  checkedAt: number;
}): MarketingKpiPeriod {
  if (input.cohort === null) {
    return emptyPeriod();
  }

  const signupCompleted = input.cohort.size;
  const activatedShops = input.appointmentRows
    ? countActivatedShops(input.cohort, input.appointmentRows, input.checkedAt)
    : null;
  const paidConversions = input.paymentRows
    ? countPaidConversions(input.cohort, input.paymentRows, input.checkedAt)
    : null;

  return {
    signupCompleted,
    activatedShops,
    paidConversions,
    signupToActivationRate: safeConversionRate(activatedShops, signupCompleted),
    signupToPaidRate: safeConversionRate(paidConversions, signupCompleted),
  };
}

function emptyPeriod(): MarketingKpiPeriod {
  return {
    signupCompleted: null,
    activatedShops: null,
    paidConversions: null,
    signupToActivationRate: null,
    signupToPaidRate: null,
  };
}

function countActivatedShops(
  cohort: SignupCohort,
  rows: MarketingAppointmentRow[],
  checkedAt: number,
) {
  const activatedShopIds = new Set<string>();

  for (const row of rows) {
    const shopId = row.shopId.trim();
    const signupAt = cohort.get(shopId);
    const createdAt = parseTimestamp(row.createdAt);
    const status = row.status.trim().toLowerCase();
    if (signupAt === undefined || createdAt === null || INVALID_APPOINTMENT_STATUSES.has(status)) {
      continue;
    }
    if (createdAt >= signupAt && createdAt < checkedAt) {
      activatedShopIds.add(shopId);
    }
  }

  return activatedShopIds.size;
}

function countPaidConversions(
  cohort: SignupCohort,
  rows: MarketingPaymentRow[],
  checkedAt: number,
) {
  const paidShopIds = new Set<string>();

  for (const row of rows) {
    const shopId = row.shopId.trim();
    const signupAt = cohort.get(shopId);
    const paidAt = parseTimestamp(row.paidAt);
    const planCode = row.planCode?.trim().toLowerCase() ?? null;
    const status = row.status.trim().toUpperCase();
    if (
      signupAt === undefined ||
      paidAt === null ||
      !planCode ||
      planCode === "free" ||
      status !== "PAID"
    ) {
      continue;
    }
    if (paidAt >= signupAt && paidAt < checkedAt) {
      paidShopIds.add(shopId);
    }
  }

  return paidShopIds.size;
}
