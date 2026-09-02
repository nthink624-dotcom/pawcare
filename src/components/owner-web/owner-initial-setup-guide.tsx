"use client";

import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import type { OwnerWebScreenKey } from "@/components/owner-web/owner-web-data";
import { OWNER_TYPOGRAPHY } from "@/components/owner-web/owner-typography";
import type { BootstrapPayload } from "@/types/domain";

const GUIDE_VERSION = 8;
const SETUP_STATE_EVENT = "petmanager:owner-initial-setup-change";

export type OwnerInitialSetupStepKey = "hours" | "staff" | "pricing";

export type OwnerInitialSetupGuideState = {
  version: number;
  confirmed: OwnerInitialSetupStepKey[];
  dismissedAt?: string;
  completedAt?: string;
};

type SetupChecklistItem = {
  key: OwnerInitialSetupStepKey;
  label: string;
  railLabel: string;
  screen: OwnerWebScreenKey;
};

const setupItems: SetupChecklistItem[] = [
  { key: "hours", label: "영업시간", railLabel: "영업시간", screen: "operatingHours" },
  { key: "staff", label: "직원 관리", railLabel: "직원 관리", screen: "staff" },
  { key: "pricing", label: "서비스·가격", railLabel: "서비스·가격", screen: "services" },
];

const setupOrder: OwnerInitialSetupStepKey[] = ["hours", "staff", "pricing"];
const OwnerInitialSetupHeaderActionContext = createContext<HTMLElement | null>(null);

export function OwnerInitialSetupPrimaryAction({ children }: { children: ReactNode }) {
  const headerActionElement = useContext(OwnerInitialSetupHeaderActionContext);
  return headerActionElement ? createPortal(children, headerActionElement) : null;
}

export function OwnerInitialSetupSaveNextActions({
  onSave,
  onNext,
  saving = false,
  saveDisabled = false,
}: {
  onSave: () => void | Promise<void>;
  onNext: () => void;
  saving?: boolean;
  saveDisabled?: boolean;
}) {
  return (
    <OwnerInitialSetupPrimaryAction>
      <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:w-auto">
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={saving || saveDisabled}
          className="inline-flex min-h-11 min-w-[76px] items-center justify-center rounded-[10px] border border-[#dbe2ea] bg-white px-4 text-[16px] font-medium leading-6 text-[#15213b] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] disabled:cursor-wait disabled:opacity-50"
        >
          {saving ? "저장 중" : "저장"}
        </button>
        <button
          type="button"
          onClick={onNext}
          className="inline-flex min-h-11 min-w-[76px] items-center justify-center rounded-[10px] bg-[#15213b] px-4 text-[16px] font-medium leading-6 text-white hover:bg-[#25314a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"
        >
          다음
        </button>
      </div>
    </OwnerInitialSetupPrimaryAction>
  );
}

export function getOwnerInitialSetupGuideStorageKey(shopId: string) {
  return `petmanager.owner.initial-setup.v${GUIDE_VERSION}:${shopId}`;
}

export function readOwnerInitialSetupGuideState(shopId: string): OwnerInitialSetupGuideState {
  if (typeof window === "undefined") return { version: GUIDE_VERSION, confirmed: [] };

  try {
    const value = window.localStorage.getItem(getOwnerInitialSetupGuideStorageKey(shopId));
    if (!value) return { version: GUIDE_VERSION, confirmed: [] };
    const parsed = JSON.parse(value) as Partial<OwnerInitialSetupGuideState>;
    const confirmed = Array.isArray(parsed.confirmed)
      ? setupOrder.filter((key) => parsed.confirmed?.includes(key))
      : [];
    return {
      version: GUIDE_VERSION,
      confirmed,
      dismissedAt: parsed.dismissedAt,
      completedAt: confirmed.length === setupOrder.length ? parsed.completedAt : undefined,
    };
  } catch {
    return { version: GUIDE_VERSION, confirmed: [] };
  }
}

function writeOwnerInitialSetupGuideState(shopId: string, state: OwnerInitialSetupGuideState) {
  try {
    window.localStorage.setItem(getOwnerInitialSetupGuideStorageKey(shopId), JSON.stringify(state));
    window.dispatchEvent(new CustomEvent(SETUP_STATE_EVENT, { detail: { shopId } }));
  } catch {
    // 현재 세션 UI는 유지하고, 다음 저장 시 다시 시도합니다.
  }
}

export function confirmOwnerInitialSetupStep(shopId: string, step: OwnerInitialSetupStepKey) {
  const current = readOwnerInitialSetupGuideState(shopId);
  const confirmed = setupOrder.filter((key) => current.confirmed.includes(key) || key === step);
  const next: OwnerInitialSetupGuideState = {
    version: GUIDE_VERSION,
    confirmed,
    dismissedAt: current.dismissedAt,
    completedAt: confirmed.length === setupOrder.length ? new Date().toISOString() : undefined,
  };
  writeOwnerInitialSetupGuideState(shopId, next);
  return next;
}

