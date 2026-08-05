import { getSupabaseAdmin } from "@/lib/supabase/server";
import type {
  PriceRecommendation,
  ProfitabilityPayload,
  ProfitabilityRange,
  SegmentProfitabilityMetric,
  ServiceProfitabilityMetric,
  StaffProfitabilityMetric,
} from "@/types/profitability";

const MIN_RECOMMENDATION_SAMPLE_SIZE = 3;
const RANGE_DAYS: Record<ProfitabilityRange, number> = { "30d": 30, "90d": 90, "365d": 365 };

export type ProfitabilityObservation = {
  id: string;
  serviceId: string;
  serviceName: string;
  staffId: string | null;
  staffName: string;
  breed: string;
  weightKg: number | null;
  expectedMinutes: number | null;
  actualMinutes: number | null;
  grossRevenue: number;
  discountAmount: number;
  netRevenue: number;
};

type GroomingRecordRow = {
  id: string;
  appointment_id: string | null;
  pet_id: string;
  service_id: string;
  staff_id: string | null;
  groomed_at: string;
  price_paid: number | null;
  actual_duration_minutes: number | null;
  expected_duration_minutes?: number | null;
  original_price?: number | null;
  discount_amount?: number | null;
  pet_breed_snapshot?: string | null;
  pet_weight_snapshot?: number | string | null;
  service_name_snapshot?: string | null;
};

type AppointmentRow = {
  id: string;
  start_at: string;
  end_at: string;
  original_service_price: number | null;
  discount_amount: number | null;
  final_service_price: number | null;
};

type RevenueRow = {
  grooming_record_id: string | null;
  gross_amount: number;
  discount_amount: number;
  net_amount: number;
  status: string;
};

