"use client";

import { Check, ChevronLeft, X } from "lucide-react";
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
import {
  getBootstrapOwnerInitialSetupReadiness,
  OWNER_INITIAL_SETUP_ORDER,
} from "@/lib/owner-initial-setup-readiness";
import type { BootstrapPayload, OwnerInitialSetupStepKey } from "@/types/domain";

export type { OwnerInitialSetupStepKey } from "@/types/domain";

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

const OwnerInitialSetupHeaderActionContext = createContext<HTMLElement | null>(null);
type SetupSave = () => void | boolean | Promise<void | boolean>;
const SetupSaveContext = createContext<React.RefObject<SetupSave | null> | null>(null);

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
  onSave: SetupSave;
  onNext: () => void;
  saving?: boolean;
  saveDisabled?: boolean;
}) {
  const saveContextRef = useContext(SetupSaveContext);
  const latestSave = useRef(onSave);
  useEffect(() => { latestSave.current = onSave; }, [onSave]);
  useEffect(() => {
    if (!saveContextRef) return;
    saveContextRef.current = () => { if (!saving && !saveDisabled) return latestSave.current(); };
    return () => { saveContextRef.current = null; };
  }, [saveContextRef, saving, saveDisabled]);
  return (
    <OwnerInitialSetupPrimaryAction>
      <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:w-auto">
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={saving || saveDisabled}
          className="inline-flex min-h-11 min-w-[76px] items-center justify-center whitespace-nowrap rounded-[10px] border border-[#dbe2ea] bg-white px-4 text-[16px] font-medium leading-6 text-[#15213b] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] disabled:cursor-wait disabled:opacity-50"
        >
          {saving ? "저장 중" : "저장"}
        </button>
        <button
          type="button"
          onClick={onNext}
          className="inline-flex min-h-11 min-w-[76px] items-center justify-center whitespace-nowrap rounded-[10px] bg-[#15213b] px-4 text-[16px] font-medium leading-6 text-white hover:bg-[#25314a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"
        >
          다음
        </button>
      </div>
    </OwnerInitialSetupPrimaryAction>
  );
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
      {setupItems.map((item, index) => {
        const complete = confirmed.includes(item.key);
        const current = !allComplete && item.key === activeStep;
        const available = complete || current || setupItems.slice(0, index).every((previous) => confirmed.includes(previous.key));

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
              <span className="min-w-0 text-[16px] font-medium leading-6 text-[#15213b] [overflow-wrap:anywhere]">
                {item.railLabel}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
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
  const [headerActionElement, setHeaderActionElement] = useState<HTMLDivElement | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  const saveActionRef = useRef<SetupSave | null>(null);
  const [savingForLater, setSavingForLater] = useState(false);
  const [laterError, setLaterError] = useState("");
  async function saveAndLater() {
    if (savingForLater) return;
    if (!saveActionRef.current) { closeGuide(); return; }
    setSavingForLater(true);
    setLaterError("");
    try { if (await saveActionRef.current() === true) closeGuide(); }
    catch { setLaterError("저장하지 못했어요. 입력 내용을 확인하고 다시 시도해 주세요."); }
    finally { setSavingForLater(false); }
  }
  const readiness = getBootstrapOwnerInitialSetupReadiness(data);
  const confirmed = OWNER_INITIAL_SETUP_ORDER.filter((step) => readiness.steps[step]);
  const nextStep = readiness.nextStep;
  const screenStep = stepForScreen(activeScreen);
  const activeStep = screenStep ?? nextStep ?? "pricing";
  const allComplete = readiness.completed;
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
    onCloseRef.current();
  }, []);

  useEffect(() => {
    if (!open || !portalTarget) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => dialogRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof Element && event.target.closest("[data-price-guide-service-duration-dialog]")) return;
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
  }, [closeGuide, open, portalTarget]);

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
        <SetupSaveContext.Provider value={saveActionRef}>
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="owner-initial-setup-title"
          tabIndex={-1}
          className="pointer-events-auto relative z-10 flex max-h-[calc(100dvh-20px)] w-full min-w-0 flex-col overflow-hidden rounded-[18px] bg-white shadow-[0_24px_64px_rgba(15,23,42,0.20)] outline-none sm:max-h-[calc(100dvh-48px)] sm:w-[min(960px,calc(100vw-48px))]"
          data-testid="owner-initial-setup-guide"
        >
          <header className="shrink-0 border-b border-[#dbe2ea] bg-white px-4 py-3 sm:px-6 sm:py-3.5">
            <div
              className="flex min-w-0 flex-wrap items-center gap-2"
              data-testid="owner-initial-setup-title-row"
            >
              <div
                className="flex min-w-0 flex-1 basis-[160px] items-center gap-1"
                data-testid="owner-initial-setup-title-group"
              >
                {previousItem ? (
                  <button
                    type="button"
                    onClick={() => onNavigate(previousItem.screen)}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] text-[#64748b] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
                    aria-label="이전 단계로"
                  >
                    <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                  </button>
                ) : null}
                <h2
                  id="owner-initial-setup-title"
                  className={`${OWNER_TYPOGRAPHY.sectionTitle} min-w-0 text-left tracking-[-0.015em] text-[#15213b] [overflow-wrap:anywhere] [word-break:keep-all]`}
                >
                  {activeItem.label}
                </h2>
              </div>
              <div
                className="flex min-w-0 w-full flex-wrap items-center justify-end gap-1 sm:w-auto sm:flex-1"
                data-testid="owner-initial-setup-title-actions"
              >
                <button
                  type="button"
                  onClick={() => void saveAndLater()}
                  disabled={savingForLater}
                  className={`inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[8px] border border-[#dbe2ea] bg-white px-3 ${OWNER_TYPOGRAPHY.control} text-[#475569] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]`}
                >
                  {savingForLater ? "저장 중" : "저장하고 나중에"}
                </button>
                <div
                  ref={setHeaderActionElement}
                  className="flex min-w-0 flex-1 justify-end empty:hidden sm:flex-none"
                  data-testid="owner-initial-setup-header-actions"
                />
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
          </header>

          <nav className="shrink-0 border-b border-[#dbe2ea] bg-[#fbfcfd] px-3 py-3 md:hidden" aria-label="매장 준비 단계">
            <SetupChecklist
              activeStep={activeStep}
              allComplete={allComplete}
              confirmed={confirmed}
              compact
              onNavigate={onNavigate}
            />
          </nav>

          <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden bg-white">
            <aside className="hidden w-[184px] shrink-0 border-r border-[#dbe2ea] bg-[#fbfcfd] px-3 py-5 md:block" aria-label="매장 준비 단계">
              <SetupChecklist
                activeStep={activeStep}
                allComplete={allComplete}
                confirmed={confirmed}
                onNavigate={onNavigate}
              />
            </aside>
            <div
              className={`no-scrollbar min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#2563eb] ${activeScreen === "services" ? "sm:px-3 sm:py-5" : "sm:px-6 sm:py-6"}`}
              data-testid="owner-initial-setup-body"
              role="region"
              aria-label={`${activeItem.label} 설정 내용`}
              tabIndex={0}
            >
              {children}
            </div>
          </div>

        </div>
        {laterError ? <p role="alert">{laterError}</p> : null}
        </SetupSaveContext.Provider>
        </OwnerInitialSetupHeaderActionContext.Provider>
      </div>
    </div>,
    portalTarget,
  );
}
