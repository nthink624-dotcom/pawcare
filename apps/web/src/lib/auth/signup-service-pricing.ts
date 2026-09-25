import { z } from "zod";

import type { ServicePriceGuide, ServicePriceGuideSection } from "@/components/owner-web/service-price-guide";
import {
  priceGuideV2Schema,
  type PriceGuidePhotoImportIssue,
  type PriceGuideV2,
  type PriceGuideV2Row,
} from "@/types/price-guide-photo-import";
import { priceGuideWeightBandLabel } from "@/lib/price-guide-structured-table";

export const signupPriceGuideReviewCopy = {
  label: "사진에서 읽은 임시 목록",
  supporting: "틀린 내용을 고친 뒤 저장하세요. 저장 전에는 공개되지 않습니다.",
} as const;

export const signupServicePriceSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().trim().min(1).max(80),
  detailName: z.string().trim().max(120).default(""),
  price: z.coerce.number().int().min(0).max(100_000_000),
  priceType: z.enum(["fixed", "starting"]).optional(),
  durationMinutes: z.coerce.number().int().min(5).max(1_440),
  species: z.enum(["dog", "cat", "all"]),
  breedGroup: z.string().trim().max(120).default(""),
  weightBand: z.string().trim().max(80).default(""),
  priceGuide: priceGuideV2Schema.optional(),
});

export const signupServicePricesSchema = z.array(signupServicePriceSchema).min(1).max(80);

export type SignupServicePrice = z.infer<typeof signupServicePriceSchema>;

