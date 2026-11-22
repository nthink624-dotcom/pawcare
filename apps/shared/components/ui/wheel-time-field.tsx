"use client";

import { useId, useLayoutEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type RefObject } from "react";
import { cn } from "../../lib/cn";
import { availableClockTimes, clockToWheel, constrainWheelTime, formatWheelTime, parseClock, wheelToClock } from "../../lib/wheel-time";
import WheelPicker, { type WheelColumn, type WheelPickerHandle } from "./wheel-picker";

export interface WheelTimeFieldProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "value" | "defaultValue" | "type"> {
  value: string; onValueChange: (value: string) => void;
  allowedTimes?: readonly string[]; min?: string; max?: string; step?: number | "any";
  placeholder?: string; name?: string;
  displayFormat?: "period" | "24h";
}

export function WheelTimeField({ value, onValueChange, allowedTimes, min, max, step, placeholder = "시간 선택", displayFormat = "period", className, disabled, name, onClick, ...props }: WheelTimeFieldProps) {
  const [open, setOpen] = useState(false);
  const times = useMemo(() => availableClockTimes({ allowedTimes, min, max, step }), [allowedTimes, min, max, step]);
  const trigger = useRef<HTMLButtonElement>(null);
  const flushRef = useRef<(() => void) | null>(null);
  const popoverId = useId();
  return <>
    <button {...props} ref={trigger} type="button" data-wheel-time-field disabled={disabled || !times.length} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? popoverId : undefined}
      className={cn("inline-flex min-h-11 min-w-0 items-center justify-center whitespace-nowrap rounded-[8px] border border-[#dbe2ea] bg-white px-2 text-[16px] leading-6 tabular-nums text-[#15213b] outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-default disabled:bg-[#f7f8fa] disabled:text-slate-400", className)}
      onClick={(event) => { onClick?.(event); if (!event.defaultPrevented) { event.stopPropagation(); if (open) flushRef.current?.(); setOpen((current) => !current); } }}>
      {parseClock(value) === null ? placeholder : displayFormat === "24h" ? value : formatWheelTime(value)}
    </button>
    {name ? <input type="hidden" name={name} value={value} /> : null}
    {open && !disabled ? <TimePopover id={popoverId} label={props["aria-label"] ?? "시간 선택"} anchor={trigger} flushRef={flushRef} value={value} times={times} onChange={onValueChange} onClose={() => setOpen(false)} /> : null}
  </>;
}

