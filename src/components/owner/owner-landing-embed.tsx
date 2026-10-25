"use client";

import { useEffect } from "react";

import OwnerApp from "@/components/owner/owner-app";
import type { BootstrapPayload } from "@/types/domain";

const EMBED_MESSAGE_SOURCE = "petmanager-owner-mobile-embed";

function notifyParent(status: "ready" | "error", message?: string) {
  if (window.parent === window) return;
  window.parent.postMessage(
    { source: EMBED_MESSAGE_SOURCE, version: 1, status, ...(message ? { message } : {}) },
    "*",
  );
}

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
      notifyParent("ready");
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
    <div
      className="landing-owner-embed owner-font min-h-screen w-full max-w-[430px] overflow-x-hidden bg-white"
      data-petmanager-embed="owner-mobile"
      data-petmanager-embed-state="ready"
      data-petmanager-data-source="fixture"
    >
      <style>{`
        .landing-owner-embed .pm-mobile-owner { min-height: 100dvh; }
        .landing-owner-embed .pm-mobile-owner > header,
        .landing-owner-embed .pm-mobile-owner > nav { display: none; }
        .landing-owner-embed .pm-mobile-owner > main { padding-bottom: 0; }
        .landing-owner-embed .pm-mobile-owner { pointer-events: none; user-select: none; }
        .landing-owner-embed .pm-mobile-owner button,
        .landing-owner-embed .pm-mobile-owner a { min-height: 44px; }
        .landing-owner-embed .pm-mobile-owner button[aria-label] { min-width: 44px; }
      `}</style>
      <div inert aria-label="읽기 전용 모바일 운영 화면">
        <OwnerApp initialData={data} ownedShops={ownedShops} selectedShopId={data.shop.id} isPreviewDemo appRole="owner" />
      </div>
    </div>
  );
}