export function normalizeSignupServicePrices(input: unknown) {
  const normalized = signupServicePricesSchema.parse(input).map((service) => ({
    ...service,
    name: service.name.trim(),
    detailName: service.detailName.trim(),
    breedGroup: service.breedGroup.trim(),
    weightBand: service.weightBand.trim(),
  }));
  const seen = new Set<string>();
  return normalized.filter((service) => {
    const key = (service.priceGuide
      ? ["price-guide-v2", service.id]
      : [service.name, service.detailName, service.species, service.breedGroup, service.weightBand, service.price, service.durationMinutes])
      .join("|")
      .toLocaleLowerCase("ko-KR");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildPriceGuideV2FromLegacySignupServices(
  services: Array<Omit<SignupServicePrice, "priceGuide">>,
  source: PriceGuideV2["source"] = "legacy",
): PriceGuideV2 {
  return priceGuideV2Schema.parse({
    schemaVersion: 2,
    source,
    overallNote: null,
    rows: services.map((service) => ({
      serviceName: service.name,
      species: service.species,
      breedNames: [],
      breedGroup: service.breedGroup || null,
      sizeClass: "unknown",
      minKg: null,
      maxKg: null,
      priceKind: "fixed",
      priceMinKrw: service.price,
      priceMaxKrw: null,
      durationMinutes: service.durationMinutes,
      note: service.detailName || null,
    })),
    surcharges: [],
    aiReview: [],
  });
}

export function buildSignupServicePriceGuide(service: SignupServicePrice) {
  if (service.priceGuide) return priceGuideV2Schema.parse(service.priceGuide);
  return buildPriceGuideV2FromLegacySignupServices([service], "manual");
}

const sizeClassLabels: Record<PriceGuideV2Row["sizeClass"], string> = {
  small: "소형",
  medium: "중형",
  large: "대형",
  "extra-large": "초대형",
  all: "전체 체급",
  unknown: "",
};

function formatWeightBand(row: PriceGuideV2Row) {
  return priceGuideWeightBandLabel(row) ?? sizeClassLabels[row.sizeClass];
}

function formatLegacyPrice(row: PriceGuideV2Row) {
  if (row.priceKind === "unknown" || row.priceMinKrw === null) return "";
  if (row.priceKind === "starting") return `${row.priceMinKrw}~`;
  if (row.priceKind === "range") {
    return row.priceMaxKrw === null ? "" : `${row.priceMinKrw}~${row.priceMaxKrw}`;
  }
  return String(row.priceMinKrw);
}

export type PriceGuideV2Compatibility = {
  guide: ServicePriceGuide;
  services: SignupServicePrice[];
  issues: PriceGuidePhotoImportIssue[];
  storageValidation: PriceGuideV2StorageValidation;
};

export type PriceGuideV2StorageIssueCode =
  | "SERVICE_NAME_REQUIRED"
  | "PRICE_REQUIRED"
  | "DURATION_REQUIRED"
  | "SPECIES_REQUIRED"
  | "SIZE_CLASS_REQUIRED"
  | "LEGACY_COMPATIBILITY_INVALID"
  | "SERVICE_LIMIT_EXCEEDED";

export type PriceGuideV2StorageIssue = {
  rowIndex: number;
  code: PriceGuideV2StorageIssueCode;
};

export type PriceGuideV2StorageValidation = {
  complete: boolean;
  canonicalRowCount: number;
  mappedRowCount: number;
  issues: PriceGuideV2StorageIssue[];
};

const maxSignupServiceRows = 80;

function getStorageRowIssueCodes(row: PriceGuideV2Row): PriceGuideV2StorageIssueCode[] {
  const codes: PriceGuideV2StorageIssueCode[] = [];
  if (!row.serviceName) codes.push("SERVICE_NAME_REQUIRED");
  if (row.priceKind === "unknown" || row.priceMinKrw === null) codes.push("PRICE_REQUIRED");
  if (row.durationMinutes === null || row.durationMinutes < 5) codes.push("DURATION_REQUIRED");
  if (row.species === "unknown") codes.push("SPECIES_REQUIRED");
  if (row.sizeClass === "unknown") codes.push("SIZE_CLASS_REQUIRED");
  return codes;
}

function projectPriceGuideV2StorageRows(document: PriceGuideV2) {
  const services: SignupServicePrice[] = [];
  const issues: PriceGuideV2StorageIssue[] = [];

  document.rows.forEach((row, index) => {
    const rowIssues = getStorageRowIssueCodes(row);
    if (rowIssues.length > 0) {
      issues.push(...rowIssues.map((code) => ({ rowIndex: index, code })));
      return;
    }
    if (services.length >= maxSignupServiceRows) {
      issues.push({ rowIndex: index, code: "SERVICE_LIMIT_EXCEEDED" });
      return;
    }

    const service = signupServicePriceSchema.safeParse({
      id: `photo-${index + 1}`,
      name: row.serviceName!,
      detailName: row.note ?? "",
      price: row.priceMinKrw!,
      priceType: row.priceKind === "fixed" ? "fixed" : "starting",
      durationMinutes: row.durationMinutes!,
      species: row.species as SignupServicePrice["species"],
      breedGroup: row.breedGroup ?? "",
      weightBand: formatWeightBand(row),
      priceGuide: document,
    });
    if (!service.success) {
      issues.push({ rowIndex: index, code: "LEGACY_COMPATIBILITY_INVALID" });
      return;
    }
    services.push(service.data);
  });

  return {
    services,
    storageValidation: {
      complete: issues.length === 0 && services.length === document.rows.length,
      canonicalRowCount: document.rows.length,
      mappedRowCount: services.length,
      issues,
    } satisfies PriceGuideV2StorageValidation,
  };
}

export function validatePriceGuideV2StorageCompatibility(input: PriceGuideV2): PriceGuideV2StorageValidation {
  const document = priceGuideV2Schema.parse(input);
  return projectPriceGuideV2StorageRows(document).storageValidation;
}

/**
 * The only V2-to-legacy adapter. `document` remains authoritative; compatibility
 * values are projections for clients that have not migrated to PriceGuideV2 yet.
 */
export function buildPriceGuideV2Compatibility(input: PriceGuideV2): PriceGuideV2Compatibility {
  const document = priceGuideV2Schema.parse(input);
  const sections: ServicePriceGuideSection[] = document.rows.map((row, index) => {
    const weightBand = formatWeightBand(row);
    return {
      id: `price_guide_v2_section_${index + 1}`,
      ...(row.species === "dog" || row.species === "cat" ? { species: row.species } : {}),
      title: row.breedGroup ?? row.serviceName ?? "",
      note: [row.breedNames.join(", "), row.note].filter(Boolean).join(" · "),
      weightBands: [weightBand],
      items: [{
        id: `price_guide_v2_item_${index + 1}`,
        label: row.serviceName ?? "",
        cells: {
          [weightBand]: {
            price: formatLegacyPrice(row),
            durationMinutes: row.durationMinutes === null ? "" : String(row.durationMinutes),
          },
        },
      }],
    };
  });

  const storageProjection = projectPriceGuideV2StorageRows(document);

  const issues = document.aiReview.map((review) => ({
    path: `${review.targetId} / ${review.field}`,
    message: review.rawText || "원본 값을 확인해 주세요.",
    confidence: review.confidence,
  }));

  return {
    guide: {
      enabled: true,
      weightBands: sections[0]?.weightBands ?? [],
      items: [],
      sections,
      extraNote: document.overallNote ?? "",
      extraFees: document.surcharges.map((surcharge, index) => ({
        id: `price_guide_v2_fee_${index + 1}`,
        label: surcharge.condition ?? surcharge.note ?? "",
        price: surcharge.amountKrw !== null
          ? String(surcharge.amountKrw)
          : surcharge.percent !== null
            ? `${surcharge.percent}%`
            : "",
      })),
    },
    services: storageProjection.services,
    issues,
    storageValidation: storageProjection.storageValidation,
  };
}

export function readPriceGuideV2(
  input: unknown,
  legacyService?: Omit<SignupServicePrice, "priceGuide">,
) {
  const current = priceGuideV2Schema.safeParse(input);
  if (current.success) return current.data;
  if (!legacyService) return null;
  return priceGuideV2Schema.parse({
    ...buildSignupServicePriceGuide(legacyService),
    source: "legacy",
  });
}
