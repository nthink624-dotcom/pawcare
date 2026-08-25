export type MarketingKpiAvailability = "ready" | "partial" | "unavailable";

export type MarketingKpiOperationalSourceState = "measured" | "unavailable";

export type MarketingKpiAcquisitionState = "not_instrumented";

export type MarketingKpiEnvironment = "development" | "production" | "unknown";

export type MarketingKpiPeriod = {
  signupCompleted: number | null;
  activatedShops: number | null;
  paidConversions: number | null;
  signupToActivationRate: number | null;
  signupToPaidRate: number | null;
};

export type MarketingKpiSnapshot = {
  checkedAt: string;
  availability: MarketingKpiAvailability;
  source: {
    kind: "supabase-operational";
    environment: MarketingKpiEnvironment;
  };
  range: {
    days: number;
    timeZone: "Asia/Seoul";
    current: {
      from: string;
      to: string;
    };
    previous: {
      from: string;
      to: string;
    };
  };
  sources: {
    signups: MarketingKpiOperationalSourceState;
    appointments: MarketingKpiOperationalSourceState;
    subscriptionPayments: MarketingKpiOperationalSourceState;
  };
  acquisition: {
    landingVisitors: {
      state: MarketingKpiAcquisitionState;
      value: null;
    };
    ctaClicks: {
      state: MarketingKpiAcquisitionState;
      value: null;
    };
    attribution: {
      state: MarketingKpiAcquisitionState;
    };
  };
  current: MarketingKpiPeriod;
  previous: MarketingKpiPeriod;
  changes: {
    signupCompletedPercent: number | null;
    activatedShopsPercent: number | null;
    paidConversionsPercent: number | null;
  };
  definitions: {
    signupCompleted: string;
    activatedShop: string;
    paidConversion: string;
  };
  warnings: string[];
};
