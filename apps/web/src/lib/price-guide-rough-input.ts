import type { PriceGuideV2, PriceGuideV2Row } from "@/types/price-guide-photo-import";

export type PriceGuideRoughInputField =
  | "serviceName"
  | "species"
  | "sizeClass"
  | "weight"
  | "price"
  | "durationMinutes";

export type PriceGuideRoughInputResult = {
  document: PriceGuideV2;
  recognizedFields: PriceGuideRoughInputField[];
  missingFields: Exclude<PriceGuideRoughInputField, "weight">[];
};

const MAX_PRICE_KRW = 100_000_000;
const MAX_DURATION_MINUTES = 1_440;
const MAX_KG = 1_000;
const moneyToken = String.raw`(?:\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(?:만\s*)?원`;

function validInteger(value: number, maximum: number) {
  return Number.isInteger(value) && value >= 0 && value <= maximum;
}

function parseMoney(value: string) {
  const normalized = value.replace(/[\s,원]/g, "");
  const usesManwon = normalized.includes("만");
  const amount = Number(normalized.replace("만", "")) * (usesManwon ? 10_000 : 1);
  return validInteger(amount, MAX_PRICE_KRW) ? amount : null;
}

function parseDecimal(value: string, maximum: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= maximum ? parsed : null;
}

function consumeMatch(remainder: string, match: RegExpExecArray | null) {
  if (!match || match.index === undefined) return remainder;
  return `${remainder.slice(0, match.index)} ${remainder.slice(match.index + match[0].length)}`;
}

function hasAdjacentRangeMark(value: string, match: RegExpExecArray) {
  const before = value.slice(0, match.index).trimEnd();
  const after = value.slice(match.index + match[0].length).trimStart();
  return /[~～–—-]$/.test(before) || /^[~～–—-]/.test(after);
}

