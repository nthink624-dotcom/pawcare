"use client";

import { useState } from "react";

import InitialSetupFixtureForm, {
  type InitialSetupFixtureScreen,
} from "@/app/dev/initial-setup-guide-preview/initial-setup-fixture-form";
import OwnerInitialSetupGuide from "@/components/owner-web/owner-initial-setup-guide";
import { OWNER_INITIAL_SETUP_ORDER } from "@/lib/owner-initial-setup-readiness";
import type { BootstrapPayload, OwnerInitialSetupStepKey } from "@/types/domain";

const PREVIEW_DATA = {
  mode: "mock",
  shop: {
    id: "initial-setup-guide-preview-shop",
    name: "펫매니저 미용실",
    business_hours: {
      0: { open: "10:00", close: "19:00", enabled: false },
      1: { open: "10:00", close: "19:00", enabled: true },
      2: { open: "10:00", close: "19:00", enabled: true },
      3: { open: "10:00", close: "19:00", enabled: true },
      4: { open: "10:00", close: "19:00", enabled: true },
      5: { open: "10:00", close: "19:00", enabled: true },
      6: { open: "10:00", close: "18:00", enabled: true },
    },
    booking_slot_interval_minutes: 15,
    customer_page_settings: {},
  },
  initialSetupReadiness: {
    shopId: "initial-setup-guide-preview-shop",
    steps: { hours: false, staff: false, pricing: false },
    completed: false,
    nextStep: "hours",
  },
  services: [],
  staffMembers: [
    { id: "preview-owner", name: "대표자", displayName: "대표자", phone: "", role: "대표", position: "대표" },
  ],
} as unknown as BootstrapPayload;

export default function InitialSetupGuidePreviewClient() {
  const [open, setOpen] = useState(true);
  const [previewData, setPreviewData] = useState(PREVIEW_DATA);
  const [activeScreen, setActiveScreen] = useState<InitialSetupFixtureScreen>("operatingHours");
  const [lastAction, setLastAction] = useState("fixture 입력값은 이 브라우저에서만 확인하며 DB·Auth·외부 호출을 사용하지 않습니다.");

  function handleStepSaved(step: OwnerInitialSetupStepKey) {
    setPreviewData((current) => {
      const steps = { ...current.initialSetupReadiness!.steps, [step]: true };
      const nextStep = OWNER_INITIAL_SETUP_ORDER.find((item) => !steps[item]) ?? null;
      return {
        ...current,
        initialSetupReadiness: {
          shopId: current.shop.id,
          steps,
          completed: nextStep === null,
          nextStep,
        },
      };
    });

    if (step === "hours") {
      setLastAction("영업시간·휴무일을 저장했습니다. 다음 버튼으로 직원 관리 단계에 이동할 수 있습니다.");
      return;
    }
    if (step === "staff") {
      setLastAction("직원 관리를 저장했습니다. 다음 버튼으로 서비스·가격 단계에 이동할 수 있습니다.");
      return;
    }
    setLastAction("상세 요금표를 저장했습니다.");
    setOpen(false);
  }

  return (
    <main className="owner-font pm-owner-web min-h-screen w-full overflow-x-hidden bg-[#f7f8fa] p-4 text-[#172033] [word-break:keep-all] sm:p-6">
      <div className="mx-auto w-full max-w-[1280px] min-w-0">
        <header className="rounded-[14px] border border-[#d9e2ee] bg-white px-4 py-4 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:px-5">
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-[#2563eb]">DB-FREE FIXTURE</p>
            <h1 className="mt-1 text-[20px] font-semibold tracking-[-0.02em] text-[#172033]">가입 후 매장 초기 설정</h1>
            <p className="mt-1 text-[13px] font-normal leading-5 text-[#64748b]" aria-live="polite">{lastAction}</p>
          </div>
          {!open ? (
            <button type="button" onClick={() => setOpen(true)} className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-[10px] border border-[#dbe2ea] bg-white px-4 text-[14px] font-medium text-[#334155] hover:bg-[#f8fafc] sm:mt-0 sm:w-auto">
              체크리스트 다시 열기
            </button>
          ) : null}
        </header>

        <div className={open ? "pm-initial-setup-layout mt-4 grid min-w-0 items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)]" : "mt-4 min-w-0"}>
          <OwnerInitialSetupGuide
            open={open}
            data={previewData}
            activeScreen={activeScreen}
            onClose={() => setOpen(false)}
            onNavigate={(screen) => {
              if (screen === "operatingHours" || screen === "staff" || screen === "services") {
                setActiveScreen(screen);
                setLastAction("화면 이동만으로 완료 수는 바뀌지 않습니다.");
              }
            }}
          >
            <InitialSetupFixtureForm
              activeScreen={activeScreen}
              onStepSaved={handleStepSaved}
              onHoursNext={() => {
                setActiveScreen("staff");
                setLastAction("저장 여부와 관계없이 직원 관리 단계로 이동했습니다.");
              }}
              onStaffNext={() => {
                setActiveScreen("services");
                setLastAction("저장 여부와 관계없이 서비스·가격 단계로 이동했습니다.");
              }}
              onPricingNext={() => {
                setOpen(false);
                setLastAction("저장 여부와 관계없이 초기 설정을 닫았습니다.");
              }}
            />
          </OwnerInitialSetupGuide>
          {!open ? (
            <div className="min-w-0">
              <InitialSetupFixtureForm
                activeScreen={activeScreen}
                onStepSaved={handleStepSaved}
                onHoursNext={() => {
                  setActiveScreen("staff");
                  setLastAction("저장 여부와 관계없이 직원 관리 단계로 이동했습니다.");
                }}
                onStaffNext={() => {
                  setActiveScreen("services");
                  setLastAction("저장 여부와 관계없이 서비스·가격 단계로 이동했습니다.");
                }}
                onPricingNext={() => {
                  setOpen(false);
                  setLastAction("저장 여부와 관계없이 초기 설정을 닫았습니다.");
                }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