function safeNumber(value: unknown, fallback = 0) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nullablePositive(value: unknown) {
  const number = safeNumber(value, 0);
  return number > 0 ? number : null;
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundMetric(value: number | null, digits = 0) {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function hourlyRevenue(amount: number, minutes: number) {
  return minutes > 0 ? Math.round((amount * 60) / minutes) : null;
}

function benchmarkGapPercent(value: number | null, benchmark: number | null) {
  if (value === null || benchmark === null || benchmark <= 0) return null;
  return Math.round(((value - benchmark) / benchmark) * 100);
}

function weightLabel(weightKg: number | null) {
  return weightKg && weightKg > 0 ? `${Math.round(weightKg)}kg` : "체중 미입력";
}

function observationDelay(observation: ProfitabilityObservation) {
  if (!observation.actualMinutes || !observation.expectedMinutes) return null;
  return observation.actualMinutes - observation.expectedMinutes;
}

function buildServiceMetrics(observations: ProfitabilityObservation[], benchmark: number | null) {
  const groups = new Map<string, ProfitabilityObservation[]>();
  for (const observation of observations) {
    groups.set(observation.serviceId, [...(groups.get(observation.serviceId) ?? []), observation]);
  }

  return Array.from(groups.values())
    .map<ServiceProfitabilityMetric>((rows) => {
      const timed = rows.filter((row) => row.actualMinutes && row.actualMinutes > 0);
      const expected = rows.map((row) => row.expectedMinutes).filter((value): value is number => Boolean(value && value > 0));
      const delays = rows.map(observationDelay).filter((value): value is number => value !== null);
      const netRevenue = rows.reduce((sum, row) => sum + row.netRevenue, 0);
      const grossRevenue = rows.reduce((sum, row) => sum + row.grossRevenue, 0);
      const actualMinutes = timed.reduce((sum, row) => sum + (row.actualMinutes ?? 0), 0);
      const metricHourlyRevenue = hourlyRevenue(netRevenue, actualMinutes);

      return {
        serviceId: rows[0].serviceId,
        serviceName: rows[0].serviceName,
        completedCount: rows.length,
        timedCount: timed.length,
        averageExpectedMinutes: roundMetric(average(expected)),
        averageActualMinutes: roundMetric(average(timed.map((row) => row.actualMinutes ?? 0))),
        averageDelayMinutes: roundMetric(average(delays)),
        delayedRate: delays.length ? Math.round((delays.filter((delay) => delay >= 10).length / delays.length) * 100) : null,
        grossRevenue,
        discountAmount: rows.reduce((sum, row) => sum + row.discountAmount, 0),
        netRevenue,
        hourlyRevenue: metricHourlyRevenue,
        originalHourlyRevenue: hourlyRevenue(grossRevenue, actualMinutes),
        benchmarkGapPercent: benchmarkGapPercent(metricHourlyRevenue, benchmark),
      };
    })
    .sort((left, right) => (left.hourlyRevenue ?? Number.MAX_SAFE_INTEGER) - (right.hourlyRevenue ?? Number.MAX_SAFE_INTEGER));
}

function buildSegmentMetrics(observations: ProfitabilityObservation[], benchmark: number | null) {
  const groups = new Map<string, ProfitabilityObservation[]>();
  for (const observation of observations) {
    const key = [observation.breed || "품종 미입력", weightLabel(observation.weightKg), observation.serviceName].join("|");
    groups.set(key, [...(groups.get(key) ?? []), observation]);
  }

  return Array.from(groups.entries())
    .map<SegmentProfitabilityMetric>(([key, rows]) => {
      const timed = rows.filter((row) => row.actualMinutes && row.actualMinutes > 0);
      const expected = rows.map((row) => row.expectedMinutes).filter((value): value is number => Boolean(value && value > 0));
      const delays = rows.map(observationDelay).filter((value): value is number => value !== null);
      const netRevenue = rows.reduce((sum, row) => sum + row.netRevenue, 0);
      const actualMinutes = timed.reduce((sum, row) => sum + (row.actualMinutes ?? 0), 0);
      const segmentHourlyRevenue = hourlyRevenue(netRevenue, actualMinutes);

      return {
        key,
        breed: rows[0].breed || "품종 미입력",
        weightLabel: weightLabel(rows[0].weightKg),
        serviceName: rows[0].serviceName,
        completedCount: rows.length,
        averageExpectedMinutes: roundMetric(average(expected)),
        averageActualMinutes: roundMetric(average(timed.map((row) => row.actualMinutes ?? 0))),
        averageDelayMinutes: roundMetric(average(delays)),
        netRevenue,
        hourlyRevenue: segmentHourlyRevenue,
        benchmarkGapPercent: benchmarkGapPercent(segmentHourlyRevenue, benchmark),
      };
    })
    .sort((left, right) => {
      if (right.completedCount !== left.completedCount) return right.completedCount - left.completedCount;
      return (left.hourlyRevenue ?? Number.MAX_SAFE_INTEGER) - (right.hourlyRevenue ?? Number.MAX_SAFE_INTEGER);
    });
}

function buildStaffMetrics(observations: ProfitabilityObservation[]) {
  const groups = new Map<string, ProfitabilityObservation[]>();
  for (const observation of observations) {
    const key = observation.staffId ?? "unassigned";
    groups.set(key, [...(groups.get(key) ?? []), observation]);
  }

  return Array.from(groups.values())
    .map<StaffProfitabilityMetric>((rows) => {
      const timed = rows.filter((row) => row.actualMinutes && row.actualMinutes > 0);
      const delays = rows.map(observationDelay).filter((value): value is number => value !== null);
      const actualWorkMinutes = timed.reduce((sum, row) => sum + (row.actualMinutes ?? 0), 0);
      const netRevenue = rows.reduce((sum, row) => sum + row.netRevenue, 0);
      return {
        staffId: rows[0].staffId,
        staffName: rows[0].staffName,
        completedCount: rows.length,
        actualWorkMinutes,
        averageDelayMinutes: roundMetric(average(delays)),
        netRevenue,
        hourlyRevenue: hourlyRevenue(netRevenue, actualWorkMinutes),
      };
    })
    .sort((left, right) => right.netRevenue - left.netRevenue);
}

function buildPriceRecommendations(
  segments: SegmentProfitabilityMetric[],
  observations: ProfitabilityObservation[],
  benchmark: number | null,
) {
  if (!benchmark || benchmark <= 0) return [];
  const observationsBySegment = new Map<string, ProfitabilityObservation[]>();
  for (const observation of observations) {
    const key = [observation.breed || "품종 미입력", weightLabel(observation.weightKg), observation.serviceName].join("|");
    observationsBySegment.set(key, [...(observationsBySegment.get(key) ?? []), observation]);
  }

  return segments
    .filter((segment) =>
      segment.completedCount >= MIN_RECOMMENDATION_SAMPLE_SIZE &&
      (segment.averageDelayMinutes ?? 0) >= 10 &&
      (segment.hourlyRevenue ?? benchmark) < benchmark * 0.9,
    )
    .map<PriceRecommendation>((segment) => {
      const rows = observationsBySegment.get(segment.key) ?? [];
      const averagePrice = rows.length ? rows.reduce((sum, row) => sum + row.netRevenue, 0) / rows.length : 0;
      const targetPrice = Math.max(
        averagePrice,
        (benchmark * (segment.averageActualMinutes ?? segment.averageExpectedMinutes ?? 0)) / 60,
      );
      const recommendedPrice = Math.ceil(targetPrice / 1000) * 1000;
      return {
        key: segment.key,
        segmentLabel: `${segment.breed} ${segment.weightLabel} · ${segment.serviceName}`,
        sampleCount: segment.completedCount,
        currentAveragePrice: Math.round(averagePrice),
        recommendedPrice,
        increasePercent: averagePrice > 0 ? Math.max(0, Math.round(((recommendedPrice - averagePrice) / averagePrice) * 100)) : 0,
        averageDelayMinutes: segment.averageDelayMinutes ?? 0,
        currentHourlyRevenue: segment.hourlyRevenue ?? 0,
        benchmarkHourlyRevenue: benchmark,
        benchmarkGapPercent: segment.benchmarkGapPercent ?? 0,
      };
    })
    .sort((left, right) => left.benchmarkGapPercent - right.benchmarkGapPercent);
}

export function buildProfitabilityPayload(params: {
  observations: ProfitabilityObservation[];
  range: ProfitabilityRange;
  from: string;
  to: string;
  generatedAt?: string;
}): ProfitabilityPayload {
  const timed = params.observations.filter((row) => row.actualMinutes && row.actualMinutes > 0);
  const actualWorkMinutes = timed.reduce((sum, row) => sum + (row.actualMinutes ?? 0), 0);
  const grossRevenue = params.observations.reduce((sum, row) => sum + row.grossRevenue, 0);
  const discountAmount = params.observations.reduce((sum, row) => sum + row.discountAmount, 0);
  const netRevenue = params.observations.reduce((sum, row) => sum + row.netRevenue, 0);
  const delays = params.observations.map(observationDelay).filter((value): value is number => value !== null);
  const benchmark = hourlyRevenue(netRevenue, actualWorkMinutes);
  const services = buildServiceMetrics(params.observations, benchmark);
  const segments = buildSegmentMetrics(params.observations, benchmark);
  const staff = buildStaffMetrics(params.observations);
  const priceRecommendations = buildPriceRecommendations(segments, params.observations, benchmark);
  const insights: ProfitabilityPayload["insights"] = [];

  const leadingRecommendation = priceRecommendations[0];
  if (leadingRecommendation) {
    insights.push({
      id: `price-${leadingRecommendation.key}`,
      tone: "warning",
      title: `${leadingRecommendation.segmentLabel}은 평균 ${leadingRecommendation.averageDelayMinutes}분 더 걸리고 있습니다.`,
      description: `현재 시간당 매출은 ${leadingRecommendation.currentHourlyRevenue.toLocaleString("ko-KR")}원으로 매장 기준보다 ${Math.abs(leadingRecommendation.benchmarkGapPercent)}% 낮습니다. 표본 ${leadingRecommendation.sampleCount}건 기준 권장 가격은 ${leadingRecommendation.recommendedPrice.toLocaleString("ko-KR")}원입니다.`,
    });
  }

  const delayedService = services
    .filter((service) => service.timedCount >= MIN_RECOMMENDATION_SAMPLE_SIZE && (service.averageDelayMinutes ?? 0) >= 10)
    .sort((left, right) => (right.averageDelayMinutes ?? 0) - (left.averageDelayMinutes ?? 0))[0];
  if (delayedService) {
    insights.push({
      id: `delay-${delayedService.serviceId}`,
      tone: "opportunity",
      title: `${delayedService.serviceName}의 예상시간을 다시 맞출 필요가 있습니다.`,
      description: `평균 ${delayedService.averageActualMinutes}분이 걸려 기존 예상보다 ${delayedService.averageDelayMinutes}분 늦고, 10분 이상 지연 비율은 ${delayedService.delayedRate}%입니다.`,
    });
  }

  if (discountAmount > 0 && grossRevenue > 0) {
    const discountRate = Math.round((discountAmount / grossRevenue) * 1000) / 10;
    insights.push({
      id: "discount-impact",
      tone: "neutral",
      title: `할인으로 총 ${discountAmount.toLocaleString("ko-KR")}원이 차감됐습니다.`,
      description: `할인 전 매출 대비 ${discountRate}%이며, 시간당 수익 분석은 실제 받은 금액 ${netRevenue.toLocaleString("ko-KR")}원을 기준으로 계산했습니다.`,
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: "collect-more-data",
      tone: "neutral",
      title: "완료 기록을 더 쌓으면 가격 조정 구간을 알려드릴 수 있습니다.",
      description: `품종·체중·서비스 조합별 최소 ${MIN_RECOMMENDATION_SAMPLE_SIZE}건과 실제 시작·완료 시간이 필요합니다.`,
    });
  }

  return {
    range: params.range,
    from: params.from,
    to: params.to,
    generatedAt: params.generatedAt ?? new Date().toISOString(),
    summary: {
      completedCount: params.observations.length,
      timedCount: timed.length,
      actualWorkMinutes,
      grossRevenue,
      discountAmount,
      netRevenue,
      hourlyRevenue: benchmark,
      averageDelayMinutes: roundMetric(average(delays)),
      benchmarkHourlyRevenue: benchmark,
    },
    insights: insights.slice(0, 3),
    services,
    segments: segments.slice(0, 20),
    staff,
    priceRecommendations: priceRecommendations.slice(0, 10),
    dataQuality: {
      recordsWithoutActualTime: params.observations.filter((row) => !row.actualMinutes).length,
      recordsWithoutExpectedTime: params.observations.filter((row) => !row.expectedMinutes).length,
      minimumRecommendationSampleSize: MIN_RECOMMENDATION_SAMPLE_SIZE,
    },
  };
}

function kstDateString(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function rangeDates(range: ProfitabilityRange) {
  const to = kstDateString(new Date());
  const fromDate = new Date(`${to}T00:00:00+09:00`);
  fromDate.setUTCDate(fromDate.getUTCDate() - RANGE_DAYS[range] + 1);
  return { from: kstDateString(fromDate), to };
}

function durationBetween(startAt: string | null | undefined, endAt: string | null | undefined) {
  if (!startAt || !endAt) return null;
  const minutes = Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000);
  return minutes > 0 ? minutes : null;
}

function missingProfitabilityColumn(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? "";
  return error?.code === "42703" || error?.code === "PGRST204" || message.includes("expected_duration_minutes");
}

export async function loadProfitabilityPayload(shopId: string, range: ProfitabilityRange) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase 서버 연결을 확인할 수 없습니다.");
  const { from, to } = rangeDates(range);
  const baseRecordColumns = "id,appointment_id,pet_id,service_id,staff_id,groomed_at,price_paid,actual_duration_minutes";
  const extendedRecordColumns = `${baseRecordColumns},expected_duration_minutes,original_price,discount_amount,pet_breed_snapshot,pet_weight_snapshot,service_name_snapshot`;

  const extendedRecordsResult = await supabase
    .from("grooming_records")
    .select(extendedRecordColumns)
    .eq("shop_id", shopId)
    .gte("groomed_at", `${from}T00:00:00+09:00`)
    .lte("groomed_at", `${to}T23:59:59+09:00`)
    .order("groomed_at", { ascending: false })
    .limit(5000);

  let recordRows: unknown[] = [];
  if (extendedRecordsResult.error && missingProfitabilityColumn(extendedRecordsResult.error)) {
    const fallbackRecordsResult = await supabase
      .from("grooming_records")
      .select(baseRecordColumns)
      .eq("shop_id", shopId)
      .gte("groomed_at", `${from}T00:00:00+09:00`)
      .lte("groomed_at", `${to}T23:59:59+09:00`)
      .order("groomed_at", { ascending: false })
      .limit(5000);
    if (fallbackRecordsResult.error) throw new Error(fallbackRecordsResult.error.message);
    recordRows = fallbackRecordsResult.data ?? [];
  } else {
    if (extendedRecordsResult.error) throw new Error(extendedRecordsResult.error.message);
    recordRows = extendedRecordsResult.data ?? [];
  }

  const [appointmentsResult, petsResult, servicesResult, staffResult, revenueResult] = await Promise.all([
    supabase
      .from("appointments")
      .select("id,start_at,end_at,original_service_price,discount_amount,final_service_price")
      .eq("shop_id", shopId)
      .gte("appointment_date", from)
      .lte("appointment_date", to)
      .limit(5000),
    supabase.from("pets").select("id,breed,weight").eq("shop_id", shopId).limit(5000),
    supabase.from("services").select("id,name,duration_minutes").eq("shop_id", shopId).limit(1000),
    supabase.from("staff_members").select("id,name,display_name").eq("shop_id", shopId).limit(1000),
    supabase
      .from("shop_revenue_entries")
      .select("grooming_record_id,gross_amount,discount_amount,net_amount,status")
      .eq("shop_id", shopId)
      .gte("entry_date", from)
      .lte("entry_date", to)
      .limit(5000),
  ]);

  for (const result of [appointmentsResult, petsResult, servicesResult, staffResult, revenueResult]) {
    if (result.error) throw new Error(result.error.message);
  }

  const appointments = new Map((appointmentsResult.data ?? []).map((row) => [row.id, row as AppointmentRow]));
  const pets = new Map((petsResult.data ?? []).map((row) => [row.id, row]));
  const services = new Map((servicesResult.data ?? []).map((row) => [row.id, row]));
  const staff = new Map((staffResult.data ?? []).map((row) => [row.id, row]));
  const revenue = new Map(
    (revenueResult.data ?? [])
      .filter((row) => !["cancelled", "void"].includes(row.status))
      .map((row) => [row.grooming_record_id, row as RevenueRow]),
  );

  const observations = (recordRows as GroomingRecordRow[]).map<ProfitabilityObservation>((record) => {
    const appointment = record.appointment_id ? appointments.get(record.appointment_id) : undefined;
    const pet = pets.get(record.pet_id);
    const service = services.get(record.service_id);
    const staffMember = record.staff_id ? staff.get(record.staff_id) : undefined;
    const revenueRow = revenue.get(record.id);
    const appointmentExpected = durationBetween(appointment?.start_at, appointment?.end_at);
    const expectedMinutes = nullablePositive(record.expected_duration_minutes) ?? appointmentExpected ?? nullablePositive(service?.duration_minutes);
    const discount = Math.max(0, safeNumber(record.discount_amount ?? appointment?.discount_amount ?? revenueRow?.discount_amount));
    const net = Math.max(0, safeNumber(revenueRow?.net_amount ?? record.price_paid ?? appointment?.final_service_price));
    const gross = Math.max(net + discount, safeNumber(record.original_price ?? appointment?.original_service_price ?? revenueRow?.gross_amount, net + discount));

    return {
      id: record.id,
      serviceId: record.service_id,
      serviceName: record.service_name_snapshot?.trim() || service?.name || "서비스 미입력",
      staffId: record.staff_id ?? null,
      staffName: staffMember?.display_name?.trim() || staffMember?.name || "담당 미지정",
      breed: record.pet_breed_snapshot?.trim() || pet?.breed || "품종 미입력",
      weightKg: nullablePositive(record.pet_weight_snapshot) ?? nullablePositive(pet?.weight),
      expectedMinutes,
      actualMinutes: nullablePositive(record.actual_duration_minutes),
      grossRevenue: gross,
      discountAmount: Math.min(discount, gross),
      netRevenue: net,
    };
  });

  return buildProfitabilityPayload({ observations, range, from, to });
}

export function buildDemoProfitabilityPayload(range: ProfitabilityRange) {
  const { from, to } = rangeDates(range);
  const demo: ProfitabilityObservation[] = [
    ...Array.from({ length: 5 }, (_, index) => ({
      id: `maltese-${index}`,
      serviceId: "full-groom",
      serviceName: "전체 미용",
      staffId: "staff-owner",
      staffName: "정우진",
      breed: "말티즈",
      weightKg: 6.1,
      expectedMinutes: 90,
      actualMinutes: 108 + index * 2,
      grossRevenue: 70000,
      discountAmount: index === 0 ? 5000 : 0,
      netRevenue: index === 0 ? 65000 : 70000,
    })),
    ...Array.from({ length: 4 }, (_, index) => ({
      id: `poodle-${index}`,
      serviceId: "bath-cut",
      serviceName: "목욕 + 부분정리",
      staffId: "staff-assistant",
      staffName: "김민지",
      breed: "토이푸들",
      weightKg: 4.2,
      expectedMinutes: 70,
      actualMinutes: 68 + index * 2,
      grossRevenue: 60000,
      discountAmount: 0,
      netRevenue: 60000,
    })),
    ...Array.from({ length: 3 }, (_, index) => ({
      id: `pomeranian-${index}`,
      serviceId: "bath",
      serviceName: "목욕",
      staffId: "staff-assistant",
      staffName: "김민지",
      breed: "포메라니안",
      weightKg: 5.3,
      expectedMinutes: 60,
      actualMinutes: 62 + index,
      grossRevenue: 50000,
      discountAmount: index === 2 ? 5000 : 0,
      netRevenue: index === 2 ? 45000 : 50000,
    })),
  ];
  return buildProfitabilityPayload({ observations: demo, range, from, to });
}
