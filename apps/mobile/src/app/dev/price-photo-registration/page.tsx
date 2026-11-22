import { notFound } from "next/navigation";

import MobilePricePhotoRegistrationPreview from "@/components/auth/mobile-price-photo-registration-preview";

export default async function PricePhotoRegistrationPreviewPage({ searchParams }: { searchParams: Promise<{ setup?: string }> }) {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") notFound();
  const params = await searchParams;
  return <MobilePricePhotoRegistrationPreview setupFlow={params.setup === "1"} />;
}
