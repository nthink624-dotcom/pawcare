import { ApiRequestError, fetchApiJsonWithAuth } from "@/lib/api";
import { createOwnerMediaAssetFromFile } from "@/lib/media/owner-media-client";
import type { TesterFeedbackScreenKey } from "@/lib/tester-feedback";

export type OwnerFeedbackCategory = "inquiry" | "improvement" | "bug";
export type OwnerFeedbackScreenshotReceipt = {
  mediaAssetId: string;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  byteSize: number;
  consent: true;
};

export type OwnerFeedbackSubmission = {
  shopId: string;
  requestId: string;
  category: OwnerFeedbackCategory;
  body: string;
  screenKey: TesterFeedbackScreenKey;
  appVersion: string;
  /** Only an explicit, private screenshot receipt crosses the POST boundary. */
  screenshot?: OwnerFeedbackScreenshotReceipt | null;
};

export type OwnerFeedbackAcknowledgement = {
  id: string;
  category: OwnerFeedbackCategory;
  screenKey: TesterFeedbackScreenKey;
  appVersion: string;
  status: string;
  createdAt: string;
  replayed: boolean;
};

export type OwnerFeedbackAdapter = {
  submit(submission: OwnerFeedbackSubmission): Promise<OwnerFeedbackAcknowledgement>;
  createScreenshotReceipt?(shopId: string, file: File): Promise<OwnerFeedbackScreenshotReceipt>;
};

const acceptedScreenshotTypes = new Set<OwnerFeedbackScreenshotReceipt["contentType"]>([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;

const OWNER_FEEDBACK_RETRY_MESSAGE = "피드백을 보내지 못했습니다. 작성한 내용은 유지됐습니다. 잠시 후 다시 시도해 주세요.";

export function getOwnerFeedbackRecoveryMessage(error: unknown) {
  if (!(error instanceof ApiRequestError)) return OWNER_FEEDBACK_RETRY_MESSAGE;
  if (error.status === 400) return "입력한 내용을 확인해 주세요. 작성한 내용은 유지됐습니다.";
  if (error.status === 401) return "로그인이 만료됐습니다. 다시 로그인한 뒤 보내 주세요. 작성한 내용은 유지됐습니다.";
  if (error.status === 403) return "현재 매장의 대표 권한을 확인해 주세요. 작성한 내용은 유지됐습니다.";
  if (error.status === 404) return "피드백 접수 연결을 확인하지 못했습니다. 작성한 내용은 유지됐습니다. 잠시 후 다시 시도해 주세요.";
  if (error.status === 409) return "피드백 접수를 확인하는 중입니다. 작성한 내용은 유지됐습니다. 잠시 후 다시 시도해 주세요.";
  if (error.status === 429) return "피드백을 연속으로 많이 보냈습니다. 작성한 내용은 유지됐습니다. 잠시 후 다시 보내 주세요.";
  return OWNER_FEEDBACK_RETRY_MESSAGE;
}

/** Shared stage01 owner contract: the POST contains only its allowlisted receipt. */
export const sharedOwnerFeedbackAdapter: OwnerFeedbackAdapter = {
  async createScreenshotReceipt(shopId, file) {
    if (!acceptedScreenshotTypes.has(file.type as OwnerFeedbackScreenshotReceipt["contentType"]) || file.size > MAX_SCREENSHOT_BYTES) {
      throw new Error("스크린샷은 5MB 이하의 PNG, JPG 또는 WebP만 첨부할 수 있습니다.");
    }
    const uploaded = await createOwnerMediaAssetFromFile(
      { shopId },
      "feedback_screenshot",
      file,
      { createProviderReadyVariant: false },
    );
    const contentType = uploaded.mediaAsset.content_type;
    if (!acceptedScreenshotTypes.has(contentType as OwnerFeedbackScreenshotReceipt["contentType"])) {
      throw new Error("스크린샷 파일 형식을 확인해 주세요.");
    }
    return {
      mediaAssetId: uploaded.mediaAsset.id,
      contentType: contentType as OwnerFeedbackScreenshotReceipt["contentType"],
      byteSize: uploaded.mediaAsset.byte_size,
      consent: true,
    };
  },
  async submit(submission) {
    const result = await fetchApiJsonWithAuth<{ feedback: Omit<OwnerFeedbackAcknowledgement, "replayed">; replayed: boolean }>("/api/owner/tester-feedback", {
      method: "POST",
      body: JSON.stringify(submission),
    });
    return { ...result.feedback, replayed: result.replayed };
  },
};
