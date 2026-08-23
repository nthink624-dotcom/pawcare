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
  oneLineSummary: z.string().trim().min(1).max(280),
  treatmentSummary: z.string().trim().min(1).max(800),
  conditionSummary: z.string().trim().max(800).default(""),
  groomingResponse: z.string().trim().max(500).default(""),
  homeCareTips: z.array(z.string().trim().min(1).max(240)).max(4).default([]),
  nextVisitGuide: z.string().trim().max(300).default(""),
});

export const careReportGenerationInputSchema = z.object({
  shopId: z.string().trim().min(1).max(120),
  appointmentId: z.string().trim().min(1).max(120),
  observations: careReportObservationsSchema,
  voiceTranscript: z.string().trim().max(4000).default(""),
  currentDraft: careReportDraftSchema.optional(),
  photoConsent: z.boolean().default(false),
  currentWeightKg: z.number().min(0.1).max(200).optional(),
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
