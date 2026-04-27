import { notFound, redirect } from "next/navigation";

import { getSupabaseServerRuntimeStage } from "@/lib/server-env";

export default function LegacyOwnerDemoPage() {
  if (getSupabaseServerRuntimeStage() === "production") {
    notFound();
  }

  redirect("/demo/owner");
}
