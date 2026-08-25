import type { ServicePriceGuide } from "@/components/owner-web/service-price-guide";

export type PriceGuidePhotoImportIssue = {
  path: string;
  message: string;
  confidence: "medium" | "low";
};

export type PriceGuidePhotoImportResponse = {
  guide: ServicePriceGuide;
  summary: string;
  issues: PriceGuidePhotoImportIssue[];
  sourceMediaAssetIds: string[];
  model: string;
};