function TimePopover({ id, label, anchor, flushRef, value, times, onClose, onChange }: {
  id: string; label: string; anchor: RefObject<HTMLButtonElement | null>; value: string; times: string[];
  flushRef: RefObject<(() => void) | null>;
  onClose: () => void; onChange: (value: string) => void;
}) {
  const popover = useRef<HTMLDivElement>(null);
  const wheel = useRef<WheelPickerHandle>(null);
  const interacted = useRef(false);
  const [draft, setDraft] = useState(() => constrainWheelTime(clockToWheel(value), times));
  const selection = constrainWheelTime(draft, times);
  const latest = useRef({ value, times, selection, onChange, onClose });
  useLayoutEffect(() => { latest.current = { value, times, selection, onChange, onClose }; });

  useLayoutEffect(() => {
    const node = popover.current;
    if (!node) return;
    // Keep a non-modal top-layer picker above the existing setup dialog.
    // Older WebViews use the fixed element inside that dialog instead.
    if (typeof node.showPopover === "function") node.showPopover();
    else node.removeAttribute("popover");
    function place() {
      const rect = anchor.current?.getBoundingClientRect();
      if (!rect || !node) return;
      const viewport = window.visualViewport;
      const viewportLeft = viewport?.offsetLeft ?? 0;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportRight = viewportLeft + (viewport?.width ?? document.documentElement.clientWidth);
      const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight);
      // A top-layer popover escapes its parent's clipping. Keep it within the
      // visible dialog or phone surface instead of the surrounding browser.
      const boundary = anchor.current?.closest('dialog[open], [role="dialog"], [data-wheel-time-boundary]')?.getBoundingClientRect();
      const leftEdge = Math.max(viewportLeft, boundary?.left ?? viewportLeft);
      const rightEdge = Math.min(viewportRight, boundary?.right ?? viewportRight);
      let topEdge = Math.max(viewportTop, boundary?.top ?? viewportTop);
      let bottomEdge = Math.min(viewportBottom, boundary?.bottom ?? viewportBottom);
      const width = Math.min(204, Math.max(0, rightEdge - leftEdge - 16));
      node.style.width = `${width}px`;
      const height = node.getBoundingClientRect().height;
      // Short desktop dialogs may be smaller than the wheel itself.
      if (bottomEdge - topEdge < height + 16) {
        topEdge = viewportTop;
        bottomEdge = viewportBottom;
      }
      const left = Math.max(leftEdge + 8, Math.min(rect.right - width, rightEdge - width - 8));
      const preferredTop = rect.bottom + 6 + height <= bottomEdge - 8 ? rect.bottom + 6 : rect.top - height - 6;
      node.style.left = `${left}px`;
      node.style.top = `${Math.max(topEdge + 8, Math.min(preferredTop, bottomEdge - height - 8))}px`;
    }
    function commit() {
      if (!interacted.current) return;
      const current = latest.current;
      const next = wheelToClock(constrainWheelTime(wheel.current?.getValue() ?? current.selection, current.times));
      if (current.times.includes(next) && next !== current.value) current.onChange(next);
    }
    flushRef.current = commit;
    function outside(event: PointerEvent) {
      if (node?.contains(event.target as Node) || anchor.current?.contains(event.target as Node)) return;
      commit(); latest.current.onClose();
    }
    function keyboard(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault(); event.stopPropagation();
      commit(); latest.current.onClose(); anchor.current?.focus({ preventScroll: true });
    }
    place(); node.focus({ preventScroll: true });
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", keyboard, true);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    if (anchor.current) {
      observer?.observe(anchor.current);
      const boundary = anchor.current.closest('dialog[open], [role="dialog"], [data-wheel-time-boundary]');
      if (boundary) observer?.observe(boundary);
    }
    return () => {
      if (typeof node.hidePopover === "function" && node.matches(":popover-open")) node.hidePopover();
      flushRef.current = null;
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", keyboard, true);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.visualViewport?.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("scroll", place);
      observer?.disconnect();
    };
  }, [anchor, flushRef]);

  const periods = [...new Set(times.map((time) => clockToWheel(time).period))];
  const hours = [...new Set(times.filter((time) => clockToWheel(time).period === selection.period).map((time) => clockToWheel(time).hour))];
  if (hours.length === 12) hours.sort((a, b) => Number(a) - Number(b));
  const minutes = [...new Set(times.filter((time) => { const v = clockToWheel(time); return v.period === selection.period && v.hour === selection.hour; }).map((time) => clockToWheel(time).minute))].sort((a, b) => Number(a) - Number(b));
  const columns: WheelColumn[] = [
    { id: "hour", label: "시", loop: hours.length === 12, options: hours.map((value) => ({ value, label: value })) },
    { id: "minute", label: "분", loop: minutes.length > 1, options: minutes.map((value) => ({ value, label: value.padStart(2, "0") })) },
    { id: "period", label: "오전·오후", options: periods.map((value) => ({ value, label: value === "am" ? "오전" : "오후" })) },
  ];
  return <div ref={popover} id={id} role="dialog" aria-modal="false" aria-label={label} tabIndex={-1} popover="manual" data-wheel-time-popover
    className="fixed m-0 w-[204px] max-w-[calc(100vw-16px)] overflow-visible rounded-[14px] border-0 bg-white p-0 text-[#15213b] shadow-[0_6px_22px_rgba(15,23,42,0.12)] outline-none backdrop:bg-transparent"
    style={{ inset: "auto" }} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}
    onPointerDownCapture={() => { interacted.current = true; }} onWheelCapture={() => { interacted.current = true; }}
    onKeyDownCapture={(event) => { if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(event.key)) interacted.current = true; }}>
    {times.length ? <WheelPicker ref={wheel} columns={columns} value={selection} onValueChange={(next) => {
      const selected = constrainWheelTime(next, times);
      interacted.current = true;
      setDraft(selected);
      const clock = wheelToClock(selected);
      if (clock !== value && times.includes(clock)) onChange(clock);
    }} label={`${label} 휠`} /> : <p role="status" className="p-3 text-[14px] leading-5 text-[#64748b]">선택 가능한 시간이 없어요.</p>}
  </div>;
}
