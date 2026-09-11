import { z } from "zod";

import { normalizeOwnerPhoneNumber } from "@/lib/auth/owner-credentials";
import { OWNER_SIGNUP_TERMS_VERSION } from "@/lib/auth/owner-signup-terms";
import {
  buildPriceGuideV2Compatibility,
  buildSignupServicePriceGuide,
  normalizeSignupServicePrices,
  signupServicePriceSchema,
  signupServicePricesSchema,
  type SignupServicePrice,
} from "@/lib/auth/signup-service-pricing";
import { priceGuideV2Schema, type PriceGuideV2 } from "@/types/price-guide-photo-import";

const signupRequestSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(6),
  passwordConfirm: z.string().min(6),
  name: z.string().min(1),
  birthDate: z.string().min(8).max(8),
  phoneNumber: z.string().min(10).max(11),
  identityVerificationToken: z.string().min(1),
  shopName: z.string().min(1),
  shopPhone: z.string().min(9).max(11),
  shopAddress: z.string().min(1),
  agreements: z.object({
    service: z.boolean(),
    privacy: z.boolean(),
    location: z.boolean(),
    marketing: z.boolean(),
  }),
  termsVersion: z.literal(OWNER_SIGNUP_TERMS_VERSION),
  signupRequestId: z.string().uuid(),
  priceGuideDocument: z.unknown().optional(),
  servicePrices: z.array(signupServicePriceSchema).max(80).optional(),
});

export type SignupRequestPayload = Omit<z.infer<typeof signupRequestSchema>, "priceGuideDocument" | "servicePrices"> & {
  priceGuideDocument?: PriceGuideV2;
  servicePrices: SignupServicePrice[];
};

export type SignupPriceGuideValidationCode =
  | "SIGNUP_PRICE_GUIDE_INVALID"
  | "SIGNUP_PRICE_GUIDE_EMPTY"
  | "SIGNUP_PRICE_GUIDE_SERVICE_REQUIRED"
  | "SIGNUP_PRICE_GUIDE_SPECIES_REQUIRED"
  | "SIGNUP_PRICE_GUIDE_SIZE_REQUIRED"
  | "SIGNUP_PRICE_GUIDE_PRICE_REQUIRED"
  | "SIGNUP_PRICE_GUIDE_DURATION_REQUIRED"
  | "SIGNUP_PRICE_GUIDE_REVIEW_REQUIRED"
  | "SIGNUP_PRICE_GUIDE_STORAGE_ROW_REQUIRED";

export class SignupPriceGuideValidationError extends Error {
  public readonly status = 400;
  public readonly code: SignupPriceGuideValidationCode;

  constructor(code: SignupPriceGuideValidationCode, message: string) {
    super(message);
    this.code = code;
    this.name = "SignupPriceGuideValidationError";
  }
}

function priceGuideValidationError(
  code: SignupPriceGuideValidationCode,
  message: string,
): never {
  throw new SignupPriceGuideValidationError(code, message);
}

