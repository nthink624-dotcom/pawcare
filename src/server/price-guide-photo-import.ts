import { z } from "zod";

import type {
  ServicePriceGuide,
  ServicePriceGuideSection,
} from "@/components/owner-web/service-price-guide";
import { serverEnv } from "@/lib/server-env";
import type { PriceGuidePhotoImportIssue, PriceGuidePhotoImportResponse } from "@/types/price-guide-photo-import";

const openAiResponsesUrl = "https://api.openai.com/v1/responses";

const confidenceSchema = z.enum(["high", "medium", "low"]);
const extractedCellSchema = z.object({
  weightBand: z.string(),
  price: z.string(),
  durationMinutes: z.string(),
  confidence: confidenceSchema,
  issue: z.string(),
});
const extractedItemSchema = z.object({
  label: z.string(),
  cells: z.array(extractedCellSchema),
});
const extractedSectionSchema = z.object({
  species: z.enum(["dog", "cat"]),
  title: z.string(),
  breeds: z.array(z.string()),
  weightBands: z.array(z.string()),
  items: z.array(extractedItemSchema),
});
const extractedExtraFeeSchema = z.object({
  label: z.string(),
  price: z.string(),
  confidence: confidenceSchema,
  issue: z.string(),
});
const extractionSchema = z.object({
  summary: z.string(),
  sections: z.array(extractedSectionSchema),
  extraFees: z.array(extractedExtraFeeSchema),
  extraNote: z.string(),
  warnings: z.array(z.string()),
});

type ExtractedPriceGuide = z.infer<typeof extractionSchema>;

const responseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "sections", "extraFees", "extraNote", "warnings"],
  properties: {
    summary: { type: "string" },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["species", "title", "breeds", "weightBands", "items"],
        properties: {
          species: { type: "string", enum: ["dog", "cat"] },
          title: { type: "string" },
          breeds: { type: "array", items: { type: "string" } },
          weightBands: { type: "array", items: { type: "string" } },
          items: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["label", "cells"],
              properties: {
                label: { type: "string" },
                cells: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["weightBand", "price", "durationMinutes", "confidence", "issue"],
                    properties: {
                      weightBand: { type: "string" },
                      price: { type: "string" },
                      durationMinutes: { type: "string" },
                      confidence: { type: "string", enum: ["high", "medium", "low"] },
                      issue: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    extraFees: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "price", "confidence", "issue"],
        properties: {
          label: { type: "string" },
          price: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          issue: { type: "string" },
        },
      },
    },
    extraNote: { type: "string" },
    warnings: { type: "array", items: { type: "string" } },
  },
} as const;

function cleanText(value: string, maxLength = 120) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cleanDigits(value: string) {
  return value.replace(/[^0-9]/g, "").slice(0, 9);
}

function cleanPrice(value: string) {
  const digits = cleanDigits(value);
  if (!digits) return "";
  return value.includes("~") || value.includes("부터") ? `${digits}~` : digits;
}

function createStableId(prefix: string, parts: Array<string | number>) {
  const body = parts
    .map((part) => String(part).toLocaleLowerCase("ko-KR").replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-|-$/g, ""))
    .filter(Boolean)
    .join("-")
    .slice(0, 100);
  return `${prefix}_${body || "item"}`;
}

function distinctText(values: string[]) {
  return [...new Set(values.map((value) => cleanText(value, 60)).filter(Boolean))];
}