function cleanServiceName(value: string) {
  const cleaned = value
    .replace(/\b(?:약|대략)\b/g, " ")
    .replace(/[|,/~～–—-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 0 && cleaned.length <= 120 ? cleaned : null;
}

/**
 * Converts only explicit Korean words and numbers into one editable PriceGuideV2 row.
 * Missing or ambiguous values intentionally stay unknown/null so the strict editor
 * validation continues to block saving until the owner confirms them.
 */
export function parsePriceGuideRoughInput(input: string): PriceGuideRoughInputResult {
  let remainder = input.normalize("NFKC").replace(/\s+/g, " ").trim();
  let species: PriceGuideV2Row["species"] = "unknown";
  let sizeClass: PriceGuideV2Row["sizeClass"] = "unknown";
  let minKg: number | null = null;
  let maxKg: number | null = null;
  let priceKind: PriceGuideV2Row["priceKind"] = "unknown";
  let priceMinKrw: number | null = null;
  let priceMaxKrw: number | null = null;
  let durationMinutes: number | null = null;
  const recognizedFields: PriceGuideRoughInputField[] = [];

  const speciesMatch = /(강아지\s*[·/+와과]\s*고양이\s*공통|고양이\s*[·/+와과]\s*강아지\s*공통|강아지|반려견|고양이|반려묘)/.exec(remainder);
  if (speciesMatch) {
    species = speciesMatch[0].includes("공통")
      ? "all"
      : /고양이|반려묘/.test(speciesMatch[0])
        ? "cat"
        : "dog";
    recognizedFields.push("species");
    remainder = consumeMatch(remainder, speciesMatch);
  }

  const sizeMatch = /(초대형견?|대형견?|중형견?|소형견?|(?:전체|전)\s*(?:체급|사이즈))/.exec(remainder);
  if (sizeMatch) {
    const value = sizeMatch[0].replace(/\s/g, "");
    sizeClass = value.includes("초대형")
      ? "extra-large"
      : value.includes("대형")
        ? "large"
        : value.includes("중형")
          ? "medium"
          : value.includes("소형")
            ? "small"
            : "all";
    recognizedFields.push("sizeClass");
    remainder = consumeMatch(remainder, sizeMatch);
  }

  const kgRangeMatch = /(\d+(?:\.\d+)?)\s*(?:~|～|–|—|-)\s*(\d+(?:\.\d+)?)\s*kg\b/i.exec(remainder);
  const kgBoundMatch = kgRangeMatch ? null : /(\d+(?:\.\d+)?)\s*kg\s*(이하|이상)/i.exec(remainder);
  const kgExactMatch = kgRangeMatch || kgBoundMatch ? null : /(\d+(?:\.\d+)?)\s*kg\b/i.exec(remainder);
  if (kgRangeMatch) {
    const minimum = parseDecimal(kgRangeMatch[1], MAX_KG);
    const maximum = parseDecimal(kgRangeMatch[2], MAX_KG);
    if (minimum !== null && maximum !== null && minimum <= maximum) {
      minKg = minimum;
      maxKg = maximum;
      recognizedFields.push("weight");
    }
    remainder = consumeMatch(remainder, kgRangeMatch);
  } else if (kgBoundMatch) {
    const value = parseDecimal(kgBoundMatch[1], MAX_KG);
    if (value !== null) {
      if (kgBoundMatch[2] === "이하") maxKg = value;
      else minKg = value;
      recognizedFields.push("weight");
    }
    remainder = consumeMatch(remainder, kgBoundMatch);
  } else if (kgExactMatch) {
    const value = parseDecimal(kgExactMatch[1], MAX_KG);
    if (value !== null && !hasAdjacentRangeMark(remainder, kgExactMatch)) {
      minKg = value;
      maxKg = value;
      recognizedFields.push("weight");
    }
    remainder = consumeMatch(remainder, kgExactMatch);
  }

  const durationRangeMatch = /(?:약\s*)?\d+(?:\.\d+)?\s*(?:~|～|–|—|-)\s*\d+(?:\.\d+)?\s*(?:시간|분)/.exec(remainder);
  if (durationRangeMatch) {
    remainder = consumeMatch(remainder, durationRangeMatch);
  } else {
    const hourMatch = /(?:약\s*)?(\d+(?:\.\d+)?)\s*시간(?:\s*(\d+)\s*분)?/.exec(remainder);
    const minuteMatch = hourMatch ? null : /(?:약\s*)?(\d+)\s*분/.exec(remainder);
    if (hourMatch) {
      const minutes = Number(hourMatch[1]) * 60 + Number(hourMatch[2] ?? 0);
      if (validInteger(minutes, MAX_DURATION_MINUTES) && minutes > 0 && !hasAdjacentRangeMark(remainder, hourMatch)) {
        durationMinutes = minutes;
        recognizedFields.push("durationMinutes");
      }
      remainder = consumeMatch(remainder, hourMatch);
    } else if (minuteMatch) {
      const minutes = Number(minuteMatch[1]);
      if (validInteger(minutes, MAX_DURATION_MINUTES) && minutes > 0 && !hasAdjacentRangeMark(remainder, minuteMatch)) {
        durationMinutes = minutes;
        recognizedFields.push("durationMinutes");
      }
      remainder = consumeMatch(remainder, minuteMatch);
    }
  }

  const fullRangeMatch = new RegExp(`(?:약\\s*)?(${moneyToken})\\s*(?:~|～|–|—|-)\\s*(${moneyToken})`).exec(remainder);
  const sharedManwonRangeMatch = fullRangeMatch
    ? null
    : /(?:약\s*)?(\d+(?:\.\d+)?)\s*(?:만\s*)?(?:~|～|–|—|-)\s*(\d+(?:\.\d+)?)\s*만\s*원?/.exec(remainder);
  if (fullRangeMatch || sharedManwonRangeMatch) {
    const minimum = fullRangeMatch ? parseMoney(fullRangeMatch[1]) : parseMoney(`${sharedManwonRangeMatch?.[1]}만원`);
    const maximum = fullRangeMatch ? parseMoney(fullRangeMatch[2]) : parseMoney(`${sharedManwonRangeMatch?.[2]}만원`);
    if (minimum !== null && maximum !== null && minimum <= maximum) {
      priceKind = "range";
      priceMinKrw = minimum;
      priceMaxKrw = maximum;
      recognizedFields.push("price");
    }
    remainder = consumeMatch(remainder, fullRangeMatch ?? sharedManwonRangeMatch);
  } else {
    const startingPrefixMatch = new RegExp(`(?:시작가|최저가)\\s*(?:약\\s*)?(${moneyToken})`).exec(remainder);
    const startingSuffixMatch = startingPrefixMatch
      ? null
      : new RegExp(`(?:약\\s*)?(${moneyToken})\\s*(?:부터|이상)`).exec(remainder);
    const fixedPrefixMatch = startingPrefixMatch || startingSuffixMatch
      ? null
      : new RegExp(`(?:정가|고정가)\\s*(?:약\\s*)?(${moneyToken})`).exec(remainder);
    const fixedSuffixMatch = startingPrefixMatch || startingSuffixMatch || fixedPrefixMatch
      ? null
      : new RegExp(`(?:약\\s*)?(${moneyToken})\\s*(?:정가|고정가)`).exec(remainder);
    const bareMoneyMatch = startingPrefixMatch || startingSuffixMatch || fixedPrefixMatch || fixedSuffixMatch
      ? null
      : new RegExp(`(?:약\\s*)?(${moneyToken})`).exec(remainder);
    const priceMatch = startingPrefixMatch ?? startingSuffixMatch ?? fixedPrefixMatch ?? fixedSuffixMatch ?? bareMoneyMatch;
    if (priceMatch) {
      const amount = parseMoney(priceMatch[1]);
      const nearbyContext = remainder.slice(Math.max(0, priceMatch.index - 8), priceMatch.index + priceMatch[0].length + 8);
      const hasIncompleteRangeIntent = hasAdjacentRangeMark(remainder, priceMatch) || /가격\s*범위|범위\s*가격/.test(nearbyContext);
      if (amount !== null && !hasIncompleteRangeIntent) {
        priceKind = startingPrefixMatch || startingSuffixMatch ? "starting" : "fixed";
        priceMinKrw = amount;
        recognizedFields.push("price");
      }
      remainder = consumeMatch(remainder, priceMatch);
    }
  }
  remainder = remainder.replace(/가격\s*범위|범위\s*가격/g, " ");

  const serviceName = cleanServiceName(remainder);
  if (serviceName) recognizedFields.unshift("serviceName");

  const row: PriceGuideV2Row = {
    serviceName,
    species,
    breedNames: [],
    breedGroup: null,
    sizeClass,
    minKg,
    maxKg,
    priceKind,
    priceMinKrw,
    priceMaxKrw,
    durationMinutes,
    note: null,
  };
  const document: PriceGuideV2 = {
    schemaVersion: 2,
    source: "manual",
    overallNote: null,
    rows: [row],
    surcharges: [],
    aiReview: [],
  };
  const missingFields: PriceGuideRoughInputResult["missingFields"] = [
    ...(!serviceName ? ["serviceName" as const] : []),
    ...(species === "unknown" ? ["species" as const] : []),
    ...(sizeClass === "unknown" ? ["sizeClass" as const] : []),
    ...(priceKind === "unknown" ? ["price" as const] : []),
    ...(durationMinutes === null ? ["durationMinutes" as const] : []),
  ];

  return { document, recognizedFields, missingFields };
}
