"use client";

import { useEffect, useRef, useState } from "react";

import MobilePriceGuideMatrix from "@/components/auth/mobile-price-guide-matrix";
import { updateMobilePriceGuideCell } from "@/lib/price-photo/mobile-price-guide-matrix";
import { createMobilePricePhotoCoordinator, type MobilePriceGuideV2 } from "@/lib/price-photo/mobile-price-photo-adapter";
import { createMobilePricePhotoHttpAdapter } from "@/lib/price-photo/mobile-price-photo-http-adapter";
import {
  createInMemoryAuthenticatedOwnerTransport,
  type PriceGuideFixtureSnapshot,
} from "@/lib/price-photo/mobile-price-guide-save-reentry-fixture";

type FixtureStatus = "loading" | "ready" | "edited" | "saving" | "passed" | "failed";

const buttonClass = "min-h-11 rounded-[10px] px-4 text-[15px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500";

function sameDocument(left: MobilePriceGuideV2, right: MobilePriceGuideV2) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export default function MobilePriceGuideSaveReentryFixture() {
  const transportRef = useRef(createInMemoryAuthenticatedOwnerTransport());
  const coordinatorRef = useRef<ReturnType<typeof createMobilePricePhotoCoordinator> | null>(null);
  const [document, setDocument] = useState<MobilePriceGuideV2 | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [status, setStatus] = useState<FixtureStatus>("loading");
  const [snapshot, setSnapshot] = useState<PriceGuideFixtureSnapshot | null>(null);
  const [remountKey, setRemountKey] = useState(0);
  const [reentryEqual, setReentryEqual] = useState(false);
  const [message, setMessage] = useState("canonical bootstrap과 정리 영수증을 확인하고 있어요.");

  useEffect(() => {
    const transport = transportRef.current;
    const adapter = createMobilePricePhotoHttpAdapter({
      backendOrigin: transport.backendOrigin,
      shopId: transport.shopId,
      accessToken: transport.accessToken,
      fetchImpl: transport.fetchImpl,
    });
    const coordinator = createMobilePricePhotoCoordinator(adapter);
    coordinatorRef.current = coordinator;
    const controller = new AbortController();

    void (async () => {
      try {
        await coordinator.analyze(new File([new Uint8Array([137, 80, 78, 71])], "fixture.png", { type: "image/png" }));
        const initial = await adapter.requeryServices(transport.serviceId, controller.signal);
        transport.resetSaveCycle();
        setDocument(initial.document);
        setServiceId(initial.serviceId);
        setSnapshot(transport.snapshot());
        setStatus("ready");
        setMessage("저장 전 canonical 값과 residue 0 정리 영수증을 확인했어요.");
      } catch (error) {
        setStatus("failed");
        setMessage(error instanceof Error ? error.message : "개발 전용 fixture를 준비하지 못했습니다.");
      }
    })();

    return () => {
      controller.abort();
      coordinator.cancel();
    };
  }, []);

  const applyFixtureEdit = () => {
    if (!document) return;
    const edited = updateMobilePriceGuideCell(document, 0, 0, 0, {
      priceKind: "fixed",
      priceMinKrw: 31_000,
      priceMaxKrw: null,
      durationMinutes: 50,
    });
    setDocument(edited);
    setStatus("edited");
    setReentryEqual(false);
    setMessage("가격·시간을 local draft에서만 바꿨어요.");
  };

  const saveAndRemount = async () => {
    const coordinator = coordinatorRef.current;
    const transport = transportRef.current;
    if (!coordinator || !document || !serviceId) return;
    setStatus("saving");
    setMessage("명시 저장 뒤 cache:no-store 결과를 확인하고 있어요.");
    try {
      const persisted = await coordinator.saveAndRequery(document, serviceId);
      const currentSnapshot = transport.snapshot();
      const equal = sameDocument(persisted.document, transport.canonicalDocument());
      if (
        currentSnapshot.counts.servicesPost !== 1
        || currentSnapshot.counts.bootstrapGet !== 1
        || !currentSnapshot.noStoreBootstrap
        || currentSnapshot.residueCount !== 0
        || !equal
      ) {
        throw new Error("저장·재조회·정리 결과가 canonical 계약과 일치하지 않습니다.");
      }
      setDocument(structuredClone(persisted.document));
      setServiceId(persisted.serviceId);
      setSnapshot(currentSnapshot);
      setReentryEqual(true);
      setRemountKey((value) => value + 1);
      setStatus("passed");
      setMessage("POST 1회·no-store GET 1회 뒤 같은 canonical 문서로 다시 열렸어요.");
    } catch (error) {
      setSnapshot(transport.snapshot());
      setStatus("failed");
      setMessage(error instanceof Error ? error.message : "저장 검증을 완료하지 못했습니다.");
    }
  };

  return (
    <main className="min-h-screen w-full min-w-0 max-w-full bg-slate-50 px-4 py-6 text-slate-900">
      <div className="mx-auto w-full min-w-0 max-w-[1040px] space-y-5">
        <header className="rounded-[18px] border border-slate-200 bg-white p-5">
          <p className="text-[13px] font-medium text-blue-700">개발 전용 · 외부 요청 없음</p>
          <h1 className="mt-1 text-[22px] font-semibold leading-8">요금표 저장·재진입 fixture</h1>
          <p className="mt-2 text-[14px] leading-6 text-slate-600">실제 모바일 matrix와 저장 adapter를 인증된 메모리 transport에 연결해요.</p>
        </header>

        <section className="rounded-[14px] border border-slate-200 bg-white p-4" aria-live="polite">
          <p className="text-[15px] font-medium">{message}</p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-[13px] text-slate-600 sm:grid-cols-4">
            <div><dt>서비스 POST</dt><dd className="font-semibold text-slate-900" data-fixture-services-post>{snapshot?.counts.servicesPost ?? 0}</dd></div>
            <div><dt>no-store GET</dt><dd className="font-semibold text-slate-900" data-fixture-bootstrap-get>{snapshot?.counts.bootstrapGet ?? 0}</dd></div>
            <div><dt>정리 잔존</dt><dd className="font-semibold text-slate-900" data-fixture-residue>{snapshot?.residueCount ?? "-"}</dd></div>
            <div><dt>재진입 동일성</dt><dd className="font-semibold text-slate-900" data-fixture-reentry>{reentryEqual ? "일치" : "대기"}</dd></div>
          </dl>
        </section>

        {document ? (
          <MobilePriceGuideMatrix
            key={remountKey}
            document={document}
            onChange={(next) => {
              setDocument(next);
              setStatus("edited");
              setReentryEqual(false);
            }}
          />
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" className={`${buttonClass} border border-slate-300 bg-white text-slate-800`} disabled={status === "loading" || status === "saving" || !document} onClick={applyFixtureEdit}>
            검증용 수정 적용
          </button>
          <button type="button" className={`${buttonClass} bg-blue-600 text-white`} disabled={status !== "edited" || !document} onClick={() => void saveAndRemount()}>
            {status === "saving" ? "저장 확인 중..." : "명시 저장 후 재진입 확인"}
          </button>
        </div>
      </div>
    </main>
  );
}
