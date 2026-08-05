export type ProfitabilityRange = "30d" | "90d" | "365d";

export type ProfitabilityInsightTone = "opportunity" | "warning" | "neutral";

export type ProfitabilityInsight = {
  id: string;
  tone: ProfitabilityInsightTone;
  title: string;
  description: string;
};

export type ServiceProfitabilityMetric = {
  serviceId: string;
  serviceName: string;
  completedCount: number;
  timedCount: number;
  averageExpectedMinutes: number | null;
  averageActualMinutes: number | null;
  averageDelayMinutes: number | null;
  delayedRate: number | null;
  grossRevenue: number;
  discountAmount: number;
  netRevenue: number;
  hourlyRevenue: number | null;
  originalHourlyRevenue: number | null;
  benchmarkGapPercent: number | null;
};

export type SegmentProfitabilityMetric = {
  key: string;
  breed: string;
  weightLabel: string;
  serviceName: string;
  completedCount: number;
  averageExpectedMinutes: number | null;
  averageActualMinutes: number | null;
  averageDelayMinutes: number | null;
  netRevenue: number;
  hourlyRevenue: number | null;
  benchmarkGapPercent: number | null;
};

export type StaffProfitabilityMetric = {
  staffId: string | null;
  staffName: string;
  completedCount: number;
  actualWorkMinutes: number;
  averageDelayMinutes: number | null;
  netRevenue: number;
  hourlyRevenue: number | null;
};

export type PriceRecommendation = {
  key: string;
  segmentLabel: string;
  sampleCount: number;
  currentAveragePrice: number;
  recommendedPrice: number;
  increasePercent: number;
  averageDelayMinutes: number;
  currentHourlyRevenue: number;
  benchmarkHourlyRevenue: number;
  benchmarkGapPercent: number;
};

export type ProfitabilityPayload = {
  range: ProfitabilityRange;
  from: string;
  to: string;
  generatedAt: string;
  summary: {
    completedCount: number;
    timedCount: number;
    actualWorkMinutes: number;
    grossRevenue: number;
    discountAmount: number;
    netRevenue: number;
    hourlyRevenue: number | null;
    averageDelayMinutes: number | null;
    benchmarkHourlyRevenue: number | null;
  };
  insights: ProfitabilityInsight[];
  services: ServiceProfitabilityMetric[];
  segments: SegmentProfitabilityMetric[];
  staff: StaffProfitabilityMetric[];
  priceRecommendations: PriceRecommendation[];
  dataQuality: {
    recordsWithoutActualTime: number;
    recordsWithoutExpectedTime: number;
    minimumRecommendationSampleSize: number;
  };
};
