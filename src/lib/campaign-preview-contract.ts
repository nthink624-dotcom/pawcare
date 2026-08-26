import { CAMPAIGN_EVENT_NAMES, CAMPAIGN_SOURCE_CHANNELS, type CampaignConsentState, type CampaignEventName, type CampaignPreviewEvent, type CampaignSourceChannel } from "@/types/campaign-preview";

export const CAMPAIGN_PREVIEW_POLICY = Object.freeze({
  personalInformationControllerStatus: "pending",
  retentionPeriodStatus: "pending",
  processorStatus: "pending",
  storageCountryStatus: "pending",
  lawfulUseBasisStatus: "policy_review_pending",
  formPublishable: false,
  formSubmissionEnabled: false,
  protectedStorageEnabled: false,
  externalAnalyticsEnabled: false,
  pixelEnabled: false,
  webhookEnabled: false,
  marketingDmEnabled: false,
  emailSendEnabled: false,
  smsSendEnabled: false,
  suppressionMutationEnabled: false,
  randomAssignmentEnabled: false,
  externalExecution: false,
});

export const DEFAULT_CAMPAIGN_CONSENT: CampaignConsentState = Object.freeze({
  accountAdvertisingUseOptIn: false,
  instagramAdDmReceiveOptIn: false,
  caseStudyUseOptIn: false,
  caseStudyEditingStatus: "not_requested",
  caseStudyReapprovalStatus: "not_requested",
  caseStudyWithdrawalStatus: "available",
});

export const PLATFORM_DELIVERY_ELIGIBILITY = "not_evaluated" as const;

export function isCampaignSourceChannel(value: string): value is CampaignSourceChannel {
  return CAMPAIGN_SOURCE_CHANNELS.includes(value as CampaignSourceChannel);
}

export function createCampaignPreviewEvent(eventName: CampaignEventName, sourceChannel: CampaignSourceChannel): CampaignPreviewEvent {
  if (!CAMPAIGN_EVENT_NAMES.includes(eventName) || !isCampaignSourceChannel(sourceChannel)) throw new Error("허용되지 않은 캠페인 이벤트입니다.");
  return { eventName, sourceChannel, creativeVariant: "approved_single_title_r1", funnelUnit: "session", shopLinkage: "none", externalAnalyticsSent: false };
}

