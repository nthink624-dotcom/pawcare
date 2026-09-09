import { NextRequest } from "next/server";
import { z } from "zod";

import {
  containsObviousSensitiveTesterFeedback,
  normalizeTesterFeedbackAppVersion,
  normalizeTesterFeedbackBody,
  TESTER_FEEDBACK_APP_VERSION_MAX_LENGTH,
  TESTER_FEEDBACK_BODY_MAX_LENGTH,
  TESTER_FEEDBACK_BODY_MIN_LENGTH,
  TESTER_FEEDBACK_SCREENSHOT_MAX_BYTES,
  testerFeedbackCategories,
  testerFeedbackScreenshotContentTypes,
  testerFeedbackScreenKeys,
} from "@/lib/tester-feedback";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";
import { submitTesterFeedback, TesterFeedbackError } from "@/server/tester-feedback";

const CORS_OPTIONS = { methods: "POST, OPTIONS" };
const requestSchema = z.object({
  shopId: z.string().trim().min(1).max(120),
  requestId: z.string().uuid(),
  category: z.enum(testerFeedbackCategories),
  body: z.string().max(TESTER_FEEDBACK_BODY_MAX_LENGTH * 2),
  screenKey: z.enum(testerFeedbackScreenKeys),
  appVersion: z.string().max(TESTER_FEEDBACK_APP_VERSION_MAX_LENGTH * 2),
  screenshot: z.object({
    mediaAssetId: z.string().uuid(),
    contentType: z.enum(testerFeedbackScreenshotContentTypes),
    byteSize: z.number().int().positive().max(TESTER_FEEDBACK_SCREENSHOT_MAX_BYTES),
    consent: z.literal(true),
  }).strict().nullable().optional(),
}).strict();

export async function POST(request: NextRequest) {
  try {
    const parsed = requestSchema.parse(await request.json());
    const owner = await requireOwnerShop(request, parsed.shopId);
    if (owner.role !== "owner" || !owner.userId) {
      throw new OwnerApiError("대표 계정에서만 한마디를 보낼 수 있습니다.", 403);
    }

    const body = normalizeTesterFeedbackBody(parsed.body);
    const appVersion = normalizeTesterFeedbackAppVersion(parsed.appVersion);
    if (body.length < TESTER_FEEDBACK_BODY_MIN_LENGTH || body.length > TESTER_FEEDBACK_BODY_MAX_LENGTH) {
      throw new OwnerApiError("내용을 2자 이상 2,000자 이하로 입력해 주세요.", 400);
    }
    if (!/^[0-9A-Za-z._+-]{1,32}$/.test(appVersion)) {
      throw new OwnerApiError("앱 버전 형식을 확인해 주세요.", 400);
    }
    if (containsObviousSensitiveTesterFeedback(body)) {
      throw new OwnerApiError("연락처, 이메일, 링크, 인증 정보는 빼고 피드백만 적어 주세요.", 400);
    }

    const result = await submitTesterFeedback({
      ownerUserId: owner.userId,
      shopId: owner.shopId,
      requestId: parsed.requestId,
      category: parsed.category,
      body,
      screenKey: parsed.screenKey,
      appVersion,
      screenshot: parsed.screenshot ?? null,
    });
    return ownerMobileCorsJson(request, result, undefined, CORS_OPTIONS);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return ownerMobileCorsJson(request, { message: "피드백 내용을 다시 확인해 주세요." }, { status: 400 }, CORS_OPTIONS);
    }
    if (error instanceof OwnerApiError || error instanceof TesterFeedbackError) {
      return ownerMobileCorsJson(request, { message: error.message }, { status: error.status }, CORS_OPTIONS);
    }
    return ownerMobileCorsJson(
      request,
      { message: "피드백을 보내지 못했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
      CORS_OPTIONS,
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return ownerMobileCorsPreflight(request, CORS_OPTIONS);
}
