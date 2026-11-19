import type { Metadata } from "next";

import MobileSocialCallback from "@/components/auth/mobile-social-callback";

export const metadata: Metadata = { referrer: "no-referrer" };

export default function MobileSocialCallbackPage() {
  return <MobileSocialCallback />;
}
