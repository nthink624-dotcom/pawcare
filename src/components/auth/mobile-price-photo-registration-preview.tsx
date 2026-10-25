"use client";

import MobileAiPriceGuideFixture from "@/components/auth/mobile-ai-price-guide-fixture";

export default function MobilePricePhotoRegistrationPreview() {
  return (
    <main className="min-h-screen bg-[#f1f3f7]" data-price-photo-registration-preview>
      <MobileAiPriceGuideFixture
        initialRows={null}
        ownerBottomNavigation
        onComplete={() => undefined}
        onExit={() => undefined}
      />
    </main>
  );
}
