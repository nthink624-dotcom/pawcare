import { z } from "zod";

export const careReportTextSchema = z.string().trim().min(1).max(4000);

/** The only writable care-report result contract. */
export const careReportDraftSchema = z.object({
  reportText: careReportTextSchema,
}).strict();

/** Read-only compatibility for reports stored before the single-text contract. */
export const legacyStructuredCareReportSchema = z.object({
  oneLineSummary: z.string().trim().max(400).default(""),
  treatmentSummary: z.string().trim().max(800).default(""),
  conditionSummary: z.string().trim().max(800).default(""),
  groomingResponse: z.string().trim().max(500).default(""),
  homeCareTips: z.array(z.string().trim().max(240)).max(4).default([]),
  nextVisitGuide: z.string().trim().max(300).default(""),
}).passthrough();

export const careReportGenerationInputSchema = z.object({
  shopId: z.string().trim().min(1).max(120),
  appointmentId: z.string().trim().min(1).max(120),
  sourceText: z.string().max(4000).default(""),
  currentReportText: z.string().max(4000).optional(),
  revisionRequest: z.string().max(1000).optional(),
  photoConsent: z.boolean().default(false),
}).superRefine((value, context) => {
  const hasSource = Boolean(value.sourceText.trim());
  const hasRevision = Boolean(value.currentReportText?.trim() && value.revisionRequest?.trim());
  if (!hasSource && !hasRevision) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["sourceText"],
      message: "케어리포트 내용을 입력해 주세요.",
    });
  }
});

export type CareReportDraft = z.infer<typeof careReportDraftSchema>;
export type LegacyStructuredCareReport = z.infer<typeof legacyStructuredCareReportSchema>;
export type CareReportGenerationInput = z.infer<typeof careReportGenerationInputSchema>;

export type CareReportGenerationUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  promptCacheHitTokens: number;
  promptCacheMissTokens: number;
};
