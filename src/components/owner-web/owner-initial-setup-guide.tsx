"use client";

import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { OwnerWebScreenKey } from "@/components/owner-web/owner-web-data";
import { cn } from "@/lib/utils";
import type { BootstrapPayload } from "@/types/domain";

const GUIDE_VERSION = 4;

type SetupStepKey = "hours" | "staff";

type StoredSetupGuideState = {
  version: number;
  confirmed: SetupStepKey[];
  dismissedAt?: string;
  completedAt?: string;
};

type SetupStep = {
  key: SetupStepKey;
  eyebrow: string;
  title: string;
  description: string;
  summaryLabel: string;
  summaryValue: string;
  helper: string;
  screen: OwnerWebScreenKey;
  primaryLabel: string;
  secondaryLabel: string;
  Icon: typeof Clock3;
};

export function getOwnerInitialSetupGuideStorageKey(shopId: string) {
  return `petmanager.owner.initial-setup.v${GUIDE_VERSION}:${shopId}`;
}

function readStoredState(shopId: string): StoredSetupGuideState {
  if (typeof window === "undefined") {
    return { version: GUIDE_VERSION, confirmed: [] };
  }

  try {
    const value = window.localStorage.getItem(getOwnerInitialSetupGuideStorageKey(shopId));
    if (!value) return { version: GUIDE_VERSION, confirmed: [] };
    const parsed = JSON.parse(value) as Partial<StoredSetupGuideState>;
    return {
      version: GUIDE_VERSION,
      confirmed: Array.isArray(parsed.confirmed) ? parsed.confirmed : [],
      dismissedAt: parsed.dismissedAt,
      completedAt: parsed.completedAt,
    };
  } catch {
    return { version: GUIDE_VERSION, confirmed: [] };
  }
}

function writeStoredState(shopId: string, state: StoredSetupGuideState) {
  try {
    window.localStorage.setItem(getOwnerInitialSetupGuideStorageKey(shopId), JSON.stringify(state));
  } catch {
    // 브라우저 저장소를 사용할 수 없어도 현재 세션에서는 가이드를 계속 사용할 수 있습니다.
  }
}

function buildSetupSteps(data: BootstrapPayload): SetupStep[] {
  const shop = data.shop;
  const enabledDays = Object.values(shop.business_hours ?? {}).filter((day) => day?.enabled).length;
  const activeStaff = data.staffMembers.length;

  return [
    {
      key: "hours",
      eyebrow: "첫 번째 확인",
      title: "예약받을 시간을 확인해 주세요",
      description: "가입과 동시에 기본 영업시간을 준비해 두었습니다. 실제 매장과 다를 때만 수정하면 됩니다.",
      summaryLabel: "현재 준비된 운영시간",
      summaryValue: `주 ${enabledDays || 6}일 운영`,
      helper: "휴무일과 예약을 막을 시간도 같은 화면에서 바꿀 수 있어요.",
      screen: "operatingHours",
      primaryLabel: "이대로 사용",
      secondaryLabel: "시간 수정",
      Icon: Clock3,
    },
    {
      key: "staff",
      eyebrow: "두 번째 확인",
      title: "함께 일할 직원과 근무표를 확인해 주세요",
      description: "가입한 오너는 기본 담당자로 준비해 두었습니다. 직원이 더 있을 때만 추가하면 됩니다.",
      summaryLabel: "현재 예약을 받을 담당자",
      summaryValue: `${activeStaff || 1}명`,
      helper: "직원별 근무시간이 달라질 때만 각자의 근무표를 바꿔주세요.",
      screen: "staff",
      primaryLabel: "이대로 사용",
      secondaryLabel: "직원·근무표 수정",
      Icon: Users,
    },
  ];
}

