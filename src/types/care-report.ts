import { z } from "zod";

const shortObservationSchema = z.string().trim().min(1).max(80);

export const careReportFactCategorySchema = z.enum([
  "general",
  "condition",
  "skin_ears",
  "behavior",
  "special",
]);

export const careReportSourceFactSchema = z.object({
  id: z.string().trim().regex(/^fact-[a-z0-9-]{1,48}$/),
  category: careReportFactCategorySchema,
  text: z.string().trim().min(1).max(1000),
  source: z.enum(["note", "chip"]),
});

export const careReportGenerationMetadataSchema = z.object({
  schemaVersion: z.literal("care-report-v2"),
  promptVersion: z.literal("care-report-facts-v2"),
  model: z.string().trim().min(1).max(120),
  generationId: z.string().trim().regex(/^generation-[a-z0-9-]{1,64}$/),
  inputHash: z.string().trim().regex(/^[a-f0-9]{64}$/),
});

export const careReportSourceFactCitationSchema = z.object({
  field: z.enum(["oneLineSummary", "conditionSummary", "groomingResponse", "homeCareTips"]),
  sentence: z.string().trim().min(1).max(400),
  sourceFactIds: z.array(z.string().trim().regex(/^fact-[a-z0-9-]{1,48}$/)).min(1).max(6),
});

export const careReportObservationsSchema = z.object({
  coat: z.array(shortObservationSchema).max(8).default([]),
  skin: z.array(shortObservationSchema).max(8).default([]),
  ears: z.array(shortObservationSchema).max(8).default([]),
  pawsAndNails: z.array(shortObservationSchema).max(8).default([]),
  groomingResponse: z.array(shortObservationSchema).max(8).default([]),
  customNote: z.string().trim().max(1000).default(""),
  sourceFacts: z.array(careReportSourceFactSchema).max(6).default([]),
  sourceFactCitations: z.array(careReportSourceFactCitationSchema).max(12).default([]),
  sourceVersion: z.literal("care-report-v2").optional(),
  generation: careReportGenerationMetadataSchema.optional(),
  saveRequestId: z.string().trim().regex(/^save-[a-z0-9-]{1,64}$/).optional(),
  savePayloadFingerprint: z.string().trim().regex(/^[a-f0-9]{64}$/).optional(),
});

export const careReportDraftSchema = z.object({
  oneLineSummary: z.string().trim().min(1).max(400),
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
  clientGenerationId: z.string().trim().regex(/^generation-[a-z0-9-]{1,64}$/).optional(),
});

export const careReportGeneratedResponseSchema = careReportDraftSchema.extend({
  sourceFactIds: z.array(z.string().trim().regex(/^fact-[a-z0-9-]{1,48}$/)).max(6).default([]),
  sourceFactCitations: z.array(careReportSourceFactCitationSchema).max(12).default([]),
});

export type CareReportObservations = z.infer<typeof careReportObservationsSchema>;
export type CareReportDraft = z.infer<typeof careReportDraftSchema>;
export type CareReportGenerationInput = z.infer<typeof careReportGenerationInputSchema>;
export type CareReportSourceFact = z.infer<typeof careReportSourceFactSchema>;
export type CareReportSourceFactCitation = z.infer<typeof careReportSourceFactCitationSchema>;
export type CareReportGenerationMetadata = z.infer<typeof careReportGenerationMetadataSchema>;

export type CareReportGenerationUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  promptCacheHitTokens: number;
  promptCacheMissTokens: number;
};
