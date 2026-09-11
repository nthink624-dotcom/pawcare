import { notFound } from "next/navigation";

import { OwnerBillingProcessPreview } from "@/components/owner/owner-billing-process-preview";

export default function OwnerBillingProcessPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <OwnerBillingProcessPreview />;
}
