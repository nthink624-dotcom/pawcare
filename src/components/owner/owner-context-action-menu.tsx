"use client";

import { CalendarPlus, ChevronUp, CircleHelp, MessageSquareWarning, Plus } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import type { TesterFeedbackCategory } from "@/lib/tester-feedback";

const POSITION_STORAGE_KEY = "petmanager.owner.context-action-position.v1";
const DRAG_THRESHOLD_PX = 7;
const EDGE_GAP_PX = 12;
const BUTTON_SIZE_PX = 44;
const BOTTOM_NAV_CLEARANCE_PX = 84;
const MIN_USABLE_VIEWPORT_WIDTH_PX = BUTTON_SIZE_PX + EDGE_GAP_PX * 2;
const MIN_USABLE_VIEWPORT_HEIGHT_PX = BUTTON_SIZE_PX + BOTTOM_NAV_CLEARANCE_PX + EDGE_GAP_PX;

type MenuPosition = { x: number; y: number };

function viewportBounds() {
  const viewport = window.visualViewport;
  const visualWidth = viewport?.width ?? 0;
  const visualHeight = viewport?.height ?? 0;
  const useVisualWidth = Number.isFinite(visualWidth) && visualWidth >= MIN_USABLE_VIEWPORT_WIDTH_PX;
  const useVisualHeight = Number.isFinite(visualHeight) && visualHeight >= MIN_USABLE_VIEWPORT_HEIGHT_PX;
  const shell = document.querySelector<HTMLElement>(".pm-mobile-owner")?.getBoundingClientRect();
  const viewportLeft = useVisualWidth && Number.isFinite(viewport?.offsetLeft) ? viewport?.offsetLeft ?? 0 : 0;
  const viewportTop = useVisualHeight && Number.isFinite(viewport?.offsetTop) ? viewport?.offsetTop ?? 0 : 0;
  const viewportRight = viewportLeft + (useVisualWidth ? visualWidth : Math.max(window.innerWidth, MIN_USABLE_VIEWPORT_WIDTH_PX));
  const viewportBottom = viewportTop + (useVisualHeight ? visualHeight : Math.max(window.innerHeight, MIN_USABLE_VIEWPORT_HEIGHT_PX));
  const left = shell ? Math.max(viewportLeft, shell.left) : viewportLeft;
  const top = shell ? Math.max(viewportTop, shell.top) : viewportTop;
  const right = shell ? Math.min(viewportRight, shell.right) : viewportRight;
  const bottom = shell ? Math.min(viewportBottom, shell.bottom) : viewportBottom;
  return {
    left,
    top,
    width: Math.max(right - left, MIN_USABLE_VIEWPORT_WIDTH_PX),
    height: Math.max(bottom - top, MIN_USABLE_VIEWPORT_HEIGHT_PX),
  };
}

function clampAxis(value: number, minimum: number, maximum: number, center: number) {
  return maximum >= minimum ? Math.min(maximum, Math.max(minimum, value)) : center;
}

function clampPosition(position: MenuPosition): MenuPosition {
  const viewport = viewportBounds();
  const half = BUTTON_SIZE_PX / 2;
  return {
    x: clampAxis(
      position.x,
      viewport.left + EDGE_GAP_PX + half,
      viewport.left + viewport.width - EDGE_GAP_PX - half,
      viewport.left + viewport.width / 2,
    ),
    y: clampAxis(
      position.y,
      viewport.top + EDGE_GAP_PX + half,
      viewport.top + viewport.height - BOTTOM_NAV_CLEARANCE_PX - half,
      viewport.top + viewport.height / 2,
    ),
  };
}

function defaultPosition(): MenuPosition {
  const viewport = viewportBounds();
  return clampPosition({
    x: viewport.left + viewport.width - EDGE_GAP_PX - BUTTON_SIZE_PX / 2,
    y: viewport.top + viewport.height - BOTTOM_NAV_CLEARANCE_PX - BUTTON_SIZE_PX / 2,
  });
}

function readStoredPosition(): MenuPosition {
  try {
    const value = JSON.parse(window.localStorage.getItem(POSITION_STORAGE_KEY) ?? "null") as Partial<MenuPosition> | null;
    if (value && Number.isFinite(value.x) && Number.isFinite(value.y)) {
      return clampPosition({ x: Number(value.x), y: Number(value.y) });
    }
  } catch {
    try {
      window.localStorage.removeItem(POSITION_STORAGE_KEY);
    } catch {
      // Local position is optional when device storage is unavailable.
    }
  }
  return defaultPosition();
}

type OwnerContextActionMenuProps = {
  isOpen: boolean;
  isSuppressed: boolean;
  isTester: boolean;
  scheduleAppearance?: boolean;
  onOpenChange: (open: boolean) => void;
  onAddReservation: () => void;
  onOpenFeedback: (category: TesterFeedbackCategory) => void;
};

