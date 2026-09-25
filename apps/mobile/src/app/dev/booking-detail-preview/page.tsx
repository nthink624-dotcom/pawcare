import { notFound } from "next/navigation";

import OwnerBookingDetailDevPreview from "@/components/owner/owner-booking-detail-dev-preview";

export default function OwnerBookingDetailPreviewPage() {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") notFound();
  return <OwnerBookingDetailDevPreview />;
}
