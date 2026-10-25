import type { ReactNode } from "react";

// Owner mobile depends on the authenticated browser session and must not be
// prerendered with the local development Supabase environment during release builds.
export const dynamic = "force-dynamic";

export default function OwnerMobileLayout({ children }: { children: ReactNode }) {
  return children;
}
