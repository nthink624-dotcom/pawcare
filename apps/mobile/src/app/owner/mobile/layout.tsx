import type { ReactNode } from "react";

// Public UI only: the browser resolves authentication and records through the
// protected API. CDN delivery also serves WebViews without service workers.
export const dynamic = "force-static";

export default function OwnerMobileLayout({ children }: { children: ReactNode }) {
  return children;
}