const OwnerContextActionMenu = forwardRef<HTMLButtonElement, OwnerContextActionMenuProps>(function OwnerContextActionMenu({
  isOpen,
  isSuppressed,
  isTester,
  scheduleAppearance = false,
  onOpenChange,
  onAddReservation,
  onOpenFeedback,
}, forwardedRef) {
  const menuRootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const firstActionRef = useRef<HTMLButtonElement | null>(null);
  const pointerRef = useRef<{ id: number; startX: number; startY: number; origin: MenuPosition; dragged: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);

  useImperativeHandle(forwardedRef, () => triggerRef.current as HTMLButtonElement, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPosition(readStoredPosition()));
    const keepInViewport = () => setPosition((current) => current ? clampPosition(current) : readStoredPosition());
    window.addEventListener("resize", keepInViewport);
    window.addEventListener("orientationchange", keepInViewport);
    window.visualViewport?.addEventListener("resize", keepInViewport);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", keepInViewport);
      window.removeEventListener("orientationchange", keepInViewport);
      window.visualViewport?.removeEventListener("resize", keepInViewport);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const frame = window.requestAnimationFrame(() => firstActionRef.current?.focus());
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (menuRootRef.current?.contains(event.target as Node)) return;
      onOpenChange(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onOpenChange(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen, onOpenChange]);

  useEffect(() => {
    if (!isSuppressed || !isOpen) return;
    onOpenChange(false);
  }, [isOpen, isSuppressed, onOpenChange]);

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    suppressClickRef.current = false;
    const rect = event.currentTarget.getBoundingClientRect();
    pointerRef.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: position ?? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
      dragged: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    const deltaX = event.clientX - pointer.startX;
    const deltaY = event.clientY - pointer.startY;
    if (!pointer.dragged && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD_PX) return;
    pointer.dragged = true;
    event.preventDefault();
    onOpenChange(false);
    setPosition(clampPosition({ x: pointer.origin.x + deltaX, y: pointer.origin.y + deltaY }));
  }

  function finishPointer(event: ReactPointerEvent<HTMLButtonElement>) {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (pointer.dragged) {
      suppressClickRef.current = true;
      setPosition((current) => {
        if (current) {
          try {
            window.localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(current));
          } catch {
            // Dragging stays usable even when local position persistence is unavailable.
          }
        }
        return current;
      });
    }
    pointerRef.current = null;
  }

  function runAction(action: () => void) {
    onOpenChange(false);
    action();
  }

  const viewport = typeof window === "undefined" ? null : viewportBounds();
  const opensLeft = position && viewport ? position.x > viewport.left + viewport.width / 2 : true;
  const opensUp = position && viewport ? position.y > viewport.top + viewport.height / 2 : true;

  return (
    <div
      ref={menuRootRef}
      data-testid="owner-context-action-menu"
      data-suppressed={isSuppressed ? "true" : "false"}
      aria-hidden={isSuppressed || undefined}
      className={`fixed z-40 ${isSuppressed ? "invisible pointer-events-none" : ""} ${position ? "" : "bottom-[calc(env(safe-area-inset-bottom)+84px)] right-3"}`}
      style={position ? { left: position.x, top: position.y, transform: "translate(-50%, -50%)" } : undefined}
    >
      {isOpen ? (
        <div
          id="owner-context-action-menu-actions"
          role="menu"
          aria-label="빠른 메뉴"
          className={`absolute w-[156px] max-w-[calc(100vw-24px)] overflow-hidden rounded-[14px] border border-[#d9e0e8] bg-white p-1 shadow-[0_10px_28px_rgba(17,26,48,0.14)] ${opensLeft ? "right-0" : "left-0"} ${opensUp ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)]"}`}
        >
          <button ref={firstActionRef} type="button" role="menuitem" className="flex min-h-11 w-full items-center gap-2 rounded-[10px] px-2.5 text-left text-[14px] font-medium leading-5 text-[#111a30] hover:bg-[#f6f8fb] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#2563eb]" onClick={() => runAction(onAddReservation)}>
            <CalendarPlus className="h-4.5 w-4.5 text-[#526176]" aria-hidden="true" />
            새 예약 추가
          </button>
          <button type="button" role="menuitem" className="flex min-h-11 w-full items-center gap-2 rounded-[10px] px-2.5 text-left text-[14px] font-medium leading-5 text-[#111a30] hover:bg-[#f6f8fb] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#2563eb]" onClick={() => runAction(() => onOpenFeedback("inquiry"))}>
            <CircleHelp className="h-4.5 w-4.5 text-[#526176]" aria-hidden="true" />
            문의 남기기
          </button>
          <button type="button" role="menuitem" className="flex min-h-11 w-full items-center gap-2 rounded-[10px] px-2.5 text-left text-[14px] font-medium leading-5 text-[#111a30] hover:bg-[#f6f8fb] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#2563eb]" onClick={() => runAction(() => onOpenFeedback("bug"))}>
            <MessageSquareWarning className="h-4.5 w-4.5 text-[#526176]" aria-hidden="true" />
            함께 고쳐요
          </button>
        </div>
      ) : null}

      <button
        ref={triggerRef}
        type="button"
        data-testid="owner-context-action-trigger"
        aria-label="빠른 메뉴 열기 및 이동"
        aria-expanded={isOpen}
        aria-controls="owner-context-action-menu-actions"
        tabIndex={isSuppressed ? -1 : undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
        onClick={() => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
          }
          onOpenChange(!isOpen);
        }}
        className="inline-flex h-11 w-11 touch-none items-center justify-center rounded-full bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]"
      >
        <span
          data-testid="owner-context-action-trigger-visual"
          className={`inline-flex h-10 w-10 items-center justify-center rounded-full border shadow-[0_2px_8px_rgba(17,26,48,0.14)] ${scheduleAppearance ? "border-[#2f5fb3] bg-[#2f5fb3] text-white" : "text-[#111a30]"} ${scheduleAppearance ? "" : isTester ? "border-[#d8c59c] bg-[#fff5d9]" : "border-[#cfd8e3] bg-white"}`}
          aria-hidden="true"
        >
          {scheduleAppearance ? <Plus className="h-4 w-4" strokeWidth={2.2} /> : <ChevronUp className={`h-4 w-4 transition-transform motion-reduce:transition-none ${isOpen ? "rotate-180" : ""}`} strokeWidth={2.2} />}
        </span>
      </button>
    </div>
  );
});

export default OwnerContextActionMenu;
