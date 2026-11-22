"use client";

import MobileAiPriceGuideFixture from "@/components/auth/mobile-ai-price-guide-fixture";
import OwnerApp from "@/components/owner/owner-app";
import dynamic from "next/dynamic";
import { useState } from "react";
import type { InitialSetupOperations } from "@/components/owner/owner-initial-setup-flow";
import { buildOwnerDemoBootstrap } from "@/lib/owner-demo-data";
import { createInMemoryAuthenticatedOwnerTransport } from "@/lib/price-photo/mobile-price-guide-save-reentry-fixture";
import { createMobilePricePhotoHttpAdapter } from "@/lib/price-photo/mobile-price-photo-http-adapter";
import type { SetupReadiness } from "@/lib/owner-initial-setup-flow";
import type { BootstrapPayload } from "@/types/domain";

// The development fixture reads session drafts and creates relative demo dates.
// Mount it on the client, as the real owner entry does after its startup read.
const InitialSetupWizard = dynamic(() => import("@/components/owner/owner-initial-setup-flow").then((module) => module.InitialSetupWizard), { ssr: false });

export default function MobilePricePhotoRegistrationPreview({ setupFlow = false }: { setupFlow?: boolean }) {
  if (setupFlow) return <MobileInitialSetupPreview />;
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

function MobileInitialSetupPreview() {
  const [closed, setClosed] = useState(false);
  const [preview] = useState(() => {
    const transport = createInMemoryAuthenticatedOwnerTransport();
    const base = buildOwnerDemoBootstrap();
    const bootstrap: BootstrapPayload = {
      ...base,
      shop: { ...base.shop, id: transport.shopId, owner_user_id: "local-setup-owner", name: "펫매니저 데모 매장" },
      ownerProfile: base.ownerProfile ? { ...base.ownerProfile, user_id: "local-setup-owner", shop_id: transport.shopId, name: "대표자", phone_number: "" } : base.ownerProfile,
      services: [],
      appointments: [],
      groomingRecords: [],
      staffMembers: base.staffMembers.slice(0, 1).map((member) => ({
        ...member, id: "local-setup-staff", name: "대표자", displayName: "대표자", phone: "",
        profileImageUrl: "", profileImageUrls: [], profileImageAssetIds: [], profileImageFallbackKey: null,
        defaultDays: ["mon", "tue", "wed", "thu", "fri"], startTime: "10:00", endTime: "19:00",
      })),
    };
    const readiness: SetupReadiness = { shopId: transport.shopId, steps: { hours: false, staff: false, pricing: false }, completed: false, nextStep: "hours" };
    const operations: InitialSetupOperations = {
      async saveStep(step) {
        readiness.steps = { ...readiness.steps, [step]: true };
        readiness.nextStep = !readiness.steps.hours ? "hours" : !readiness.steps.staff ? "staff" : "pricing";
      },
      async reload() {
        const pricing = transport.snapshot().counts.servicesPost > 0;
        const steps = { ...readiness.steps, pricing };
        readiness.steps = steps;
        readiness.completed = Object.values(steps).every(Boolean);
        readiness.nextStep = !steps.hours ? "hours" : !steps.staff ? "staff" : !pricing ? "pricing" : null;
        return { ...bootstrap, services: pricing ? [{ ...base.services[0], id: transport.serviceId, price_guide: transport.canonicalDocument() }] : [], initialSetupReadiness: readiness };
      },
      pricePhotoAdapter: createMobilePricePhotoHttpAdapter({ backendOrigin: transport.backendOrigin, shopId: transport.shopId, accessToken: transport.accessToken, fetchImpl: transport.fetchImpl }),
    };
    return { bootstrap, readiness, operations };
  });
  return <main className="owner-font min-h-dvh bg-[#f1f3f7]" data-mobile-initial-setup-preview>
    {closed ? <>
      <OwnerApp initialData={preview.bootstrap} ownedShops={[{ id: preview.bootstrap.shop.id, name: preview.bootstrap.shop.name, address: preview.bootstrap.shop.address, heroImageUrl: "" }]} selectedShopId={preview.bootstrap.shop.id} appRole="owner" isPreviewDemo startupReadOnly />
      {!preview.readiness.completed && <aside className="pointer-events-none fixed inset-x-3 top-3 z-40 mx-auto flex max-w-[404px] justify-end"><button type="button" className="pointer-events-auto min-h-11 rounded-[10px] border border-[#c7ddff] bg-white px-3 text-[14px] text-[#174ea6] shadow-sm" onClick={() => setClosed(false)}>설정 이어서 하기</button></aside>}
    </>
      : <InitialSetupWizard bootstrap={preview.bootstrap} readiness={preview.readiness} operations={preview.operations} onDefer={() => setClosed(true)} onFinish={() => setClosed(true)} />}
  </main>;
}
