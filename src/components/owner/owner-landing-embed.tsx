"use client";

import { useEffect } from "react";

import OwnerApp from "@/components/owner/owner-app";
import type { BootstrapPayload } from "@/types/domain";

type OwnedShopSummary = {
  id: string;
  name: string;
  address: string;
  heroImageUrl: string;
};

/**
 * Keeps the public landing iframe on the real owner schedule without adding a
 * second presentation layer or a mobile frame. The parent landing page owns
 * the device chrome.
 */
export default function OwnerLandingEmbed({ data }: { data: BootstrapPayload }) {
  useEffect(() => {
    const openSchedule = () => {
      document.querySelector<HTMLButtonElement>('button[aria-label="예약 조회"]')?.click();
    };

    const frame = window.requestAnimationFrame(openSchedule);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const ownedShops: OwnedShopSummary[] = [
    {
      id: data.shop.id,
      name: data.shop.name,
      address: data.shop.address,
      heroImageUrl: data.shop.customer_page_settings.hero_image_url,
    },
  ];

  return (
    <div className="landing-owner-embed owner-font min-h-screen w-full max-w-[430px] overflow-x-hidden bg-white">
      <style>{`
        .landing-owner-embed .pm-mobile-owner { min-height: 100dvh; }
        .landing-owner-embed .pm-mobile-owner > header,
        .landing-owner-embed .pm-mobile-owner > nav { display: none; }
        .landing-owner-embed .pm-mobile-owner > main { padding-bottom: 0; }
      `}</style>
      <OwnerApp initialData={data} ownedShops={ownedShops} selectedShopId={data.shop.id} isPreviewDemo appRole="owner" />
    </div>
  );
}