export default function OwnerInitialSetupGuide({
  open,
  data,
  onClose,
  onNavigate,
}: {
  open: boolean;
  data: BootstrapPayload;
  onClose: () => void;
  onNavigate: (screen: OwnerWebScreenKey) => void;
}) {
  const steps = useMemo(() => buildSetupSteps(data), [data]);
  const [storedState, setStoredState] = useState<StoredSetupGuideState>(() => readStoredState(data.shop.id));
  const [selectedIndex, setSelectedIndex] = useState(() => {
    const stored = readStoredState(data.shop.id);
    const firstIncomplete = steps.findIndex((step) => !stored.confirmed.includes(step.key));
    return firstIncomplete === -1 ? steps.length : firstIncomplete;
  });

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  const confirmedSet = new Set(storedState.confirmed);
  const completedCount = storedState.confirmed.length;
  const showCompletion = selectedIndex >= steps.length;
  const currentStep = showCompletion ? null : steps[selectedIndex];

  function persist(nextConfirmed: SetupStepKey[], dismissed = false) {
    const uniqueConfirmed = [...new Set(nextConfirmed)];
    const nextState: StoredSetupGuideState = {
      version: GUIDE_VERSION,
      confirmed: uniqueConfirmed,
      dismissedAt: dismissed ? new Date().toISOString() : storedState.dismissedAt,
      completedAt: uniqueConfirmed.length === steps.length ? new Date().toISOString() : undefined,
    };
    setStoredState(nextState);
    writeStoredState(data.shop.id, nextState);
  }

  function completeCurrentStep() {
    if (!currentStep) return;
    persist([...storedState.confirmed, currentStep.key]);
    setSelectedIndex((current) => Math.min(current + 1, steps.length));
  }

  function openCurrentSetting() {
    if (!currentStep) return;
    persist([...storedState.confirmed, currentStep.key], true);
    setSelectedIndex((current) => Math.min(current + 1, steps.length));
    onNavigate(currentStep.screen);
    onClose();
  }

  function closeGuide() {
    persist(storedState.confirmed, true);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#0f172a]/45 p-5 backdrop-blur-[2px]" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="owner-initial-setup-title"
        className="flex max-h-[calc(100vh-40px)] w-full max-w-[760px] flex-col overflow-hidden rounded-[22px] border border-[#d9e2ee] bg-white shadow-[0_28px_80px_rgba(15,23,42,0.22)]"
      >
        <header className="shrink-0 px-7 pb-5 pt-6 sm:px-9 sm:pt-8">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[#2563eb]">
                <Sparkles className="h-4 w-4" />
                <p className="text-[13px] font-bold tracking-[0.08em]">QUICK START</p>
              </div>
              <h2 id="owner-initial-setup-title" className="mt-3 text-[27px] font-bold tracking-[-0.035em] text-[#111827] sm:text-[30px]">
                두 가지만 확인하면 예약받을 준비가 끝나요
              </h2>
              <p className="mt-2 text-[15px] leading-6 text-[#64748b]">
                필요한 값은 펫매니저가 먼저 준비했습니다. 실제 운영과 다른 부분만 바꿔주세요.
              </p>
            </div>
            <button
              type="button"
              onClick={closeGuide}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-[#64748b] transition hover:bg-[#eef2f7] hover:text-[#111827]"
              aria-label="초기 설정 가이드 닫기"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-6 flex items-center gap-2" aria-label={`${completedCount}/${steps.length} 완료`}>
            {steps.map((step, index) => (
              <span
                key={step.key}
                className={cn(
                  "h-2 flex-1 rounded-full transition-colors",
                  confirmedSet.has(step.key) || index === selectedIndex ? "bg-[#316fe8]" : "bg-[#e8edf4]",
                )}
              />
            ))}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#f7f9fc] px-7 py-6 sm:px-9">
          {currentStep ? (
            <div>
              <div className="rounded-[18px] border border-[#dce5f0] bg-white p-6 sm:p-7">
                <div className="flex items-start gap-4">
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[#eaf2ff] text-[#2563eb]">
                    <currentStep.Icon className="h-6 w-6" strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-[#316fe8]">
                      {currentStep.eyebrow} · {selectedIndex + 1}/{steps.length}
                    </p>
                    <h3 className="mt-1.5 text-[23px] font-bold tracking-[-0.025em] text-[#172033]">
                      {currentStep.title}
                    </h3>
                    <p className="mt-2 text-[15px] leading-6 text-[#64748b]">{currentStep.description}</p>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between gap-5 rounded-[14px] border border-[#e2e8f0] bg-[#f8fafc] px-5 py-4">
                  <div>
                    <p className="text-[13px] font-semibold text-[#64748b]">{currentStep.summaryLabel}</p>
                    <p className="mt-1 text-[20px] font-bold text-[#172033]">{currentStep.summaryValue}</p>
                  </div>
                  <CheckCircle2 className="h-6 w-6 shrink-0 text-[#1f9d55]" />
                </div>

                <p className="mt-4 text-[13px] leading-5 text-[#7b8798]">{currentStep.helper}</p>

                <div className="mt-6 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={openCurrentSetting}
                    className="inline-flex h-11 items-center justify-center gap-1 rounded-[11px] border border-[#c8d3e1] bg-white px-4 text-[14px] font-semibold text-[#334155] transition hover:bg-[#f8fafc]"
                  >
                    {currentStep.secondaryLabel}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={completeCurrentStep}
                    className="inline-flex h-11 items-center justify-center gap-1 rounded-[11px] bg-[#172033] px-4 text-[14px] font-bold text-white transition hover:bg-[#25314a]"
                  >
                    {currentStep.primaryLabel}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

            </div>
          ) : (
            <div className="rounded-[18px] border border-[#cfe0f7] bg-white px-6 py-9 text-center sm:px-10">
              <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#e9f8f1] text-[#177856]">
                <Check className="h-7 w-7" strokeWidth={2.2} />
              </span>
              <h3 className="mt-4 text-[25px] font-bold tracking-[-0.025em] text-[#172033]">예약받을 준비가 끝났어요</h3>
              <p className="mt-2 text-[15px] leading-6 text-[#64748b]">
                영업시간과 담당자 근무표를 기준으로 예약 가능한 시간이 자동으로 준비됩니다.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-6 inline-flex h-11 items-center justify-center gap-1 rounded-[11px] bg-[#316fe8] px-5 text-[14px] font-bold text-white transition hover:bg-[#245ec9]"
              >
                시작하기
              </button>
            </div>
          )}
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-[#dfe6ef] bg-white px-7 py-4 sm:px-9">
          <button
            type="button"
            onClick={() => setSelectedIndex((current) => Math.max(0, current - 1))}
            disabled={selectedIndex === 0 || showCompletion}
            className="inline-flex h-9 items-center gap-1 rounded-[9px] px-2 text-[13px] font-semibold text-[#64748b] transition hover:bg-[#f8fafc] disabled:pointer-events-none disabled:opacity-0"
          >
            <ChevronLeft className="h-4 w-4" />
            이전
          </button>
          {showCompletion ? (
            <button
              type="button"
              onClick={() => setSelectedIndex(0)}
              className="inline-flex h-9 items-center rounded-[9px] px-3 text-[13px] font-semibold text-[#475569] transition hover:bg-[#f8fafc]"
            >
              다시 확인
            </button>
          ) : null}
          <button
            type="button"
            onClick={closeGuide}
            className="inline-flex h-9 items-center rounded-[9px] px-3 text-[13px] font-semibold text-[#64748b] transition hover:bg-[#f8fafc]"
          >
            나중에 계속
          </button>
        </footer>
      </section>
    </div>
  );
}
