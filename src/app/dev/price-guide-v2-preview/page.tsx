"use client";

import { notFound, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

import PriceGuidePhotoOnboarding from "@/components/owner-web/price-guide-photo-onboarding";
import ServiceManagementScreen from "@/components/owner-web/service-management-screen";
import { createPriceGuidePhotoImportFixture } from "@/lib/price-guide-photo-import-fixture";
import type { PriceGuideV2 } from "@/types/price-guide-photo-import";

import {
  buildPriceGuideRegistrationPreviewFixture,
  buildPriceGuideSourceTruthPreviewFixture,
  inspectPriceGuideRegistrationPreview,
  type PriceGuideRegistrationPreviewPath,
  type PriceGuideSourceTruthPreviewState,
} from "./price-guide-v2-preview-fixtures";

type PriceGuideV2PreviewState = "empty" | "saved" | PriceGuideRegistrationPreviewPath | PriceGuideSourceTruthPreviewState;

function getPriceGuideV2PreviewState(value: string | null): PriceGuideV2PreviewState {
  if (
    value === "saved"
    || value === "photo-e2e"
    || value === "direct-e2e"
    || value === "stale-link"
    || value === "deleted-source"
  ) return value;
  return "empty";
}

function PriceGuideRegistrationE2EPreview({ path }: { path: PriceGuideRegistrationPreviewPath }) {
  const initialFixture = useMemo(() => buildPriceGuideRegistrationPreviewFixture(path), [path]);
  const [data, setData] = useState(initialFixture.data);
  const state = useMemo(() => inspectPriceGuideRegistrationPreview(data), [data]);
  const pathLabel = path === "photo-e2e" ? "사진으로 등록" : "직접 등록";

  return (
    <main
      className="min-h-dvh overflow-x-hidden bg-[#f5f7fa] p-3 sm:p-4"
      data-preview-source="fixture"
      data-preview-state={path}
      data-registration-path={path}
      data-persisted="false"
      data-source-option-count={state.sourceOptionIds.length}
      data-customer-exposure-count={state.customerOptionIds.length}
      data-customer-source-links-valid={state.customerLinkedSourceOptionIds.every((id) => state.sourceOptionIds.includes(id))}
    >
      <div className="mx-auto w-full max-w-[1440px]">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[#dbe2ea] bg-white px-4 py-3">
          <div className="min-w-0">
            <h1 className="text-[18px] font-semibold tracking-[-0.02em] text-[#111827]">요금표 등록 전체 흐름 검수</h1>
            <p className="mt-1 text-[13px] leading-5 text-[#64748b]">
              {pathLabel} · 등록 방식 선택부터 저장 원본과 고객 노출 연결까지 확인합니다.
            </p>
          </div>
          <span className="inline-flex min-h-11 items-center rounded-[8px] border border-[#c8ded8] bg-[#edf7f3] px-3 text-[13px] font-medium text-[#2f7866]">
            원본 {state.sourceOptionIds.length}개 · 고객 노출 {state.customerOptionIds.length}개
          </span>
        </header>
        <div className="mt-3 h-[calc(100dvh-112px)] min-h-[720px]">
          <ServiceManagementScreen
            shopId={data.shop.id}
            shop={data.shop}
            ownerProfile={data.ownerProfile ?? null}
            initialServices={data.services}
            staffMembers={data.staffMembers ?? []}
            demoMode
            persistDemoState={false}
            onServicesChange={(services) => setData((current) => ({ ...current, services }))}
            onShopChange={(shop) => setData((current) => ({ ...current, shop }))}
          />
        </div>
      </div>
    </main>
  );
}

function PriceGuideSourceTruthPreview({ state }: { state: PriceGuideSourceTruthPreviewState }) {
  const fixture = useMemo(() => buildPriceGuideSourceTruthPreviewFixture(state), [state]);
  const stateLabel = state === "deleted-source" ? "원본 행 삭제됨" : "연결된 원본 없음";

  return (
    <main
      className="min-h-dvh overflow-x-hidden bg-[#f5f7fa] p-3 sm:p-4"
      data-preview-source="fixture"
      data-preview-state={state}
      data-persisted="false"
      data-source-option-count={fixture.sourceOptionIds.length}
      data-customer-exposure-count={fixture.customerOptionIds.length}
    >
      <div className="mx-auto w-full max-w-[1440px]">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[#dbe2ea] bg-white px-4 py-3">
          <div className="min-w-0">
            <h1 className="text-[18px] font-semibold tracking-[-0.02em] text-[#111827]">요금표 원본 연결 검수</h1>
            <p className="mt-1 text-[13px] leading-5 text-[#64748b]">
              {stateLabel} · 저장된 원본과 연결되지 않은 고객 항목이 남지 않는지 확인합니다.
            </p>
          </div>
          <span className="inline-flex min-h-11 items-center rounded-[8px] border border-[#c8ded8] bg-[#edf7f3] px-3 text-[13px] font-medium text-[#2f7866]">
            고객 노출 {fixture.customerOptionIds.length}개
          </span>
        </header>
        <div className="mt-3 h-[calc(100dvh-112px)] min-h-[720px]">
          <ServiceManagementScreen
            key={state}
            shopId={fixture.data.shop.id}
            shop={fixture.data.shop}
            ownerProfile={fixture.data.ownerProfile ?? null}
            initialServices={fixture.data.services}
            staffMembers={fixture.data.staffMembers ?? []}
            demoMode
          />
        </div>
      </div>
    </main>
  );
}

function PriceGuideV2PreviewSurface() {
  const searchParams = useSearchParams();
  const state = getPriceGuideV2PreviewState(searchParams.get("state"));
  const [document, setDocument] = useState<PriceGuideV2 | null>(() =>
    state === "saved" ? createPriceGuidePhotoImportFixture().document : null,
  );

  if (state === "stale-link" || state === "deleted-source") {
    return <PriceGuideSourceTruthPreview state={state} />;
  }
  if (state === "photo-e2e" || state === "direct-e2e") {
    return <PriceGuideRegistrationE2EPreview key={state} path={state} />;
  }

  return (
    <main className="min-h-dvh overflow-x-hidden bg-[#f5f7fa] px-4 py-6 sm:px-6" data-preview-source="fixture" data-preview-state={state} data-persisted="false">
      <div className="mx-auto w-full max-w-[960px] rounded-[18px] bg-white p-4 sm:p-6">
        <p className="mb-4 text-[13px] font-medium leading-5 text-[#64748b]">검수용 예시 · 저장 없음</p>
        <PriceGuidePhotoOnboarding
          key={state}
          shopId="price-guide-v2-preview"
          fixtureMode
          initialDocument={document}
          onApply={async (next) => {
            if ("schemaVersion" in next) setDocument(next);
            return true;
          }}
        />
      </div>
    </main>
  );
}

export default function PriceGuideV2PreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <Suspense fallback={null}>
      <PriceGuideV2PreviewSurface />
    </Suspense>
  );
}
