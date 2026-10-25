import { notFound } from "next/navigation";

import MobilePricePhotoRegistrationPreview from "@/components/auth/mobile-price-photo-registration-preview";

export default function PricePhotoRegistrationPreviewPage() {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") notFound();
  return <MobilePricePhotoRegistrationPreview />;
}
