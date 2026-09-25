export const MARKETING_UTM_FIELDS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

export type MarketingUtmField = (typeof MARKETING_UTM_FIELDS)[number];
export type MarketingUtmValues = Partial<Record<MarketingUtmField, string>>;
export type MarketingAcquisitionSource =
  | { sourceKind: "direct"; utm: null }
  | { sourceKind: "utm"; utm: MarketingUtmValues };

export const MARKETING_UTM_MAX_LENGTH: Readonly<Record<MarketingUtmField, number>> = {
  utm_source: 64,
  utm_medium: 64,
  utm_campaign: 128,
  utm_content: 128,
  utm_term: 128,
};

export const MARKETING_ACQUISITION_EVENTS = [
  "landing_view",
  "landing_cta_click",
  "identity_verified",
  "signup_completed",
  "setup_step_completed",
  "test_booking_created",
  "activated_day_7",
  "paid_conversion",
] as const;

export type MarketingAcquisitionEventName = (typeof MARKETING_ACQUISITION_EVENTS)[number];

const SAFE_UTM_VALUE = /^[a-z0-9][a-z0-9._~-]*$/;
const EMAIL_LIKE = /[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/i;
const PHONE_LIKE = /(?:\d[ .()-]?){9,}/;
const URL_OR_MARKUP_LIKE = /(?:https?:\/\/|www\.|[<>\\/]|javascript:|data:)/i;
const ACQUISITION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class MarketingAcquisitionInputError extends Error {
  constructor(
    public readonly field: MarketingUtmField,
    message = "유입 정보를 안전하게 확인하지 못했습니다.",
  ) {
    super(message);
  }
}

function normalizeUtmValue(field: MarketingUtmField, raw: unknown) {
  if (typeof raw !== "string") throw new MarketingAcquisitionInputError(field);

  const value = raw.normalize("NFKC").trim().toLowerCase();
  if (
    value.length === 0 ||
    value.length > MARKETING_UTM_MAX_LENGTH[field] ||
    EMAIL_LIKE.test(value) ||
    PHONE_LIKE.test(value) ||
    URL_OR_MARKUP_LIKE.test(value) ||
    !SAFE_UTM_VALUE.test(value)
  ) {
    throw new MarketingAcquisitionInputError(field);
  }
  return value;
}

export function parseMarketingAcquisitionSource(input: Record<string, unknown>): MarketingAcquisitionSource {
  const utm: MarketingUtmValues = {};
  let found = false;

  for (const field of MARKETING_UTM_FIELDS) {
    if (!Object.hasOwn(input, field)) continue;
    found = true;
    utm[field] = normalizeUtmValue(field, input[field]);
  }

  return found ? { sourceKind: "utm", utm } : { sourceKind: "direct", utm: null };
}

export function isMarketingAcquisitionId(value: unknown): value is string {
  return typeof value === "string" && ACQUISITION_ID.test(value);
}

export function createOpaqueMarketingAcquisitionId(randomUuid: () => string = () => crypto.randomUUID()) {
  const value = randomUuid();
  if (!isMarketingAcquisitionId(value)) throw new Error("MARKETING_ACQUISITION_RANDOM_ID_INVALID");
  return value;
}

export function resolveImmutableFirstTouch<T>(existing: T | null, candidate: T) {
  return existing === null
    ? { value: candidate, inserted: true }
    : { value: existing, inserted: false };
}
