export const CAMPAIGN_EVENT_NAMES = ["landing_view", "form_start", "form_submit", "cta_click"] as const;
export const CAMPAIGN_SOURCE_CHANNELS = ["Instagram", "approved_industry_space", "owned_search_content"] as const;

export type CampaignEventName = (typeof CAMPAIGN_EVENT_NAMES)[number];
export type CampaignSourceChannel = (typeof CAMPAIGN_SOURCE_CHANNELS)[number];

export type CampaignConsentState = {
  accountAdvertisingUseOptIn: boolean;
  instagramAdDmReceiveOptIn: boolean;
  caseStudyUseOptIn: boolean;
  caseStudyEditingStatus: "not_requested";
  caseStudyReapprovalStatus: "not_requested";
  caseStudyWithdrawalStatus: "available";
};

export type CampaignPreviewEvent = {
  eventName: CampaignEventName;
  sourceChannel: CampaignSourceChannel;
  creativeVariant: "approved_single_title_r1";
  funnelUnit: "session";
  shopLinkage: "none";
  externalAnalyticsSent: false;
};

