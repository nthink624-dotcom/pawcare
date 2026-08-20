import { z } from "zod";

const shortObservationSchema = z.string().trim().min(1).max(80);

export const careReportObservationsSchema = z.object({
  coat: z.array(shortObservationSchema).max(8).default([]),
  skin: z.array(shortObservationSchema).max(8).default([]),
  ears: z.array(shortObservationSchema).max(8).default([]),
  pawsAndNails: z.array(shortObservationSchema).max(8).default([]),
  groomingResponse: z.array(shortObservationSchema).max(8).default([]),
  customNote: z.string().trim().max(1000).default(""),
});

export const careReportDraftSchema = z.object({
  oneLineSummary: z.string().trim().min(1).max(160),
  treatmentSummary: z.string().trim().min(1).max(800),
  conditionSummary: z.string().trim().min(1).max(800),
  groomingResponse: z.string().trim().min(1).max(500),
  homeCareTips: z.array(z.string().trim().min(1).max(240)).min(1).max(4),
  nextVisitGuide: z.string().trim().min(1).max(300),
});

export const careReportGenerationInputSchema = z.object({
  shopId: z.string().trim().min(1).max(120),
  appointmentId: z.string().trim().min(1).max(120),
  observations: careReportObservationsSchema,
  voiceTranscript: z.string().trim().max(4000).default(""),
  photoConsent: z.boolean().default(false),
});

export type CareReportObservations = z.infer<typeof careReportObservationsSchema>;
export type CareReportDraft = z.infer<typeof careReportDraftSchema>;
export type CareReportGenerationInput = z.infer<typeof careReportGenerationInputSchema>;

export type CareReportGenerationUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  promptCacheHitTokens: number;
  promptCacheMissTokens: number;
};
