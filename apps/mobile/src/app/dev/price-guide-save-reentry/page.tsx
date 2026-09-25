import { notFound } from "next/navigation";

import MobilePriceGuideSaveReentryFixture from "@/components/auth/mobile-price-guide-save-reentry-fixture";

export default function PriceGuideSaveReentryFixturePage() {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") notFound();
  return <MobilePriceGuideSaveReentryFixture />;
}
