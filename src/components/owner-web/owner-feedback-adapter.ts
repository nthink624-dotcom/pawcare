import type { OwnerWebScreenKey } from "@/components/owner-web/owner-web-data";
import type { TesterFeedbackCategory, TesterFeedbackScreenKey } from "@/lib/tester-feedback";

export const ownerFeedbackKinds = ["inquiry", "improvement", "bug"] as const;
export type OwnerFeedbackKind = (typeof ownerFeedbackKinds)[number];

export const ownerFeedbackKindLabels: Record<OwnerFeedbackKind, string> = {
  inquiry: "문의",
  improvement: "개선 제안",
  bug: "오류",
};

const screenKeyByOwnerScreen: Record<OwnerWebScreenKey, TesterFeedbackScreenKey> = {
  schedule: "schedule",
  bookingPageManagement: "booking_page",
  bookingLink: "booking_page",
  customers: "customers",
  calendarRecords: "calendar",
  profitability: "other",
  services: "services",
  staff: "staff",
  ownerProfile: "shop_settings",
  shopInfo: "shop_settings",
  operatingHours: "shop_settings",
  benefits: "billing",
  alerts: "notifications",
  help: "other",
};

export function ownerFeedbackScreenKey(screen: OwnerWebScreenKey): TesterFeedbackScreenKey {
  return screenKeyByOwnerScreen[screen];
}

export function ownerFeedbackCategory(kind: OwnerFeedbackKind): TesterFeedbackCategory {
  return kind;
}

export function ownerFeedbackBody(value: string) {
  return value.trim();
}

export function ownerFeedbackAppVersion() {
  const value = process.env.NEXT_PUBLIC_APP_VERSION?.trim();
  return value && /^[0-9A-Za-z._+-]{1,32}$/.test(value) ? value : "web";
}

export function createOwnerFeedbackPayload(input: {
  shopId: string;
  requestId: string;
  kind: OwnerFeedbackKind;
  body: string;
  screen: OwnerWebScreenKey;
  screenshot?: OwnerFeedbackScreenshotReceipt | null;
}) {
  return {
    shopId: input.shopId,
    requestId: input.requestId,
    category: ownerFeedbackCategory(input.kind),
    body: ownerFeedbackBody(input.body),
    screenKey: ownerFeedbackScreenKey(input.screen),
    appVersion: ownerFeedbackAppVersion(),
    screenshot: input.screenshot ?? null,
  };
}

export type OwnerFeedbackScreenshotReceipt = {
  mediaAssetId: string;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  byteSize: number;
  consent: true;
};

export async function uploadOwnerFeedbackScreenshot(shopId: string, file: File): Promise<OwnerFeedbackScreenshotReceipt> {
  const { createOwnerMediaAssetFromFile } = await import("@/lib/media/owner-media-client");
  const uploaded = await createOwnerMediaAssetFromFile({ shopId }, "feedback_screenshot", file, {
    createProviderReadyVariant: false,
    providerReadyMode: "skip",
    compressionOptions: {
      maxLongEdge: 1600,
      quality: 0.82,
      targetBytes: 4 * 1024 * 1024,
    },
  });
  const contentType = uploaded.mediaAsset.content_type;
  if (contentType !== "image/jpeg" && contentType !== "image/png" && contentType !== "image/webp") {
    throw new Error("스크린샷 파일 형식을 확인해 주세요.");
  }
  return {
    mediaAssetId: uploaded.mediaAsset.id,
    contentType,
    byteSize: uploaded.mediaAsset.byte_size,
    consent: true,
  };
}