export function normalizePriceGuidePhotoExtraction(extracted: ExtractedPriceGuide): Omit<PriceGuidePhotoImportResponse, "sourceMediaAssetIds" | "model"> {
  const issues: PriceGuidePhotoImportIssue[] = [];
  const sections: ServicePriceGuideSection[] = extracted.sections.flatMap((section, sectionIndex) => {
    const title = cleanText(section.title, 60) || `${section.species === "cat" ? "고양이" : "강아지"} 요금`;
    const allCellBands = section.items.flatMap((item) => item.cells.map((cell) => cell.weightBand));
    const weightBands = distinctText([...section.weightBands, ...allCellBands]);
    if (weightBands.length === 0) return [];

    const items = section.items.flatMap((item, itemIndex) => {
      const label = cleanText(item.label, 80);
      if (!label) return [];
      const cellByBand = new Map(item.cells.map((cell) => [cleanText(cell.weightBand, 60), cell]));
      return [{
        id: createStableId("photo_item", [sectionIndex, itemIndex, label]),
        label,
        cells: Object.fromEntries(weightBands.map((weightBand) => {
          const cell = cellByBand.get(weightBand);
          const price = cell ? cleanPrice(cell.price) : "";
          const durationMinutes = cell ? cleanDigits(cell.durationMinutes) : "";
          if (!cell || cell.confidence !== "high" || !price) {
            issues.push({
              path: `${title} / ${label} / ${weightBand}`,
              message: cleanText(cell?.issue || (!price ? "가격을 확인해 주세요." : "사진의 글자를 다시 확인해 주세요."), 160),
              confidence: cell?.confidence === "medium" ? "medium" : "low",
            });
          }
          return [weightBand, { price, durationMinutes }];
        })),
      }];
    });
    if (items.length === 0) return [];

    return [{
      id: createStableId("photo_section", [sectionIndex, section.species, title]),
      species: section.species,
      title,
      note: distinctText(section.breeds).join(", "),
      weightBands,
      items,
    }];
  });

  const extraFees = extracted.extraFees.flatMap((fee, index) => {
    const label = cleanText(fee.label, 80);
    if (!label) return [];
    const price = cleanPrice(fee.price);
    if (fee.confidence !== "high" || !price) {
      issues.push({
        path: `추가요금 / ${label}`,
        message: cleanText(fee.issue || "추가요금을 확인해 주세요.", 160),
        confidence: fee.confidence === "medium" ? "medium" : "low",
      });
    }
    return [{ id: createStableId("photo_fee", [index, label]), label, price }];
  });

  for (const warning of extracted.warnings) {
    const message = cleanText(warning, 160);
    if (message) issues.push({ path: "원본 전체", message, confidence: "low" });
  }

  const guide: ServicePriceGuide = {
    enabled: true,
    weightBands: sections[0]?.weightBands ?? [],
    items: [],
    sections,
    extraNote: extracted.extraNote.trim().slice(0, 2000),
    extraFees,
  };

  return {
    guide,
    summary: cleanText(extracted.summary, 240) || `요금표 ${sections.length}개 그룹을 읽었습니다.`,
    issues,
  };
}

function getResponseOutputText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const source = payload as { output_text?: unknown; output?: unknown };
  if (typeof source.output_text === "string") return source.output_text;
  if (!Array.isArray(source.output)) return "";
  for (const item of source.output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block && typeof block === "object" && typeof (block as { text?: unknown }).text === "string") {
        return (block as { text: string }).text;
      }
    }
  }
  return "";
}

export async function extractPriceGuideFromImages(imageUrls: string[]) {
  if (!serverEnv.openaiApiKey) {
    throw new Error("요금표 사진 분석 서버가 아직 연결되지 않았습니다. OPENAI_API_KEY 설정을 확인해 주세요.");
  }
  if (imageUrls.length === 0 || imageUrls.length > 5) {
    throw new Error("요금표 사진은 1장부터 5장까지 분석할 수 있습니다.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(openAiResponsesUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serverEnv.openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: serverEnv.openaiVisionModel,
        store: false,
        max_output_tokens: 8_000,
        input: [{
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                "한국 반려동물 미용실 요금표 사진을 구조화하세요.",
                "사진에 실제로 보이는 내용만 옮기고 가격, 시간, 동물종, 견종 그룹을 추측하지 마세요.",
                "표의 행과 열 관계를 보존하세요. 읽기 어렵거나 누락된 값은 빈 문자열로 두고 confidence를 low로 표시하세요.",
                "가격은 사진의 표기 그대로 숫자 또는 시작가 기호를 보존하고, 소요시간이 없으면 빈 문자열로 두세요.",
                "같은 요금표가 여러 사진에 겹쳐 보이면 중복 행을 만들지 마세요.",
              ].join("\n"),
            },
            ...imageUrls.map((imageUrl) => ({ type: "input_image", image_url: imageUrl, detail: "high" })),
          ],
        }],
        text: {
          format: {
            type: "json_schema",
            name: "pet_grooming_price_guide",
            strict: true,
            schema: responseJsonSchema,
          },
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`요금표 사진 분석에 실패했습니다. (${response.status})`);
    }
    const payload = await response.json() as unknown;
    const outputText = getResponseOutputText(payload);
    if (!outputText) throw new Error("요금표 사진에서 분석 결과를 받지 못했습니다.");
    const extracted = extractionSchema.parse(JSON.parse(outputText));
    const normalized = normalizePriceGuidePhotoExtraction(extracted);
    if ((normalized.guide.sections?.length ?? 0) === 0) {
      throw new Error("사진에서 요금표 행을 찾지 못했습니다. 더 선명한 사진으로 다시 시도해 주세요.");
    }
    return { ...normalized, model: serverEnv.openaiVisionModel };
  } finally {
    clearTimeout(timeout);
  }
}