export function parseSignupPriceGuideDocument(input: unknown): PriceGuideV2 {
  const parsed = priceGuideV2Schema.safeParse(input);
  if (!parsed.success) {
    return priceGuideValidationError(
      "SIGNUP_PRICE_GUIDE_INVALID",
      "서비스·상세 요금 형식을 다시 확인해 주세요.",
    );
  }

  const document = parsed.data;
  if (document.rows.length === 0) {
    return priceGuideValidationError(
      "SIGNUP_PRICE_GUIDE_EMPTY",
      "서비스·상세 요금을 한 개 이상 입력해 주세요.",
    );
  }
  if (document.rows.some((row) => row.serviceName === null)) {
    return priceGuideValidationError(
      "SIGNUP_PRICE_GUIDE_SERVICE_REQUIRED",
      "모든 요금 행에 서비스명을 입력해 주세요.",
    );
  }
  if (document.rows.some((row) => row.species === "unknown")) {
    return priceGuideValidationError(
      "SIGNUP_PRICE_GUIDE_SPECIES_REQUIRED",
      "모든 요금 행의 반려동물 종류를 선택해 주세요.",
    );
  }
  if (document.rows.some((row) => row.sizeClass === "unknown")) {
    return priceGuideValidationError(
      "SIGNUP_PRICE_GUIDE_SIZE_REQUIRED",
      "모든 요금 행의 체급을 선택해 주세요.",
    );
  }
  if (document.rows.some((row) => row.priceKind === "unknown" || row.priceMinKrw === null)) {
    return priceGuideValidationError(
      "SIGNUP_PRICE_GUIDE_PRICE_REQUIRED",
      "모든 요금 행의 가격 방식과 필요한 가격을 확인해 주세요.",
    );
  }
  if (document.rows.some((row) => row.durationMinutes === null || row.durationMinutes < 5)) {
    return priceGuideValidationError(
      "SIGNUP_PRICE_GUIDE_DURATION_REQUIRED",
      "모든 요금 행에 5분 이상의 실제 소요 시간을 입력해 주세요.",
    );
  }
  if (document.aiReview.some((review) => !review.userConfirmed && !review.userCorrected)) {
    return priceGuideValidationError(
      "SIGNUP_PRICE_GUIDE_REVIEW_REQUIRED",
      "확인하지 않은 AI 판독 항목을 모두 확인하거나 수정해 주세요.",
    );
  }

  return document;
}

export function parseSignupRequestPayload(input: Record<string, unknown>): SignupRequestPayload {
  const parsed = signupRequestSchema.parse({
    ...input,
    phoneNumber: normalizeOwnerPhoneNumber(
      typeof input.phoneNumber === "string" ? input.phoneNumber : "",
    ),
    shopPhone: normalizeOwnerPhoneNumber(
      typeof input.shopPhone === "string" ? input.shopPhone : "",
    ),
  });

  if (parsed.priceGuideDocument === undefined) {
    return {
      ...parsed,
      priceGuideDocument: undefined,
      servicePrices: z.array(signupServicePriceSchema).max(80).parse(parsed.servicePrices ?? []),
    };
  }

  const priceGuideDocument = parseSignupPriceGuideDocument(parsed.priceGuideDocument);
  const compatibility = buildPriceGuideV2Compatibility(priceGuideDocument);
  if (!compatibility.storageValidation.complete) {
    return priceGuideValidationError(
      "SIGNUP_PRICE_GUIDE_STORAGE_ROW_REQUIRED",
      "저장할 수 없는 요금 행이 있습니다. 반려동물 종류와 가격을 다시 확인해 주세요.",
    );
  }

  return {
    ...parsed,
    priceGuideDocument,
    servicePrices: compatibility.services,
  };
}

export function buildSignupServiceRpcPayload(
  payload: Pick<SignupRequestPayload, "priceGuideDocument" | "servicePrices">,
  shopId: string,
) {
  const canonicalDocument = payload.priceGuideDocument
    ? priceGuideV2Schema.parse(payload.priceGuideDocument)
    : undefined;
  const services = canonicalDocument
    ? signupServicePricesSchema.parse(payload.servicePrices)
    : payload.servicePrices.length === 0
      ? []
      : normalizeSignupServicePrices(payload.servicePrices);
  if (canonicalDocument && services.length !== canonicalDocument.rows.length) {
    return priceGuideValidationError(
      "SIGNUP_PRICE_GUIDE_STORAGE_ROW_REQUIRED",
      "저장할 수 없는 요금 행이 있습니다. 반려동물 종류와 가격을 다시 확인해 주세요.",
    );
  }
  return services.map((service, index) => ({
    id: `${shopId}-svc-signup-${index + 1}`,
    name: service.name,
    price: service.price,
    duration_minutes: service.durationMinutes,
    description: [service.detailName, service.breedGroup, service.weightBand].filter(Boolean).join(" · "),
    sort_order: index + 1,
    price_guide: canonicalDocument ?? buildSignupServicePriceGuide(service),
  }));
}
