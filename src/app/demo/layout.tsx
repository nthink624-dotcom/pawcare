import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { getSupabaseServerRuntimeStage } from "@/lib/server-env";

export default function DemoLayout({ children }: { children: ReactNode }) {
  if (getSupabaseServerRuntimeStage() === "production") {
    notFound();
  }

  return children;
}