function dismissOwnerInitialSetupGuide(shopId: string) {
  const current = readOwnerInitialSetupGuideState(shopId);
  const next = { ...current, dismissedAt: new Date().toISOString() };
  writeOwnerInitialSetupGuideState(shopId, next);
  return next;
}

export function getOwnerInitialSetupNextScreen(shopId: string): OwnerWebScreenKey {
  const state = readOwnerInitialSetupGuideState(shopId);
  const nextStep = setupOrder.find((key) => !state.confirmed.includes(key)) ?? "pricing";
  return setupItems.find((item) => item.key === nextStep)?.screen ?? "operatingHours";
}

function stepForScreen(screen: OwnerWebScreenKey): OwnerInitialSetupStepKey | null {
  return setupItems.find((item) => item.screen === screen)?.key ?? null;
}

function SetupChecklist({
  activeStep,
  allComplete,
  confirmed,
  compact = false,
  onNavigate,
}: {
  activeStep: OwnerInitialSetupStepKey;
  allComplete: boolean;
  confirmed: OwnerInitialSetupStepKey[];
  compact?: boolean;
  onNavigate: (screen: OwnerWebScreenKey) => void;
}) {
  return (
    <ol className={compact ? "grid min-w-0 grid-cols-2 gap-1.5" : "space-y-1.5"}>
      {setupItems.map((item) => {
        const complete = confirmed.includes(item.key);
        const current = !allComplete && item.key === activeStep;
        const available = complete || current;

        return (
          <li key={item.key} className="min-w-0">
            <button
              type="button"
              onClick={() => onNavigate(item.screen)}
              disabled={!available}
              aria-current={current ? "step" : undefined}
              aria-label={complete ? `${item.railLabel}, 설정 완료` : item.railLabel}
              className={`${current ? "bg-[#eef2f7]" : "bg-transparent"} flex min-h-11 w-full min-w-0 items-center justify-start gap-2.5 rounded-[10px] px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] disabled:cursor-default`}
            >
              <span
                className={complete
                  ? "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border border-[#b8c8c2] bg-[#eff6f3] text-[#1f6b5b]"
                  : "inline-flex h-5 w-5 shrink-0 rounded-[6px] border border-[#cbd5e1] bg-white"}
                aria-hidden="true"
              >
                {complete ? <Check className="h-3.5 w-3.5" /> : null}
              </span>
              <span className={`${OWNER_TYPOGRAPHY.meta} min-w-0 text-[#15213b] [overflow-wrap:anywhere]`}>
                {item.railLabel}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function useOwnerInitialSetupState(shopId: string) {
  const [storedState, setStoredState] = useState<OwnerInitialSetupGuideState>({
    version: GUIDE_VERSION,
    confirmed: [],
  });

  useEffect(() => {
    const refresh = (event?: Event) => {
      const detail = event instanceof CustomEvent ? event.detail as { shopId?: string } : null;
      if (detail?.shopId && detail.shopId !== shopId) return;
      setStoredState(readOwnerInitialSetupGuideState(shopId));
    };
    refresh();
    window.addEventListener(SETUP_STATE_EVENT, refresh);
    return () => window.removeEventListener(SETUP_STATE_EVENT, refresh);
  }, [shopId]);

  return [storedState, setStoredState] as const;
}

export function OwnerInitialSetupResumeCard({ shopId, onResume }: { shopId: string; onResume: () => void }) {
  const [storedState] = useOwnerInitialSetupState(shopId);
  const completedCount = storedState.confirmed.length;

  if (completedCount === setupOrder.length) return null;

  return (
    <section
      className="flex min-w-0 flex-col gap-3 rounded-[12px] border border-[#dbe2ea] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      aria-label="매장 준비 이어하기"
      data-testid="owner-initial-setup-resume-card"
    >
      <div className="min-w-0 sm:flex sm:items-baseline sm:gap-3">
        <p className="text-[14px] font-medium leading-5 text-[#15213b]">매장 준비 이어하기</p>
        <p className="mt-0.5 text-[13px] font-normal leading-5 text-[#64748b] sm:mt-0">필수 설정을 마치면 고객 예약을 받을 수 있어요.</p>
      </div>
      <button
        type="button"
        onClick={onResume}
        className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-[10px] border border-[#dbe2ea] bg-white px-4 text-[14px] font-medium leading-5 text-[#15213b] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"
      >
        이어하기
      </button>
    </section>
  );
}

export default function OwnerInitialSetupGuide({
  open,
  data,
  activeScreen,
  onClose,
  onNavigate,
  children,
}: {
  open: boolean;
  data: BootstrapPayload;
  activeScreen: OwnerWebScreenKey;
  onClose: () => void;
  onNavigate: (screen: OwnerWebScreenKey) => void;
  children?: ReactNode;
}) {
  const [storedState, setStoredState] = useOwnerInitialSetupState(data.shop.id);
  const [headerActionElement, setHeaderActionElement] = useState<HTMLDivElement | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  const completedCount = storedState.confirmed.length;
  const nextStep = setupOrder.find((key) => !storedState.confirmed.includes(key)) ?? null;
  const screenStep = stepForScreen(activeScreen);
  const activeStep = screenStep ?? nextStep ?? "pricing";
  const allComplete = completedCount === setupOrder.length;
  const activeIndex = Math.max(0, setupItems.findIndex((item) => item.key === activeStep));
  const activeItem = setupItems[activeIndex] ?? setupItems[0];
  const previousItem = activeIndex > 0 ? setupItems[activeIndex - 1] : null;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setPortalTarget(document.body);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const closeGuide = useCallback(() => {
    setStoredState(dismissOwnerInitialSetupGuide(data.shop.id));
    onCloseRef.current();
  }, [data.shop.id, setStoredState]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => dialogRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeGuide();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
      previouslyFocused?.focus();
    };
  }, [closeGuide, open]);

  if (!open || !portalTarget) return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[90]" data-testid="owner-initial-setup-layer">
      <div
        className="pointer-events-auto absolute inset-0 bg-[#0f172a]/35"
        data-testid="owner-initial-setup-backdrop"
        aria-hidden="true"
        onPointerDown={closeGuide}
      />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden p-[10px] sm:p-6">
        <OwnerInitialSetupHeaderActionContext.Provider value={headerActionElement}>
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="owner-initial-setup-title"
          tabIndex={-1}
          className="pointer-events-auto relative z-10 flex max-h-[calc(100dvh-20px)] w-full min-w-0 flex-col overflow-hidden rounded-[18px] bg-white shadow-[0_24px_64px_rgba(15,23,42,0.20)] outline-none sm:max-h-[calc(100dvh-48px)] sm:w-[min(960px,calc(100vw-48px))]"
          data-testid="owner-initial-setup-guide"
        >
          <header className="relative shrink-0 border-b border-[#dbe2ea] bg-white px-4 py-4 sm:px-6 sm:py-5">
            <div className="grid min-h-11 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="flex min-w-0 items-center justify-start gap-2">
                {!allComplete && previousItem ? (
                  <button
                    type="button"
                    onClick={() => onNavigate(previousItem.screen)}
                    className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-[10px] border border-[#dbe2ea] bg-white px-3 text-[14px] font-medium leading-5 text-[#475569] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    이전
                  </button>
                ) : null}
              </div>
              <h2
                id="owner-initial-setup-title"
                className={`${OWNER_TYPOGRAPHY.sectionTitle} pointer-events-none absolute left-1/2 top-1/2 max-w-[calc(100%_-_220px)] -translate-x-1/2 -translate-y-1/2 truncate text-center tracking-[-0.015em] text-[#15213b] [word-break:keep-all] sm:max-w-[calc(100%_-_300px)]`}
              >
                {allComplete ? "예약을 받을 준비가 끝났습니다" : activeItem.label}
              </h2>
              <div className="flex shrink-0 items-center justify-end gap-1">
                {!allComplete ? (
                  <button
                    type="button"
                    onClick={closeGuide}
                    className="inline-flex min-h-11 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[13px] font-medium leading-5 text-[#475569] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
                  >
                    나중에 하기
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={closeGuide}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-[8px] text-[#64748b] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
                  aria-label="초기 설정 닫기"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </div>
            <div
              ref={allComplete ? undefined : setHeaderActionElement}
              className="mt-3 flex min-h-11 min-w-0 justify-end sm:absolute sm:right-[164px] sm:top-1/2 sm:mt-0 sm:-translate-y-1/2"
              data-testid="owner-initial-setup-header-actions"
            >
              {allComplete ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex min-h-11 items-center justify-center gap-1 rounded-[10px] bg-[#15213b] px-5 text-[16px] font-medium leading-6 text-white hover:bg-[#25314a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"
                >
                  오너 홈으로 이동
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </header>

          <nav className="shrink-0 border-b border-[#dbe2ea] bg-[#fbfcfd] px-3 py-3 md:hidden" aria-label="매장 준비 단계">
            <SetupChecklist
              activeStep={activeStep}
              allComplete={allComplete}
              confirmed={storedState.confirmed}
              compact
              onNavigate={onNavigate}
            />
          </nav>

          <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden bg-white">
            <aside className="hidden w-[184px] shrink-0 border-r border-[#dbe2ea] bg-[#fbfcfd] px-3 py-5 md:block" aria-label="매장 준비 단계">
              <SetupChecklist
                activeStep={activeStep}
                allComplete={allComplete}
                confirmed={storedState.confirmed}
                onNavigate={onNavigate}
              />
            </aside>
            <div
              className="no-scrollbar min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#2563eb] sm:px-6 sm:py-6"
              data-testid="owner-initial-setup-body"
              role="region"
              aria-label={`${activeItem.label} 설정 내용`}
              tabIndex={0}
            >
              {children}
              {allComplete ? <p className="text-[13px] font-normal leading-5 text-[#64748b]">고객 예약을 받을 준비가 모두 끝났습니다.</p> : null}
            </div>
          </div>

        </div>
        </OwnerInitialSetupHeaderActionContext.Provider>
      </div>
    </div>,
    portalTarget,
  );
}
